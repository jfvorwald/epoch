import Phaser from 'phaser';
import { getLevel } from '../data/levels';
import { GAME_CONFIG, MAX_SCORE } from '../data/config';
import { SHIPS, getShipStats, defaultLoadout, SHIP_PARTS_REQUIRED, SHIP_PART_DROP_CHANCE, PLAYER_MAX_HP } from '../data/ships';
import type { Checkpoint, CombatCallbacks, EnemyKind, HudState, Level, PickupKind, Preferences, ShipId, ShipLoadout, WeaponKind, Wave } from './types';
import { aimedVelocity, ARENA, clamp, moveRelative, segmentCircleHit } from './math';
import { addWeaponPower, getEffectiveWeaponPower, getDamageMultiplier, getProjectileCount, getProjectileDamageMultiplier, getWeaponPower, getWeaponWeakness, MAX_WEAPON_POWER } from './weapons';
import { boundedProjectileSpeed, createAsteroidTrajectory, createLevelWaves } from './asteroids';
import { getLevelVisual } from '../data/visuals';
import { LevelBackdrop } from './LevelBackdrop';
import { createEnemyVisuals, type EnemyVisualSet } from './enemyVisuals';
import { createProjectileTextures, getPlayerShotShape, getEnemyShotShape, getProjectileStyle, type ProjectileShape } from './projectileVisuals';
import { createGuardianAttack, sampleGuardianShot, type GuardianPlan, type GuardianShot } from './guardianAttacks';

type Sprite = Phaser.GameObjects.Image;
type Projectile = { sprite: Sprite; x: number; y: number; px: number; py: number; vx: number; vy: number; radius: number; damage: number; weapon: WeaponKind; age: number; hostile: boolean; pierce: number; hitEnemies: Set<Enemy>; shape: ProjectileShape; trajectory?: GuardianShot; lifetime: number };
type Enemy = { sprite: Sprite; x: number; y: number; px: number; py: number; sx: number; sy: number; tx: number; ty: number; age: number; entry: number; hold: number; dive: boolean; vx: number; vy: number; hp: number; maxHp: number; radius: number; kind: EnemyKind; phase: number; shotAt: number; flash: number; speed: number; drop?: PickupKind; boss: boolean; bossPhase: number; attackAt: number; telegraph: number; attackAngle: number; tier: number; tint: number; returns: number; asteroidIndex?: number; returnPattern: 'hook' | 'slalom' | 'crossing' | 'asteroid-crossing'; bossKind?: 'warden' | 'twins' | 'carrier' | 'lattice' | 'koschei'; attackPlan?: GuardianPlan; attackCycle?: number };
type Pickup = { sprite: Phaser.GameObjects.Container; x: number; y: number; px: number; py: number; age: number; kind: PickupKind; phase: number };
type Effect = { sprite: Sprite; x: number; y: number; vx: number; vy: number; age: number; life: number; scale: number; rotation: number };
type Star = { sprite: Sprite; speed: number; phase: number };

const DEATH_SECONDS = 0.95;
const LIMITS = { friendly: 180, hostile: 180, effects: 100, enemies: 64, pickups: 20 };
const BUFF_SECONDS = 8;
const PICKUP_COLORS: Record<PickupKind, number> = { supercharge: 0xffea83, health: 0x7bffc6, rapid: 0xffc66c, spread: 0x9bf2ff, damage: 0xe4a0ff, multishot: 0x75f0ed, 'weapon-pulse': 0x9bf2ff, 'weapon-lance': 0xc4a0ff, 'weapon-scatter': 0xffb773, 'ship-part': 0xffdc89 };
const PICKUP_LABELS: Record<PickupKind, string> = { supercharge: '★', health: '+', rapid: 'R', spread: 'S', damage: 'D', multishot: '↑', 'weapon-pulse': 'P', 'weapon-lance': 'L', 'weapon-scatter': 'W', 'ship-part': '◆' };
const PICKUP_NAMES: Record<PickupKind, string> = { supercharge: 'SUPERCHARGE · MAX POWER · 6 SECONDS', health: 'HULL REPAIRED +2', rapid: 'RAPID FIRE · 8 SECONDS', spread: 'SPREAD SHOT · 8 SECONDS', damage: 'OVERCHARGE · 8 SECONDS', multishot: 'MULTISHOT +1 · UNTIL LEVEL END', 'weapon-pulse': 'PULSE CANNONS EQUIPPED', 'weapon-lance': 'PIERCING LANCE EQUIPPED', 'weapon-scatter': 'SCATTER CANNON EQUIPPED', 'ship-part': 'MANTA BLUEPRINT RECOVERED' };
const WEAPON_CYCLE: WeaponKind[] = ['pulse', 'lance', 'scatter'];

export class CombatScene extends Phaser.Scene {
  private callbacks: CombatCallbacks;
  private preferences: Preferences;
  private mode: 'menu' | 'combat' | 'paused' | 'dying' | 'ended' = 'menu';
  private ready = false;
  private pendingCheckpoint: Checkpoint | null = null;
  private level: Level = getLevel(1);
  private player!: Sprite;
  private engineLeft!: Sprite;
  private engineRight!: Sprite;
  private shield!: Phaser.GameObjects.Arc;
  private backdrop!: LevelBackdrop;
  private visual = getLevelVisual(1);
  private enemyVisuals?: EnemyVisualSet;
  private bossTelegraph!: Phaser.GameObjects.Graphics;
  private guardianPortals: { x: number; y: number; radius: number; expiresAt: number }[] = [];
  private playerExplosion!: Phaser.GameObjects.Graphics;
  private deathElapsed = 0;
  private deathOrigin = { x: 240, y: 654 };
  private stars: Star[] = [];
  private bullets: Projectile[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private effects: Effect[] = [];
  private hp = PLAYER_MAX_HP;
  private shipId: ShipId = 'strelka';
  private loadout: ShipLoadout = defaultLoadout();
  private stats = getShipStats('strelka', defaultLoadout());
  private weapon: WeaponKind = 'pulse';
  private multishot = 0;
  private shipParts = 0;
  private bossTotalHp = 0;
  private salvageStarted = false;
  private score = 0;
  private kills = 0;
  private elapsed = 0;
  private backdropTime = 0;
  private waveIndex = 0;
  private completedWaves = 0;
  private waveClearAt: number | null = null;
  private nextFire = 0;
  private nextHud = 0;
  private invulnerable = 0;
  private bossSpawned = false;
  private bossDefeated = false;
  private playerPrev = { x: 240, y: 654 };
  private pointerAnchor: { id: number; x: number; y: number } | null = null;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private buffs: Partial<Record<PickupKind, number>> = {};
  private lastShotSound = 0;
  private runSerial = 0;
  private pointerDisplacement = 0;

  constructor(callbacks: CombatCallbacks, preferences: Preferences) {
    super({ key: 'Combat' });
    this.callbacks = callbacks;
    this.preferences = { ...preferences };
  }

  preload(): void {
    this.load.svg('strelka', SHIPS.strelka.art, { width: 100, height: 124 });
    this.load.svg('manta', SHIPS.manta.art, { width: 140, height: 110 });
    this.load.svg('enemy-straight', '/art/enemy-straight.svg', { width: 76, height: 84 });
    this.load.svg('enemy-weaver', '/art/enemy-weaver.svg', { width: 76, height: 84 });
    this.load.svg('enemy-shooter', '/art/enemy-shooter.svg', { width: 80, height: 84 });
    this.load.svg('boss', '/art/boss.svg', { width: 242, height: 182 });
    for (const kind of ['warden', 'twins', 'carrier', 'lattice']) this.load.svg(`boss-${kind}`, `/art/boss-${kind}.svg`, { width: 240, height: 190 });
  }

  create(): void {
    this.createTextures();
    createProjectileTextures(this);
    this.cameras.main.setBackgroundColor('#100e23');
    this.backdrop = new LevelBackdrop(this);
    for (let i = 0; i < 58; i++) {
      const x = (i * 137.507) % 480;
      const y = (i * 91.317) % 800;
      const star = this.add.image(x, y, 'spark').setDepth(-4).setScale(i % 6 === 0 ? 0.6 : 0.3).setTint(i % 3 === 0 ? 0xab9cd3 : 0xc2d6e1).setAlpha(0.15 + (i % 5) * 0.06);
      this.stars.push({ sprite: star, speed: 10 + (i % 4) * 8, phase: i });
    }
    this.applyLevelVisual(1);
    this.bossTelegraph = this.add.graphics().setDepth(3);
    this.playerExplosion = this.add.graphics().setDepth(12);
    this.engineLeft = this.add.image(227, 682, 'engine').setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.engineRight = this.add.image(253, 682, 'engine').setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.player = this.add.image(240, 654, 'strelka').setDisplaySize(76, 94).setDepth(7);
    this.shield = this.add.circle(240, 654, 36, 0x6de8ff, 0).setStrokeStyle(1, 0x83edff, 0.6).setDepth(8).setVisible(false);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.mode !== 'combat' || this.pointerAnchor) return;
      this.pointerAnchor = { id: pointer.id, x: pointer.x, y: pointer.y };
      this.pointerDisplacement = 0;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const anchor = this.pointerAnchor;
      if (this.mode !== 'combat' || !anchor || anchor.id !== pointer.id || !pointer.isDown) return;
      const sensitivity = this.stats.speed / 310;
      const moved = moveRelative(this.player, anchor, { x: anchor.x + (pointer.x - anchor.x) * sensitivity, y: anchor.y + (pointer.y - anchor.y) * sensitivity });
      this.pointerDisplacement = moved.x - this.player.x;
      this.player.setPosition(moved.x, moved.y);
      this.pointerAnchor = { id: pointer.id, x: pointer.x, y: pointer.y };
    });
    const release = (pointer: Phaser.Input.Pointer) => {
      if (this.pointerAnchor?.id === pointer.id) this.pointerAnchor = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => { this.pointerAnchor = null; });
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.player.setVisible(false);
    this.engineLeft.setVisible(false);
    this.engineRight.setVisible(false);
    this.ready = true;
    this.callbacks.onReady();
    if (this.pendingCheckpoint) {
      const checkpoint = this.pendingCheckpoint;
      this.pendingCheckpoint = null;
      this.startRun(checkpoint);
    }
  }

  private createTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff).fillCircle(4, 4, 3);
    g.generateTexture('spark', 8, 8).clear();
    g.lineStyle(2, 0xffffff).strokeCircle(24, 24, 20);
    g.generateTexture('ring', 48, 48).clear();
    g.fillStyle(0x313440).fillPoints([{ x: 8, y: 19 }, { x: 23, y: 5 }, { x: 47, y: 9 }, { x: 59, y: 30 }, { x: 49, y: 54 }, { x: 25, y: 61 }, { x: 5, y: 44 }], true);
    g.lineStyle(2, 0xdfb787).strokePoints([{ x: 8, y: 19 }, { x: 23, y: 5 }, { x: 47, y: 9 }, { x: 59, y: 30 }, { x: 49, y: 54 }, { x: 25, y: 61 }, { x: 5, y: 44 }], true);
    g.fillStyle(0x121a27).fillCircle(24, 24, 7).fillCircle(42, 40, 9);
    g.lineStyle(2, 0x85786c).lineBetween(9, 39, 23, 44).lineBetween(40, 12, 46, 24);
    g.generateTexture('enemy-debris', 64, 64).clear();
    g.fillStyle(0x53e4ff, 0.12).fillTriangle(0, 0, 20, 0, 10, 60).fillStyle(0x6cf2ff, 0.6).fillTriangle(4, 0, 16, 0, 10, 40).fillStyle(0xdeffff).fillTriangle(7, 0, 13, 0, 10, 22);
    g.generateTexture('engine', 20, 60).destroy();
  }

  public startRun(checkpoint: Checkpoint): void {
    if (!this.ready) { this.pendingCheckpoint = checkpoint; return; }
    this.clearRun();
    const level = getLevel(checkpoint.level);
    this.level = { ...level, waves: createLevelWaves(level) };
    this.applyLevelVisual(this.level.id);
    this.runSerial++;
    this.shipId = checkpoint.shipId && SHIPS[checkpoint.shipId] ? checkpoint.shipId : 'strelka';
    this.loadout = checkpoint.loadout ?? defaultLoadout();
    this.stats = getShipStats(this.shipId, this.loadout);
    this.weapon = SHIPS[this.shipId].weapon;
    this.multishot = 0;
    this.bossTotalHp = 0;
    this.salvageStarted = false;
    this.hp = clamp(checkpoint.hp, 1, this.stats.maxHp);
    this.score = Number.isFinite(checkpoint.score) ? clamp(Math.floor(checkpoint.score), 0, MAX_SCORE) : 0;
    this.kills = 0;
    this.elapsed = 0;
    this.waveIndex = 0;
    this.completedWaves = 0;
    this.waveClearAt = null;
    this.nextFire = 0.4;
    this.nextHud = 0;
    this.invulnerable = 1.3;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.buffs = {};
    this.pointerAnchor = null;
    this.pointerDisplacement = 0;
    this.player.setTexture(this.shipId).setDisplaySize(this.shipId === 'manta' ? 100 : 76, this.shipId === 'manta' ? 79 : 94).setPosition(240, 654).setRotation(0).setVisible(true).setAlpha(1).clearTint();
    this.playerPrev = { x: 240, y: 654 };
    this.engineLeft.setVisible(true);
    this.engineRight.setVisible(true);
    this.mode = 'combat';
    this.emitHud();
    this.callbacks.onNotice(`LEVEL ${String(this.level.id).padStart(2, '0')} · ${this.level.name.toUpperCase()}`);
  }

  public pauseCombat(): void {
    if (this.mode !== 'combat') return;
    this.mode = 'paused';
    this.pointerAnchor = null;
    this.input.keyboard?.resetKeys();
  }

  public resumeCombat(): void {
    if (this.mode !== 'paused') return;
    this.pointerAnchor = null;
    this.input.keyboard?.resetKeys();
    this.mode = 'combat';
  }

  public showMenu(): void {
    this.mode = 'menu';
    if (!this.ready) return;
    this.clearRun();
    this.player.setVisible(false);
    this.engineLeft.setVisible(false);
    this.engineRight.setVisible(false);
    this.shield.setVisible(false);
  }

  public setShipParts(parts: number): void { this.shipParts = clamp(Math.floor(parts), 0, SHIP_PARTS_REQUIRED); }

  public setPreferences(preferences: Preferences): void {
    this.preferences = { ...preferences };
    // Settings can change while combat is paused: remove stale guides at once.
    if (this.ready) this.drawBossTelegraph();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.mode === 'dying') {
      this.deathElapsed += dt;
      this.updateProjectiles(dt, false);
      this.updateEffects(dt);
      this.drawPlayerExplosion();
      if (this.deathElapsed >= DEATH_SECONDS) this.finish('defeat');
      return;
    }
    if (this.mode === 'ended') { this.updateProjectiles(dt, false); this.updateEffects(dt); return; }
    if (this.mode !== 'combat') return;
    this.elapsed += dt;
    this.backdropTime += dt;
    this.updateBackdrop(dt);
    this.updatePlayer(dt);
    this.updateWaveProgression();
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    if (this.mode !== 'combat') return;
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.drawBossTelegraph();
    this.playerPrev.x = this.player.x;
    this.playerPrev.y = this.player.y;
    this.pointerDisplacement *= 0.8;
    if (this.elapsed >= this.nextHud) {
      this.nextHud = this.elapsed + 0.1;
      this.emitHud();
    }
    if (this.waveIndex === this.level.waves.length && this.enemies.length === 0) {
      if (!this.level.boss || this.bossDefeated) {
        // Final salvage must reach the ship before an outcome can replace the playfield.
        if (!this.salvageStarted) {
          this.salvageStarted = true;
          if (this.bullets.some(bullet => bullet.hostile)) this.callbacks.onNotice('GUARDIAN DOWN · EVADE THE LAST SHOTS');
          else if (this.pickups.length) this.callbacks.onNotice('LEVEL SECURE · RECOVERING SALVAGE');
        }
        if (this.pickups.length === 0 && !this.bullets.some(bullet => bullet.hostile)) this.finish('complete');
      }
    }
  }

  private updateWaveProgression(): void {
    if (this.enemies.length || this.bossSpawned) return;
    if (this.waveIndex > this.completedWaves) {
      this.completedWaves = this.waveIndex;
      this.waveClearAt = this.elapsed;
      // Launched shots remain live across wave boundaries, even after their source dies.
      this.callbacks.onNotice(`WAVE ${this.waveIndex} CLEAR · NEXT CONTACT INBOUND`);
    }
    if (this.waveClearAt !== null && this.elapsed - this.waveClearAt < 0.9) return;
    if (this.waveIndex < this.level.waves.length) {
      const wave = this.level.waves[this.waveIndex];
      if (wave.at > this.elapsed) return;
      this.spawnWave(wave, this.waveIndex);
      this.waveIndex++;
      this.waveClearAt = null;
      this.emitHud();
    } else if (this.level.boss) this.spawnBoss();
  }

  private updateBackdrop(dt: number): void {
    if (this.preferences.reducedMotion) return;
    for (const star of this.stars) {
      star.sprite.x += Math.sin(this.visual.flowAngle) * star.speed * this.visual.starSpeed * dt;
      star.sprite.y += Math.cos(this.visual.flowAngle) * star.speed * this.visual.starSpeed * dt;
      if (star.sprite.y > 804) star.sprite.y = -4;
      if (star.sprite.y < -4) star.sprite.y = 804;
      if (star.sprite.x > 484) star.sprite.x = -4;
      if (star.sprite.x < -4) star.sprite.x = 484;
    }
  }

  private applyLevelVisual(level: number): void {
    if (this.enemyVisuals && this.visual.level === level) return;
    // startRun has already destroyed old enemies before their textures retire.
    this.enemyVisuals?.dispose();
    this.visual = getLevelVisual(level);
    this.enemyVisuals = createEnemyVisuals(this, this.visual);
    this.backdrop.apply(this.visual);
    this.stars.forEach((star, i) => {
      star.sprite.setTint(i % 4 ? this.visual.palette.light : this.visual.palette.accent);
      star.sprite.setPosition((i * 137.507 + this.visual.seed % 480) % 480, (i * 91.317 + this.visual.seed % 800) % 800);
      star.sprite.setAlpha(0.12 + i % 5 * 0.05);
    });
  }

  private updatePlayer(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) dx--;
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) dx++;
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) dy--;
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) dy++;
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      this.player.x = clamp(this.player.x + dx / length * this.stats.speed * dt, ARENA.minX, ARENA.maxX);
      this.player.y = clamp(this.player.y + dy / length * this.stats.speed * dt, ARENA.minY, ARENA.maxY);
    }
    const desiredAngle = this.preferences.reducedMotion ? 0 : clamp((dx || this.pointerDisplacement * 0.06) * 0.15, -0.2, 0.2);
    this.player.rotation = Phaser.Math.Linear(this.player.rotation, desiredAngle, 0.15);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.player.setAlpha(this.invulnerable > 0 ? this.preferences.reducedMotion ? 0.7 : Math.floor(this.elapsed * 12) % 2 === 0 ? 0.48 : 1 : 1);
    this.shield.setPosition(this.player.x, this.player.y + 4).setVisible(this.invulnerable > 0);
    const pulse = this.preferences.reducedMotion ? 1 : 0.93 + Math.sin(this.elapsed * 37) * 0.12;
    this.engineLeft.setPosition(this.player.x - (this.shipId === 'manta' ? 29 : 13), this.player.y + (this.shipId === 'manta' ? 30 : 48)).setScale(0.65, 0.65 * pulse).setAlpha(0.65);
    this.engineRight.setPosition(this.player.x + (this.shipId === 'manta' ? 29 : 13), this.player.y + (this.shipId === 'manta' ? 30 : 48)).setScale(0.65, 0.65 * pulse).setAlpha(0.65);
    for (const kind of ['rapid', 'spread', 'damage', 'supercharge'] as PickupKind[]) {
      if (this.buffs[kind] && this.buffs[kind]! <= this.elapsed) delete this.buffs[kind];
    }
    if (this.elapsed >= this.nextFire && !this.salvageStarted) {
      const cycle = this.weapon === 'lance' ? 1.55 : this.weapon === 'scatter' ? 1.15 : 1;
      this.nextFire = this.elapsed + this.stats.fireInterval * cycle * (this.buffs.rapid ? 0.5 : 1);
      const damage = this.stats.damage * getProjectileDamageMultiplier(this.effectiveWeaponPower(), Boolean(this.buffs.spread)) * (this.buffs.damage ? 2 : 1) * cycle;
      const count = this.projectileCount();
      const step = this.weapon === 'scatter' ? 0.16 : this.weapon === 'lance' ? 0.085 : 0.075;
      const width = Math.min(1.25, Math.max(0, count - 1) * step);
      for (let i = 0; i < count; i++) {
        const offset = count > 1 ? (i / (count - 1) - 0.5) : 0;
        const angle = -Math.PI / 2 + offset * width;
        const speed = this.weapon === 'lance' ? 840 : this.weapon === 'scatter' ? 590 : 680;
        this.fireProjectile(this.player.x + offset * 24, this.player.y - 31, Math.cos(angle) * speed, Math.sin(angle) * speed, false, damage, this.weapon === 'lance' ? 3 : 1);
      }
      if (this.elapsed - this.lastShotSound > 0.12 || this.lastShotSound > this.elapsed) {
        this.lastShotSound = this.elapsed;
        this.callbacks.onSound('shoot');
      }
    }
  }

  private effectiveWeaponPower(): number {
    return getEffectiveWeaponPower(this.multishot, (this.buffs.supercharge ?? 0) > this.elapsed);
  }

  private projectileCount(): number {
    return getProjectileCount(this.effectiveWeaponPower(), Boolean(this.buffs.spread));
  }

  private formationTarget(wave: Wave, index: number): { x: number; y: number } {
    const centered = index - (wave.count - 1) / 2;
    const spacing = Math.min(68, 360 / Math.max(1, wave.count - 1));
    switch (wave.formation) {
      case 'chevron': return { x: 240 + centered * spacing, y: 230 - Math.abs(centered) * 31 };
      case 'arc': {
        const angle = Math.PI * (0.13 + index / Math.max(1, wave.count - 1) * 0.74);
        return { x: 240 + Math.cos(angle) * 174, y: 125 + Math.sin(angle) * 119 };
      }
      case 'pincer': return { x: index % 2 === 0 ? 74 + Math.floor(index / 2) * 43 : 406 - Math.floor(index / 2) * 43, y: 147 + Math.floor(index / 2) * 50 };
      case 'column': return { x: 240 + (index % 2 === 0 ? -60 : 60), y: 95 + Math.floor(index / 2) * 57 };
      case 'line': return { x: 240 + centered * spacing, y: 176 + (index % 2) * 18 };
    }
  }

  private spawnWave(wave: Wave, waveIndex: number): void {
    const debris = wave.kind === 'debris';
    if (!this.bossSpawned) this.callbacks.onNotice(debris ? 'ASTEROIDS · WATCH THE ANGLES · DODGE & DESTROY' : `${wave.tier === 2 ? 'ELITE ' : wave.tier === 1 ? 'VETERAN ' : ''}${wave.formation.toUpperCase()} · WEAK TO ${getWeaponWeakness(wave.kind).toUpperCase()} · ${waveIndex + 1}/${this.level.waves.length + (this.level.boss ? 1 : 0)}`);
    // Scheduled waves only start on an empty field. Never truncate their hulls or rewards.
    const count = wave.count;
    const tier = debris ? 0 : wave.tier ?? 0;
    const tint = 0xffffff; // Hull paint is authored into each level's fleet textures.
    let drop = wave.drop;
    if (drop?.startsWith('weapon-')) {
      const available = WEAPON_CYCLE.filter(kind => kind !== this.weapon);
      drop = Math.random() < 0.5 ? `weapon-${available[Math.floor(Math.random() * available.length)]}` as PickupKind : undefined;
    } else if (drop === 'rapid' || drop === 'spread' || drop === 'damage') {
      if (Math.random() >= 0.4) drop = undefined;
    }
    const specialCarrier = Math.floor(count / 2);
    const arrayCarriers = new Set<number>();
    const arrays = clamp(Math.floor(wave.powerUpDrops ?? 0), 0, Math.max(0, count - (drop ? 1 : 0)));
    for (let i = 0; i < arrays; i++) {
      let carrier = Math.floor((i + 0.5) / arrays * count);
      while ((drop && carrier === specialCarrier) || arrayCarriers.has(carrier)) carrier = (carrier + 1) % count;
      arrayCarriers.add(carrier);
    }
    for (let i = 0; i < count; i++) {
      const target = this.formationTarget(wave, i);
      const side = i % 2 === 0 ? -1 : 1;
      const trajectory = debris ? createAsteroidTrajectory(i + waveIndex, 0, wave.speed) : undefined;
      const sx = trajectory?.sx ?? (wave.formation === 'pincer' || wave.formation === 'arc' ? 240 + side * 330 : target.x - side * 95);
      const sy = trajectory?.sy ?? -80 - i * 22;
      const sprite = this.add.image(sx, sy, this.enemyVisuals!.enemies[wave.kind]).setDepth(5).setDisplaySize((debris ? 64 : wave.kind === 'shooter' ? 59 : 51) * (1 + tier * 0.09), (debris ? 64 : wave.kind === 'shooter' ? 62 : 57) * (1 + tier * 0.09)).setTint(tint);
      this.enemies.push({ sprite, x: sx, y: sy, px: sx, py: sy, sx, sy, tx: trajectory?.tx ?? target.x, ty: trajectory?.ty ?? target.y, age: debris ? -GAME_CONFIG.asteroids.warningSeconds - i * GAME_CONFIG.asteroids.staggerSeconds : -i * 0.045, entry: debris ? 0 : 1.65 - tier * 0.12 + (i % 3) * 0.15, hold: debris ? 0 : wave.hold + i * 0.15, dive: debris, vx: trajectory?.vx ?? 0, vy: trajectory?.vy ?? 0, hp: wave.hp, maxHp: wave.hp, radius: (debris ? 25 : wave.kind === 'shooter' ? 20 : 17) * (1 + tier * 0.09), kind: wave.kind, phase: i * 0.9 + waveIndex * 2, shotAt: 2.4 + i * 0.2, flash: 0, speed: wave.speed, drop: arrayCarriers.has(i) ? 'multishot' : i === specialCarrier ? drop : undefined, boss: false, bossPhase: 0, attackAt: 0, telegraph: 0, attackAngle: 0, tier, tint, returns: 0, asteroidIndex: debris ? i + waveIndex : undefined, returnPattern: debris ? 'asteroid-crossing' : wave.kind === 'weaver' ? 'slalom' : wave.kind === 'shooter' ? 'crossing' : 'hook' });
    }
  }

  private spawnBoss(): void {
    const boss = this.level.boss!;
    const count = boss.count ?? 1;
    const kind = boss.kind ?? 'koschei';
    const tint = 0xffffff;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 240 : 132 + i * 216;
      const size = count > 1 ? 0.66 : kind === 'warden' ? 0.8 : 1;
      const sprite = this.add.image(x, -130, this.enemyVisuals!.bosses[kind]).setDepth(5).setDisplaySize((kind === 'lattice' ? 185 : kind === 'twins' ? 190 : 225) * size, (kind === 'lattice' ? 185 : 169) * size).setTint(tint);
      this.enemies.push({ sprite, x, y: -130, px: x, py: -130, sx: x, sy: -130, tx: x, ty: 143 + i * 45, age: 0, entry: 2.7, hold: 1e6, dive: false, vx: 0, vy: 0, hp: boss.hp, maxHp: boss.hp, radius: 66 * size, kind: 'shooter', phase: i, shotAt: 6.5 + i, flash: 0, speed: 0, boss: true, bossKind: kind, bossPhase: 1, attackAt: 4.5 + i * 0.9, telegraph: 0, attackAngle: Math.PI / 2, tier: 0, tint, returns: 0, returnPattern: 'crossing' });
    }
    this.bossTotalHp = boss.hp * count;
    this.bossSpawned = true;
    this.callbacks.onNotice(`WARNING · ${boss.name.toUpperCase()}`);
    this.emitHud();
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.px = enemy.x;
      enemy.py = enemy.y;
      enemy.age += dt;
      enemy.flash = Math.max(0, enemy.flash - dt);
      if (enemy.flash > 0) enemy.sprite.setTintFill(0xdbffff);
      else enemy.sprite.setTint(enemy.tint);
      enemy.sprite.setVisible(enemy.age >= 0);
      if (enemy.age < 0) continue;
      if (enemy.kind === 'debris') {
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        if (!this.preferences.reducedMotion) enemy.sprite.rotation += (Math.sin(enemy.phase) > 0 ? 1 : -1) * dt * 0.65;
      } else if (enemy.age < enemy.entry) {
        const t = clamp(enemy.age / enemy.entry, 0, 1);
        const ease = 1 - (1 - t) ** 3;
        enemy.x = Phaser.Math.Linear(enemy.sx, enemy.tx, ease) + Math.sin(t * Math.PI) * Math.sin(enemy.phase) * 42;
        enemy.y = Phaser.Math.Linear(enemy.sy, enemy.ty, ease);
      } else if (enemy.boss) {
        this.updateBoss(enemy, dt);
      } else if (enemy.age < enemy.entry + enemy.hold) {
        enemy.x = enemy.tx + Math.sin(enemy.age * 1.3 + enemy.phase) * 7;
        enemy.y = enemy.ty + Math.sin(enemy.age * 1.8 + enemy.phase) * 6;
      } else {
        if (!enemy.dive) {
          enemy.dive = true;
          // Return dives commit to an alternating lane instead of tracking the ship.
          const targetX = enemy.returns ? (enemy.tx < 240 ? 390 : 90) : clamp(this.player.x + Math.sin(enemy.phase) * 110, 20, 460);
          const aim = aimedVelocity(enemy.x, enemy.y, targetX, 840, enemy.speed);
          enemy.vx = aim.x;
          enemy.vy = Math.max(enemy.speed * 0.7, aim.y);
        }
        enemy.x += (enemy.vx + (enemy.kind === 'weaver' ? Math.cos((enemy.age - enemy.entry - enemy.hold) * 3.9 + enemy.phase) * 108 : 0)) * dt;
        enemy.y += enemy.vy * dt;
      }
      if (!enemy.boss && enemy.kind !== 'debris' && (enemy.kind === 'shooter' || enemy.tier > 0) && enemy.y > 40 && enemy.y < 615) {
        if (enemy.age >= enemy.shotAt - 0.45 && !enemy.telegraph) {
          enemy.telegraph = enemy.shotAt;
          enemy.attackAngle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        }
        if (enemy.age >= enemy.shotAt) {
          enemy.shotAt = enemy.age + Math.max(1.05, 2.75 - this.level.id * 0.17 - enemy.tier * 0.22);
          const speed = boundedProjectileSpeed(this.level.id, enemy.tier);
          const count = enemy.kind === 'shooter' ? 1 + enemy.tier : enemy.tier === 2 ? 2 : 1;
          for (let shot = 0; shot < count; shot++) {
            const angle = enemy.attackAngle + (shot - (count - 1) / 2) * 0.19;
            this.fireProjectile(enemy.x, enemy.y + 17, Math.cos(angle) * speed, Math.sin(angle) * speed, true, 1, 1, getEnemyShotShape(enemy.kind));
          }
          enemy.telegraph = 0;
          this.spark(enemy.x, enemy.y + 17, 0xff8291, 3, 60);
        }
      }
      if (!enemy.boss && enemy.kind !== 'debris') enemy.sprite.rotation = this.preferences.reducedMotion ? 0 : clamp((enemy.x - enemy.px) * 0.02, -0.22, 0.22);
      enemy.sprite.setPosition(enemy.x, enemy.y);
      if (!enemy.boss && enemy.dive && (enemy.y > 875 || enemy.y < -90 || enemy.x < -90 || enemy.x > 570)) this.returnEnemy(enemy);
    }
  }

  private returnEnemy(enemy: Enemy): void {
    enemy.returns++;
    const side = (Math.floor(enemy.phase) + enemy.returns) % 2 === 0 ? -1 : 1;
    if (enemy.kind === 'debris') {
      const trajectory = createAsteroidTrajectory(enemy.asteroidIndex ?? 0, enemy.returns, enemy.speed);
      Object.assign(enemy, trajectory);
      enemy.entry = 0;
      enemy.hold = 0;
      enemy.dive = true;
    } else {
      enemy.sx = enemy.kind === 'shooter' ? 240 + side * 300 : 240 + side * 168;
      enemy.sy = enemy.kind === 'shooter' ? 125 : -70;
      enemy.tx = 240 - side * (enemy.kind === 'weaver' ? 116 : 86);
      enemy.ty = enemy.kind === 'shooter' ? 215 : 150;
      enemy.entry = enemy.kind === 'shooter' ? 1.9 : 1.5;
      enemy.hold = 0.9;
      enemy.dive = false;
    }
    enemy.age = -(enemy.kind === 'debris' ? GAME_CONFIG.asteroids.warningSeconds : 0.95) - (Math.floor(enemy.phase) % 3) * 0.12;
    enemy.x = enemy.px = enemy.sx;
    enemy.y = enemy.py = enemy.sy;
    if (enemy.kind !== 'debris') enemy.vx = enemy.vy = 0;
    enemy.shotAt = enemy.entry + 1.15;
    enemy.telegraph = 0;
    enemy.sprite.setPosition(enemy.x, enemy.y).setVisible(false);
  }

  private updateBoss(enemy: Enemy, _dt: number): void {
    const phase = enemy.hp > enemy.maxHp * 0.58 ? 1 : enemy.hp > enemy.maxHp * 0.28 ? 2 : 3;
    if (phase > enemy.bossPhase) {
      enemy.bossPhase = phase;
      this.callbacks.onNotice(phase === 2 ? 'SIGNAL SURGE · ATTACK PATTERN SHIFT' : 'CORE EXPOSED · WEAPONS ACCELERATING');
      this.explode(enemy.x, enemy.y, 0xffba71, true);
    }
    const paired = (this.level.boss?.count ?? 1) > 1;
    enemy.x = enemy.tx + Math.sin((enemy.age - enemy.entry) * (paired ? 0.9 : 0.62) + (enemy.tx > 240 ? Math.PI : 0)) * (paired ? 69 : phase === 3 ? 132 : 105);
    enemy.y = enemy.ty + Math.sin(enemy.age * 0.8) * 17;
    if (enemy.bossKind === 'carrier' && enemy.age >= enemy.shotAt) {
      if (this.enemies.length + 2 + phase <= LIMITS.enemies) {
        enemy.shotAt = enemy.age + 8.5;
        this.callbacks.onNotice('CARRIER BAY OPEN · INTERCEPT DRONES');
        this.spawnWave({ at: 0, kind: phase === 3 ? 'weaver' : 'straight', formation: 'pincer', count: 2 + phase, hp: 3 + phase, speed: 160 + phase * 12, hold: 1, tier: 1 }, this.waveIndex);
      } else enemy.shotAt = enemy.age + 1;
    }
    if (!enemy.attackPlan && enemy.age >= enemy.attackAt) {
      enemy.attackPlan = createGuardianAttack({
        kind: enemy.bossKind ?? 'koschei', phase, cycle: enemy.attackCycle ?? 0,
        x: enemy.x, y: enemy.y + enemy.radius * 0.72,
        playerX: this.player.x, playerY: this.player.y, side: enemy.tx < 240 ? -1 : 1,
      });
      enemy.telegraph = enemy.age + enemy.attackPlan.warningSeconds;
      this.callbacks.onNotice(enemy.attackPlan.name.toUpperCase());
    }
    const plan = enemy.attackPlan;
    if (!plan || enemy.age < enemy.telegraph) return;
    for (const shot of plan.shots) {
      this.fireProjectile(shot.x, shot.y, shot.vx, shot.vy, true, 1, 1,
        (shot.shape as ProjectileShape) ?? getEnemyShotShape(enemy.bossKind ?? 'koschei'), shot);
    }
    for (const portal of plan.portals ?? []) this.guardianPortals.push({ ...portal, expiresAt: this.elapsed + 2.4 });
    this.spark(enemy.x, enemy.y + 45, 0xff506d, 8, 90);
    enemy.attackAt = enemy.age + plan.recoverySeconds;
    enemy.attackCycle = (enemy.attackCycle ?? 0) + 1;
    enemy.attackPlan = undefined;
    enemy.telegraph = 0;
  }

  private drawBossTelegraph(): void {
    this.bossTelegraph.clear();
    this.guardianPortals = this.guardianPortals.filter(portal => portal.expiresAt > this.elapsed);
    for (const portal of this.guardianPortals) this.drawPortal(portal, Math.min(1, (portal.expiresAt - this.elapsed) / 0.5));
    // Black holes are part of the encounter itself. Predicted routes, impact
    // zones and safe lanes belong exclusively to the optional aiming guides.
    for (const enemy of this.enemies) {
      for (const portal of enemy.attackPlan?.portals ?? []) this.drawPortal(portal);
    }
    if (!this.preferences.trainingWheels) return;
    for (const bullet of this.bullets) {
      if (!bullet.trajectory?.burstAfter) continue;
      const center = sampleGuardianShot(bullet.trajectory, bullet.trajectory.burstAfter);
      this.bossTelegraph.lineStyle(1, 0xffb873, 0.4).strokeCircle(center.x, center.y, 80);
      this.bossTelegraph.lineStyle(2, 0xffcc85, 0.8).strokeCircle(bullet.x, bullet.y, 11 + 12 * Math.max(0, bullet.trajectory.burstAfter - bullet.age));
    }
    for (const enemy of this.enemies) {
      if (enemy.age < 0 && enemy.age >= -GAME_CONFIG.asteroids.warningSeconds && (enemy.returns > 0 || enemy.kind === 'debris')) {
        const g = this.bossTelegraph;
        const color = enemy.kind === 'debris' ? 0xffcc85 : 0x91e9ff;
        let x = clamp(enemy.sx, 16, 464), y = clamp(enemy.sy, 24, 775);
        if (enemy.kind === 'debris') {
          const dx = enemy.tx - enemy.sx, dy = enemy.ty - enemy.sy;
          const toEdge = enemy.sx < 0 ? (16 - enemy.sx) / dx : enemy.sx > 480 ? (464 - enemy.sx) / dx : (24 - enemy.sy) / dy;
          x = enemy.sx + dx * toEdge;
          y = enemy.sy + dy * toEdge;
        }
        g.lineStyle(2, color, 0.75).strokeCircle(x, y, 12);
        g.lineStyle(1, color, 0.4);
        if (enemy.kind === 'debris') {
          // The warning uses the same committed vector as movement, including
          // side entries. Thin borders show the entire collision corridor.
          const length = Math.hypot(enemy.tx - enemy.sx, enemy.ty - enemy.sy);
          const ux = (enemy.tx - enemy.sx) / length, uy = (enemy.ty - enemy.sy) / length;
          const width = enemy.radius + 5;
          const nx = -uy * width, ny = ux * width;
          g.lineStyle(width * 2, color, 0.045).lineBetween(enemy.sx, enemy.sy, enemy.tx, enemy.ty);
          g.lineStyle(1, color, 0.4)
            .lineBetween(enemy.sx + nx, enemy.sy + ny, enemy.tx + nx, enemy.ty + ny)
            .lineBetween(enemy.sx - nx, enemy.sy - ny, enemy.tx - nx, enemy.ty - ny);
          for (const fraction of [0.25, 0.5, 0.75]) {
            const ax = enemy.sx + ux * length * fraction, ay = enemy.sy + uy * length * fraction;
            g.lineBetween(ax - ux * 13 - uy * 7, ay - uy * 13 + ux * 7, ax, ay)
              .lineBetween(ax - ux * 13 + uy * 7, ay - uy * 13 - ux * 7, ax, ay);
          }
        } else {
          // Same parametric curve as entry movement, so the warning predicts the route.
          let previousX = enemy.sx, previousY = enemy.sy;
          for (let step = 1; step <= 14; step++) {
            const t = step / 14, ease = 1 - (1 - t) ** 3;
            const nextX = Phaser.Math.Linear(enemy.sx, enemy.tx, ease) + Math.sin(t * Math.PI) * Math.sin(enemy.phase) * 42;
            const nextY = Phaser.Math.Linear(enemy.sy, enemy.ty, ease);
            g.lineBetween(previousX, previousY, nextX, nextY);
            previousX = nextX; previousY = nextY;
          }
          g.strokeCircle(enemy.tx, enemy.ty, enemy.radius + 5);
        }
      }
      if (enemy.attackPlan) {
        this.drawGuardianPlan(enemy.attackPlan);
        continue;
      }
      if (!enemy.telegraph) continue;
      const timeLeft = enemy.telegraph - enemy.age;
      const alpha = this.preferences.reducedMotion ? 0.32 : 0.2 + Math.sin(timeLeft * 20) ** 2 * 0.15;
      this.bossTelegraph.lineStyle(1, enemy.boss ? 0xffc26c : 0xff738b, alpha);
      const originY = enemy.y + 17;
      this.bossTelegraph.lineBetween(enemy.x, originY, enemy.x + Math.cos(enemy.attackAngle) * 900, originY + Math.sin(enemy.attackAngle) * 900);
      this.bossTelegraph.lineStyle(enemy.boss ? 2 : 1, 0xffbf75, 0.75).strokeCircle(enemy.x, enemy.y + (enemy.boss ? 40 : 17), (enemy.boss ? 10 : 4) + Math.max(0, timeLeft) * 12);
    }
  }

  private drawPortal(portal: { x: number; y: number; radius: number }, alpha = 1): void {
    const g = this.bossTelegraph;
    g.fillStyle(0x080612, alpha * 0.94).fillCircle(portal.x, portal.y, portal.radius);
    g.lineStyle(6, 0x9369ff, alpha * 0.23).strokeEllipse(portal.x, portal.y, portal.radius * 2.7, portal.radius * 1.15);
    g.lineStyle(2, 0xd4b2ff, alpha * 0.9).strokeCircle(portal.x, portal.y, portal.radius);
    g.lineStyle(1, 0xffafdb, alpha * 0.55).strokeEllipse(portal.x, portal.y, portal.radius * 2.6, portal.radius * 0.95);
  }

  private drawGuardianPlan(plan: GuardianPlan): void {
    const g = this.bossTelegraph;
    const alpha = this.preferences.reducedMotion ? 0.35 : 0.25 + Math.sin(this.elapsed * 5) ** 2 * 0.1;
    if (plan.safeLane) {
      g.fillStyle(0x79e8c6, 0.035).fillRect(plan.safeLane.x - plan.safeLane.width / 2, 250, plan.safeLane.width, 550);
      g.lineStyle(1, 0x79e8c6, 0.55).strokeRect(plan.safeLane.x - plan.safeLane.width / 2, 250, plan.safeLane.width, 550);
    }
    for (const shot of plan.shots) {
      let previous = sampleGuardianShot(shot, 0);
      g.lineStyle(1, 0xff9b9f, alpha);
      const until = shot.burstAfter ?? Math.min(4.5, shot.lifetime ?? 7);
      for (let t = 0.12; t <= until; t += 0.12) {
        const next = sampleGuardianShot(shot, t);
        g.lineBetween(previous.x, previous.y, next.x, next.y);
        previous = next;
      }
      g.strokeCircle(shot.x, shot.y, 9);
      if (shot.burstAfter) {
        const center = sampleGuardianShot(shot, shot.burstAfter);
        g.lineStyle(1, 0xffb873, 0.55).strokeCircle(center.x, center.y, 80);
      }
    }
  }

  private fireProjectile(x: number, y: number, vx: number, vy: number, hostile: boolean, damage: number, pierce = 1,
    shape: ProjectileShape = hostile ? 'orb' : getPlayerShotShape(this.shipId, this.weapon), trajectory?: GuardianShot): void {
    let count = 0;
    for (const bullet of this.bullets) if (bullet.hostile === hostile) count++;
    if (count >= (hostile ? LIMITS.hostile : LIMITS.friendly)) return;
    const style = getProjectileStyle(shape);
    const color = hostile ? shape === 'pincer' ? 0xff95cf : shape === 'mine' ? 0xffc176 : 0xff7c83
      : this.weapon === 'lance' ? 0xcba2ff : this.weapon === 'scatter' ? 0xffc27b : 0x9bf2ff;
    const sprite = this.add.image(x, y, style.texture).setDepth(hostile ? 8 : 4)
      .setDisplaySize(style.width, style.height).setTint(color);
    if (style.rotates) sprite.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    this.bullets.push({ sprite, x, y, px: x, py: y, vx, vy, radius: hostile ? trajectory?.radius ?? style.radius : 4,
      damage, weapon: this.weapon, age: 0, hostile, pierce, hitEnemies: new Set(), shape,
      trajectory: trajectory ? { ...trajectory } : undefined, lifetime: trajectory?.lifetime ?? 9 });
  }

  private updateProjectiles(dt: number, collisions = true): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.px = bullet.x;
      bullet.py = bullet.y;
      bullet.age += dt;
      if (bullet.trajectory) {
        Object.assign(bullet, sampleGuardianShot(bullet.trajectory, bullet.age));
      } else {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
      }
      bullet.sprite.setPosition(bullet.x, bullet.y);
      if (getProjectileStyle(bullet.shape).rotates) bullet.sprite.setRotation(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
      let consumed = bullet.x < -40 || bullet.x > 520 || bullet.y < -50 || bullet.y > 850 || bullet.age > bullet.lifetime;
      if (!consumed && bullet.trajectory?.burstAfter && bullet.age >= bullet.trajectory.burstAfter) {
        consumed = true;
        for (let shard = 0; shard < 8; shard++) {
          const angle = shard / 8 * Math.PI * 2 + Math.PI / 8;
          this.fireProjectile(bullet.x, bullet.y, Math.cos(angle) * 165, Math.sin(angle) * 165, true, 1, 1, 'shard');
        }
        this.spark(bullet.x, bullet.y, 0xffc176, 6, 60);
      }
      if (!consumed && collisions && bullet.hostile) {
        if (this.invulnerable <= 0 && segmentCircleHit(bullet.px - this.playerPrev.x, bullet.py - this.playerPrev.y, bullet.x - this.player.x, bullet.y - this.player.y, 0, 0, 13 + bullet.radius)) {
          consumed = true;
          this.damagePlayer();
          if (this.mode !== 'combat') { bullet.sprite.destroy(); this.bullets.splice(i, 1); return; }
        }
      } else if (!consumed && collisions) {
        for (let e = this.enemies.length - 1; e >= 0; e--) {
          const enemy = this.enemies[e];
          if (bullet.hitEnemies.has(enemy) || enemy.age < 0 || enemy.y < -25 || !segmentCircleHit(bullet.px - enemy.px, bullet.py - enemy.py, bullet.x - enemy.x, bullet.y - enemy.y, 0, 0, enemy.radius + bullet.radius)) continue;
          bullet.hitEnemies.add(enemy);
          consumed = --bullet.pierce <= 0;
          const effectiveness = getDamageMultiplier(enemy.bossKind ?? enemy.kind, bullet.weapon);
          enemy.hp -= bullet.damage * effectiveness;
          enemy.flash = 0.06;
          this.spark(bullet.x, bullet.y, effectiveness > 1 ? 0xffdc89 : 0x9ef6ff, effectiveness > 1 ? 5 : 2, 68);
          if (enemy.hp <= 0) this.destroyEnemy(e);
          if (consumed) break;
        }
      }
      if (consumed) { bullet.sprite.destroy(); this.bullets.splice(i, 1); }
    }
    if (collisions && this.invulnerable <= 0) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (enemy.age < 0) continue;
        if (!segmentCircleHit(enemy.px - this.playerPrev.x, enemy.py - this.playerPrev.y, enemy.x - this.player.x, enemy.y - this.player.y, 0, 0, enemy.radius + 12)) continue;
        this.damagePlayer();
        break;
      }
    }
  }

  private damagePlayer(): void {
    if (this.invulnerable > 0 || this.mode !== 'combat') return;
    this.hp = Math.max(0, this.hp - 1);
    this.invulnerable = this.stats.hitRecovery;
    this.callbacks.onSound('hit');
    this.explode(this.player.x, this.player.y, 0x91efff, false);
    if (!this.preferences.reducedMotion) this.cameras.main.shake(110, 0.004, true);
    this.emitHud();
    if (this.hp <= 0) {
      this.beginPlayerExplosion();
    }
  }

  private beginPlayerExplosion(): void {
    this.mode = 'dying';
    this.deathElapsed = 0;
    this.deathOrigin = { x: this.player.x, y: this.player.y };
    this.pointerAnchor = null;
    this.input.keyboard?.resetKeys();
    this.player.setVisible(false);
    this.engineLeft.setVisible(false);
    this.engineRight.setVisible(false);
    this.shield.setVisible(false);
    this.bossTelegraph.clear();
    this.callbacks.onSound('explosion');
    this.drawPlayerExplosion();
  }

  private drawPlayerExplosion(): void {
    const g = this.playerExplosion.clear();
    const { x, y } = this.deathOrigin;
    const still = this.preferences.reducedMotion;
    const progress = clamp(this.deathElapsed / DEATH_SECONDS, 0, 1);
    const expansion = still ? 0.35 : 1 - (1 - progress) ** 3;
    const alpha = still ? 0.8 : 1 - progress;
    // This dedicated burst stays visible even if combat has filled the particle budget.
    g.fillStyle(0xff6b35, alpha * 0.18).fillCircle(x, y, 26 + expansion * 42);
    g.fillStyle(0xffad55, alpha * 0.6).fillCircle(x, y, 17 + expansion * 13);
    g.fillStyle(0xffefd0, alpha).fillCircle(x, y, Math.max(3, 14 * (1 - expansion)));
    g.lineStyle(3, 0xffc783, alpha * 0.8).strokeCircle(x, y, 22 + expansion * 72);
    g.lineStyle(1, 0xff734d, alpha * 0.6).strokeCircle(x, y, 14 + expansion * 52);
    for (let shard = 0; shard < 12; shard++) {
      const angle = shard / 12 * Math.PI * 2 + 0.17;
      const radius = 19 + expansion * (45 + shard % 3 * 17);
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const sx = x + dx * radius, sy = y + dy * radius;
      g.lineStyle(shard % 3 === 0 ? 4 : 2, shard % 3 === 0 ? 0x9fe6e8 : 0xffca85, alpha);
      g.lineBetween(sx, sy, sx + dx * 11, sy + dy * 11);
      if (shard % 3 === 0) {
        g.fillStyle(0xd8e3e2, alpha).fillTriangle(sx, sy, sx - dy * 5 - dx * 7, sy + dx * 5 - dy * 7, sx + dy * 4 - dx * 6, sy - dx * 4 - dy * 6);
      }
    }
  }

  private destroyEnemy(index: number): void {
    const enemy = this.enemies[index];
    this.kills++;
    this.score = Math.min(MAX_SCORE, this.score + (enemy.boss ? 5000 : enemy.kind === 'debris' ? 75 : enemy.kind === 'shooter' ? 180 : enemy.kind === 'weaver' ? 140 : 100));
    this.explode(enemy.x, enemy.y, enemy.boss ? 0xffdf92 : enemy.kind === 'debris' ? 0xd6b38a : 0xff8375, enemy.boss);
    this.callbacks.onSound('explosion');
    if (enemy.drop) this.spawnPickup(enemy.x, enemy.y, enemy.drop);

    enemy.sprite.destroy();
    this.enemies.splice(index, 1);
    if (enemy.boss && !this.enemies.some(other => other.boss)) {
      this.bossDefeated = true;
      if (this.shipParts < SHIP_PARTS_REQUIRED && Math.random() < SHIP_PART_DROP_CHANCE) this.spawnPickup(enemy.x, enemy.y, 'ship-part');
    }
  }

  private spawnPickup(x: number, y: number, kind: PickupKind): void {
    if (this.pickups.length >= LIMITS.pickups || (kind === 'ship-part' && this.shipParts >= SHIP_PARTS_REQUIRED)) return;
    const color = PICKUP_COLORS[kind];
    const ring = this.add.rectangle(0, 0, 28, 28, 0x111b2b, 0.96).setStrokeStyle(2, color).setRotation(Math.PI / 4);
    const inner = this.add.rectangle(0, 0, 20, 20, color, 0.07).setRotation(Math.PI / 4);
    const text = this.add.text(0, 0, PICKUP_LABELS[kind], { fontFamily: 'monospace', fontSize: '19px', fontStyle: 'bold', color: '#' + color.toString(16).padStart(6, '0') }).setOrigin(0.5, 0.48);
    const sprite = this.add.container(x, y, [ring, inner, text]).setDepth(9);
    if (kind === 'supercharge') {
      ring.setSize(34, 34).setStrokeStyle(3, color);
      inner.setSize(25, 25);
      text.setFontSize(25);
    }
    this.pickups.push({ sprite, x, y, px: x, py: y, age: 0, kind, phase: this.elapsed * 3 });
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.px = pickup.x;
      pickup.py = pickup.y;
      pickup.age += dt;
      const distance = Math.hypot(this.player.x - pickup.x, this.player.y - pickup.y);
      const magnetized = this.salvageStarted || distance < 142 || pickup.age > 7.5 || pickup.y > 735;
      if (magnetized && distance > 0) {
        const travel = Math.min(distance, (this.salvageStarted ? 680 : 180 + (142 - Math.min(distance, 142)) * 2) * dt);
        pickup.x += (this.player.x - pickup.x) / distance * travel;
        pickup.y += (this.player.y - pickup.y) / distance * travel;
      } else {
        pickup.y += 57 * dt;
        pickup.x += Math.sin(pickup.age * 2 + pickup.phase) * 12 * dt;
      }
      pickup.sprite.setPosition(pickup.x, pickup.y).setScale(this.preferences.reducedMotion ? 1 : 1 + Math.sin(pickup.age * 4) * 0.045);
      const collected = segmentCircleHit(pickup.px - this.playerPrev.x, pickup.py - this.playerPrev.y, pickup.x - this.player.x, pickup.y - this.player.y, 0, 0, 37);
      if (collected) {
        this.applyPickup(pickup.kind);
        this.spark(pickup.x, pickup.y, PICKUP_COLORS[pickup.kind], 12, 140);
      }
      if (collected) { pickup.sprite.destroy(); this.pickups.splice(i, 1); }
    }
  }

  private applyPickup(kind: PickupKind): void {
    if (kind === 'health') this.hp = Math.min(this.stats.maxHp, this.hp + 2);
    else if (kind === 'multishot') this.multishot = addWeaponPower(this.multishot);
    else if (kind === 'ship-part') {
      if (this.shipParts >= SHIP_PARTS_REQUIRED) return;
      this.shipParts++;
      this.callbacks.onShipPart();
    } else if (kind.startsWith('weapon-')) this.weapon = kind.slice(7) as WeaponKind;
    else this.buffs[kind] = this.elapsed + (kind === 'supercharge' ? GAME_CONFIG.pickups.supercharge.durationSeconds : BUFF_SECONDS);
    this.score = Math.min(MAX_SCORE, this.score + 25);
    this.callbacks.onSound('pickup');
    // The persistence callback owns fragment progress and the unlock announcement.
    if (kind !== 'ship-part') this.callbacks.onNotice(kind === 'multishot' ? `WEAPON POWER ${this.multishot}/${MAX_WEAPON_POWER}${this.multishot === MAX_WEAPON_POWER ? ' · MAX' : ''} · ${this.projectileCount()} SHOTS · ${getWeaponPower(this.multishot).damageMultiplier.toFixed(2)}× BLAST` : PICKUP_NAMES[kind]);
    this.emitHud();
  }

  private spark(x: number, y: number, color: number, count: number, speed: number): void {
    if (this.preferences.reducedMotion) count = Math.min(count, 3);
    const available = Math.min(count, LIMITS.effects - this.effects.length);
    for (let i = 0; i < available; i++) {
      const angle = i / Math.max(1, available) * Math.PI * 2 + this.elapsed * 2.7;
      const velocity = speed * (0.45 + ((i * 17) % 11) / 20);
      const life = 0.2 + (i % 4) * 0.07;
      const scale = 0.35 + (i % 3) * 0.19;
      const sprite = this.add.image(x, y, 'spark').setTint(color).setScale(scale).setDepth(10);
      this.effects.push({ sprite, x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, age: 0, life, scale, rotation: 0 });
    }
  }

  private explode(x: number, y: number, color: number, big: boolean): void {
    this.spark(x, y, color, big ? 28 : 12, big ? 220 : 150);
    if (this.effects.length < LIMITS.effects) {
      const sprite = this.add.image(x, y, 'ring').setTint(color).setDepth(10).setScale(big ? 0.7 : 0.35);
      this.effects.push({ sprite, x, y, vx: 0, vy: 0, age: 0, life: big ? 0.65 : 0.35, scale: big ? 2.6 : 1.2, rotation: 1 });
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += dt;
      const progress = effect.age / effect.life;
      if (progress >= 1) { effect.sprite.destroy(); this.effects.splice(i, 1); continue; }
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.sprite.setPosition(effect.x, effect.y).setAlpha(1 - progress);
      if (effect.rotation === 1) effect.sprite.setScale(effect.scale * (0.15 + progress));
      else effect.sprite.setScale(effect.scale * (1 - progress * 0.7));
    }
  }

  private emitHud(): void {
    const bosses = this.enemies.filter(enemy => enemy.boss);
    const bossHp = bosses.reduce((sum, boss) => sum + Math.max(0, boss.hp), 0);
    const state: HudState = {
      level: this.level.id, score: this.score, hp: this.hp, maxHp: this.stats.maxHp,
      shipId: this.shipId, weapon: this.weapon, multishot: this.multishot, projectiles: this.projectileCount(),
      weaponPower: this.multishot, effectiveWeaponPower: this.effectiveWeaponPower(), blastMultiplier: getProjectileDamageMultiplier(this.effectiveWeaponPower(), Boolean(this.buffs.spread)), shipParts: this.shipParts,
      buffs: Object.fromEntries(Object.entries(this.buffs).map(([kind, expiry]) => [kind, Math.max(0, expiry! - this.elapsed)])),
      progress: this.bossSpawned ? 0.75 + (1 - bossHp / Math.max(1, this.bossTotalHp)) * 0.25 : Math.min(0.74, this.waveIndex / Math.max(1, this.level.waves.length) * 0.74),
      wave: this.waveIndex + (this.bossSpawned ? 1 : 0), totalWaves: this.level.waves.length + (this.level.boss ? 1 : 0),
      waveKind: this.bossSpawned ? 'guardian' : this.level.waves[Math.max(0, this.waveIndex - 1)]?.kind === 'debris' ? 'debris' : 'combat',
      ...(bosses.length ? { bossHp, bossMaxHp: this.bossTotalHp, bossName: this.level.boss?.name } : {}),
    };
    this.callbacks.onHud(state);
  }

  private finish(type: 'complete' | 'defeat'): void {
    if (type === 'defeat' ? this.mode !== 'dying' : this.mode !== 'combat') return;
    this.mode = 'ended';
    this.playerExplosion.clear();
    this.pointerAnchor = null;
    this.input.keyboard?.resetKeys();
    if (type === 'complete') {
      this.score = Math.min(MAX_SCORE, this.score + 500 + this.hp * 100);
      this.bossTelegraph.clear();
    }
    this.emitHud();
    this.callbacks.onSound(type === 'complete' ? 'complete' : 'defeat');
    this.callbacks.onOutcome({ type, level: this.level.id, score: this.score, hp: this.hp, maxHp: this.stats.maxHp, kills: this.kills });
  }

  private clearRun(): void {
    for (const array of [this.bullets, this.enemies, this.pickups, this.effects]) {
      for (const entity of array) entity.sprite.destroy();
      array.length = 0;
    }
    this.bossTelegraph?.clear();
    this.guardianPortals.length = 0;
    this.playerExplosion?.clear();
    this.deathElapsed = 0;
    this.pointerAnchor = null;
    this.input.keyboard?.resetKeys();
  }

  public getDebugState(): object {
    return {
      mode: this.mode, deathElapsed: this.deathElapsed, deathExplosion: this.mode === 'dying', trainingWheels: this.preferences.trainingWheels === true,
      level: this.level.id, hp: this.hp, maxHp: this.stats.maxHp, shipId: this.shipId, loadout: this.loadout,
      appearance: { ...this.visual, textures: this.enemyVisuals ? { ...this.enemyVisuals.enemies, ...this.enemyVisuals.bosses } : {} },
      weapon: this.weapon, multishot: this.multishot, weaponPower: this.multishot, effectiveWeaponPower: this.effectiveWeaponPower(),
      blastMultiplier: getProjectileDamageMultiplier(this.effectiveWeaponPower(), Boolean(this.buffs.spread)), projectiles: this.projectileCount(),
      stats: this.stats, shipParts: this.shipParts, bossSpawned: this.bossSpawned, bossDefeated: this.bossDefeated,
      salvageStarted: this.salvageStarted, score: this.score, kills: this.kills, elapsed: this.elapsed,
      wave: this.waveIndex + (this.bossSpawned ? 1 : 0), completedWaves: this.completedWaves, waveClearAt: this.waveClearAt,
      waveKind: this.bossSpawned ? 'guardian' : this.level.waves[Math.max(0, this.waveIndex - 1)]?.kind === 'debris' ? 'debris' : 'combat',
      totalWaves: this.level.waves.length + (this.level.boss ? 1 : 0),
      asteroidWaves: this.level.waves.filter(wave => wave.kind === 'debris').length,
      waves: this.level.waves.map(wave => ({ kind: wave.kind, count: wave.count, powerUpDrops: wave.powerUpDrops ?? 0 })),
      player: { x: this.player?.x, y: this.player?.y, visible: this.player?.visible }, invulnerable: this.invulnerable, buffs: { ...this.buffs },
      enemies: this.enemies.map(enemy => ({ x: enemy.x, y: enemy.y, px: enemy.px, py: enemy.py, hp: enemy.hp, maxHp: enemy.maxHp,
        sx: enemy.sx, sy: enemy.sy, tx: enemy.tx, ty: enemy.ty, vx: enemy.vx, vy: enemy.vy,
        boss: enemy.boss, kind: enemy.kind, tier: enemy.tier, bossKind: enemy.bossKind, phase: enemy.bossPhase, attack: enemy.attackPlan?.name, attackCycle: enemy.attackCycle ?? 0, texture: enemy.sprite.texture.key,
        telegraph: enemy.telegraph, drop: enemy.drop, age: enemy.age, dive: enemy.dive,
        returns: enemy.returns, returning: enemy.returns > 0 && enemy.age < 0, returnPattern: enemy.returnPattern,
        warningSeconds: Math.max(0, -enemy.age), weakness: getWeaponWeakness(enemy.bossKind ?? enemy.kind) })),
      bullets: { friendly: this.bullets.filter(bullet => !bullet.hostile).length, hostile: this.bullets.filter(bullet => bullet.hostile).length },
      friendlyShots: this.bullets.filter(bullet => !bullet.hostile).map(bullet => ({ x: bullet.x, y: bullet.y, weapon: bullet.weapon, damage: bullet.damage, pierce: bullet.pierce, shape: bullet.shape, texture: bullet.sprite.texture.key })),
      hostileShots: this.bullets.filter(bullet => bullet.hostile).map(bullet => ({ x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy, age: bullet.age, shape: bullet.shape, texture: bullet.sprite.texture.key, burstAfter: bullet.trajectory?.burstAfter })),
      guardianPortals: this.guardianPortals.map(portal => ({ ...portal })),
      pickups: this.pickups.map(pickup => ({ x: pickup.x, y: pickup.y, kind: pickup.kind })), effects: this.effects.length, limits: LIMITS, runSerial: this.runSerial,
    };
  }

  /** Development-only scenarios let browser tests exercise real update/collision paths. */
  public debug(action: string, payload: Record<string, unknown> = {}): void {
    if (!import.meta.env.DEV || !this.ready) return;
    if (action === 'holdFire') this.nextFire = payload.enabled === false ? this.elapsed : Infinity;
    if (action === 'startWave') {
      for (const array of [this.enemies, this.bullets, this.pickups]) {
        for (const entity of array) entity.sprite.destroy();
        array.length = 0;
      }
      const index = clamp(Math.floor(Number(payload.index) || 0), 0, this.level.waves.length - 1);
      this.waveIndex = index + 1;
      this.completedWaves = index;
      this.waveClearAt = null;
      this.bossSpawned = this.bossDefeated = this.salvageStarted = false;
      this.elapsed = Math.max(this.elapsed, this.level.waves[index].at);
      this.spawnWave(this.level.waves[index], index);
      this.emitHud();
    }
    if (action === 'returnEnemy') {
      const enemy = this.enemies[Number(payload.index) || 0];
      if (enemy && !enemy.boss) this.returnEnemy(enemy);
    }
    if (action === 'clearWave') {
      for (let i = this.enemies.length - 1; i >= 0; i--) this.destroyEnemy(i);
    }
    if (action === 'pickup') this.spawnPickup(this.player.x, this.player.y, (payload.kind as PickupKind) || 'rapid');
    if (action === 'spawnPickup') this.spawnPickup(Number(payload.x) || 240, Number(payload.y) || 200, (payload.kind as PickupKind) || 'multishot');
    if (action === 'boss' && this.level.boss && !this.bossSpawned) {
      for (const enemy of this.enemies) enemy.sprite.destroy();
      this.enemies.length = 0;
      this.waveIndex = this.level.waves.length;
      this.spawnBoss();
    }
    if (action === 'killBoss') {
      const bosses = this.enemies.filter(enemy => enemy.boss);
      const boss = bosses[Number(payload.index) || 0];
      if (boss) this.destroyEnemy(this.enemies.indexOf(boss));
    }
    if (action === 'destroyBoss') {
      for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].boss) this.destroyEnemy(i);
    }
    if (action === 'invulnerable') this.invulnerable = Number(payload.seconds) || 120;
    if (action === 'fire') { this.nextFire = this.elapsed; this.updatePlayer(0); }
    if (action === 'damage') {
      this.invulnerable = 0;
      this.fireProjectile(this.player.x, this.player.y - 34, 0, 500, true, 1);
    }
    if (action === 'defeat') { this.hp = 1; this.invulnerable = 0; this.fireProjectile(this.player.x, this.player.y - 34, 0, 500, true, 1); }
    if (action === 'clear') {
      for (let i = this.enemies.length - 1; i >= 0; i--) this.destroyEnemy(i);
      this.elapsed = Math.max(this.elapsed, (this.level.waves.at(-1)?.at ?? 0) + 0.1);
      while (this.waveIndex < this.level.waves.length) {
        this.spawnWave(this.level.waves[this.waveIndex], this.waveIndex);
        this.waveIndex++;
      }
      for (let i = this.enemies.length - 1; i >= 0; i--) this.destroyEnemy(i);
      this.completedWaves = this.waveIndex;
      this.waveClearAt = this.elapsed - 1;
    }
    if (action === 'enemy' || action === 'spawnEnemy') {
      this.spawnWave({ at: 0, kind: (payload.kind as EnemyKind) || 'straight', formation: 'line', count: 1, hp: Number(payload.hp) || 2, speed: 70, hold: 5 }, this.waveIndex);
      const enemy = this.enemies.at(-1)!;
      enemy.x = enemy.px = enemy.tx = this.player.x;
      enemy.y = enemy.py = enemy.ty = this.player.y - 160;
      enemy.age = enemy.entry + 0.1;
      enemy.sprite.setPosition(enemy.x, enemy.y);
    }
    if (action === 'spawnEnemyBullet') this.fireProjectile(Number(payload.x) || this.player.x, Number(payload.y) || this.player.y - 80, Number(payload.vx) || 0, Number(payload.vy) || 250, true, 1);
    if (action === 'setPlayer') {
      this.player.setPosition(clamp(Number(payload.x) || 240, ARENA.minX, ARENA.maxX), clamp(Number(payload.y) || 654, ARENA.minY, ARENA.maxY));
      this.playerPrev = { x: this.player.x, y: this.player.y };
    }
    if (action === 'expireBuffs') {
      for (const kind of ['rapid', 'spread', 'damage', 'supercharge'] as PickupKind[]) if (this.buffs[kind]) this.buffs[kind] = this.elapsed;
      this.updatePlayer(0);
      this.emitHud();
    }
    if (action === 'complete') this.finish('complete');
    if (action === 'advance') {
      const seconds = clamp(Number(payload.seconds) || 1, 0, 30);
      for (let t = 0; t < seconds && (this.mode === 'combat' || this.mode === 'dying'); t += 1 / 60) this.update(0, 1000 / 60);
    }
  }
}
