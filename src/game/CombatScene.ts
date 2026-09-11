import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import { SHIPS, getShipStats, defaultLoadout, SHIP_PARTS_REQUIRED, SHIP_PART_DROP_CHANCE, PLAYER_MAX_HP } from '../data/ships';
import type { Checkpoint, CombatCallbacks, EnemyKind, HudState, Level, PickupKind, Preferences, ShipId, ShipLoadout, WeaponKind, Wave } from './types';
import { aimedVelocity, ARENA, clamp, moveRelative, segmentCircleHit } from './math';

type Sprite = Phaser.GameObjects.Image;
type Projectile = { sprite: Sprite; x: number; y: number; px: number; py: number; vx: number; vy: number; radius: number; damage: number; age: number; hostile: boolean; pierce: number; hitEnemies: Set<Enemy> };
type Enemy = { sprite: Sprite; x: number; y: number; px: number; py: number; sx: number; sy: number; tx: number; ty: number; age: number; entry: number; hold: number; dive: boolean; vx: number; vy: number; hp: number; maxHp: number; radius: number; kind: EnemyKind; phase: number; shotAt: number; flash: number; speed: number; drop?: PickupKind; boss: boolean; bossPhase: number; attackAt: number; telegraph: number; attackAngle: number; tier: number; tint: number; bossKind?: 'warden' | 'twins' | 'carrier' | 'lattice' | 'koschei' };
type Pickup = { sprite: Phaser.GameObjects.Container; x: number; y: number; px: number; py: number; age: number; kind: PickupKind; phase: number };
type Effect = { sprite: Sprite; x: number; y: number; vx: number; vy: number; age: number; life: number; scale: number; rotation: number };
type Star = { sprite: Sprite; speed: number; phase: number };

const DEATH_SECONDS = 0.95;
const LIMITS = { friendly: 180, hostile: 180, effects: 100, enemies: 64, pickups: 20 };
const BUFF_SECONDS = 8;
const PICKUP_COLORS: Record<PickupKind, number> = { health: 0x7bffc6, rapid: 0xffc66c, spread: 0x9bf2ff, damage: 0xe4a0ff, multishot: 0x75f0ed, 'weapon-pulse': 0x9bf2ff, 'weapon-lance': 0xc4a0ff, 'weapon-scatter': 0xffb773, 'ship-part': 0xffdc89 };
const PICKUP_LABELS: Record<PickupKind, string> = { health: '+', rapid: 'R', spread: 'S', damage: 'D', multishot: '↑', 'weapon-pulse': 'P', 'weapon-lance': 'L', 'weapon-scatter': 'W', 'ship-part': '◆' };
const PICKUP_NAMES: Record<PickupKind, string> = { health: 'HULL REPAIRED +2', rapid: 'RAPID FIRE · 8 SECONDS', spread: 'SPREAD SHOT · 8 SECONDS', damage: 'OVERCHARGE · 8 SECONDS', multishot: 'MULTISHOT +1 · UNTIL SECTOR END', 'weapon-pulse': 'PULSE CANNONS EQUIPPED', 'weapon-lance': 'PIERCING LANCE EQUIPPED', 'weapon-scatter': 'SCATTER CANNON EQUIPPED', 'ship-part': 'MANTA BLUEPRINT RECOVERED' };
const WEAPON_PROJECTILES: Record<WeaponKind, number> = { pulse: 2, lance: 1, scatter: 3 };
const WEAPON_CYCLE: WeaponKind[] = ['pulse', 'lance', 'scatter'];

export class CombatScene extends Phaser.Scene {
  private callbacks: CombatCallbacks;
  private preferences: Preferences;
  private mode: 'menu' | 'combat' | 'paused' | 'dying' | 'ended' = 'menu';
  private ready = false;
  private pendingCheckpoint: Checkpoint | null = null;
  private level: Level = LEVELS[0];
  private player!: Sprite;
  private engineLeft!: Sprite;
  private engineRight!: Sprite;
  private shield!: Phaser.GameObjects.Arc;
  private field!: Phaser.GameObjects.Graphics;
  private bossTelegraph!: Phaser.GameObjects.Graphics;
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
    this.load.svg('space-background', '/art/background.svg', { width: 480, height: 800 });
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
    this.cameras.main.setBackgroundColor('#100e23');
    if (this.textures.exists('space-background')) this.add.image(240, 400, 'space-background').setDisplaySize(480, 800).setAlpha(0.8).setDepth(-10);
    this.field = this.add.graphics().setDepth(-5);
    this.field.lineStyle(1, 0x8e8ec4, 0.035);
    for (let x = 0; x <= 480; x += 60) this.field.lineBetween(x, 0, x, 800);
    for (let y = 0; y <= 800; y += 80) this.field.lineBetween(0, y, 480, y);
    for (let i = 0; i < 58; i++) {
      const x = (i * 137.507) % 480;
      const y = (i * 91.317) % 800;
      const star = this.add.image(x, y, 'spark').setDepth(-4).setScale(i % 6 === 0 ? 0.6 : 0.3).setTint(i % 3 === 0 ? 0xab9cd3 : 0xc2d6e1).setAlpha(0.15 + (i % 5) * 0.06);
      this.stars.push({ sprite: star, speed: 10 + (i % 4) * 8, phase: i });
    }
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
    g.fillStyle(0xc7ffff).fillRoundedRect(3, 0, 4, 26, 2).fillStyle(0x2fe2ed, 0.3).fillRoundedRect(0, 2, 10, 25, 4);
    g.generateTexture('friendly-shot', 10, 28).clear();
    g.fillStyle(0xff506d, 0.22).fillCircle(9, 9, 9).fillStyle(0xff506d).fillCircle(9, 9, 5).fillStyle(0xffd0b2).fillCircle(9, 9, 2.5);
    g.generateTexture('hostile-shot', 18, 18).clear();
    g.fillStyle(0xffffff).fillCircle(4, 4, 3);
    g.generateTexture('spark', 8, 8).clear();
    g.lineStyle(2, 0xffffff).strokeCircle(24, 24, 20);
    g.generateTexture('ring', 48, 48).clear();
    g.fillStyle(0x53e4ff, 0.12).fillTriangle(0, 0, 20, 0, 10, 60).fillStyle(0x6cf2ff, 0.6).fillTriangle(4, 0, 16, 0, 10, 40).fillStyle(0xdeffff).fillTriangle(7, 0, 13, 0, 10, 22);
    g.generateTexture('engine', 20, 60).destroy();
  }

  public startRun(checkpoint: Checkpoint): void {
    if (!this.ready) { this.pendingCheckpoint = checkpoint; return; }
    this.clearRun();
    this.level = LEVELS.find(level => level.id === checkpoint.level) ?? LEVELS[0];
    this.runSerial++;
    this.shipId = checkpoint.shipId && SHIPS[checkpoint.shipId] ? checkpoint.shipId : 'strelka';
    this.loadout = checkpoint.loadout ?? defaultLoadout();
    this.stats = getShipStats(this.shipId, this.loadout);
    this.weapon = SHIPS[this.shipId].weapon;
    this.multishot = 0;
    this.bossTotalHp = 0;
    this.salvageStarted = false;
    this.hp = clamp(checkpoint.hp, 1, this.stats.maxHp);
    this.score = Math.max(0, checkpoint.score);
    this.kills = 0;
    this.elapsed = 0;
    this.waveIndex = 0;
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
    this.callbacks.onNotice(`SECTOR ${String(this.level.id).padStart(2, '0')} · ${this.level.name.toUpperCase()}`);
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

  public setPreferences(preferences: Preferences): void { this.preferences = { ...preferences }; }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.mode === 'dying') {
      this.deathElapsed += dt;
      this.updateEffects(dt);
      this.drawPlayerExplosion();
      if (this.deathElapsed >= DEATH_SECONDS) this.finish('defeat');
      return;
    }
    if (this.mode === 'ended') { this.updateEffects(dt); return; }
    if (this.mode !== 'combat') return;
    this.elapsed += dt;
    this.backdropTime += dt;
    this.updateBackdrop(dt);
    this.updatePlayer(dt);
    while (this.waveIndex < this.level.waves.length && this.level.waves[this.waveIndex].at <= this.elapsed) {
      this.spawnWave(this.level.waves[this.waveIndex], this.waveIndex);
      this.waveIndex++;
    }
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
      if (this.level.boss && !this.bossSpawned) this.spawnBoss();
      else if (!this.level.boss || this.bossDefeated) {
        // Final salvage must reach the ship before an outcome can replace the playfield.
        if (!this.salvageStarted) {
          this.salvageStarted = true;
          for (const bullet of this.bullets) bullet.sprite.destroy();
          this.bullets.length = 0;
          if (this.pickups.length) this.callbacks.onNotice('SECTOR SECURE · RECOVERING SALVAGE');
        }
        if (this.pickups.length === 0) this.finish('complete');
      }
    }
  }

  private updateBackdrop(dt: number): void {
    if (this.preferences.reducedMotion) return;
    for (const star of this.stars) {
      star.sprite.y += star.speed * dt;
      if (star.sprite.y > 804) star.sprite.y = -4;
    }
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
    for (const kind of ['rapid', 'spread', 'damage'] as PickupKind[]) {
      if (this.buffs[kind] && this.buffs[kind]! <= this.elapsed) delete this.buffs[kind];
    }
    if (this.elapsed >= this.nextFire && !this.salvageStarted) {
      const cycle = this.weapon === 'lance' ? 1.55 : this.weapon === 'scatter' ? 1.15 : 1;
      this.nextFire = this.elapsed + this.stats.fireInterval * cycle * (this.buffs.rapid ? 0.5 : 1);
      const damage = this.stats.damage * (this.buffs.damage ? 2 : 1) * (this.weapon === 'lance' ? 2.5 : this.weapon === 'scatter' ? 0.88 : 1);
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

  private projectileCount(): number {
    return WEAPON_PROJECTILES[this.weapon] + this.multishot + (this.buffs.spread ? 2 : 0);
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
    if (!this.bossSpawned) this.callbacks.onNotice(`${wave.tier === 2 ? 'ELITE ' : wave.tier === 1 ? 'VETERAN ' : ''}${wave.formation.toUpperCase()} · ${waveIndex + 1}/${this.level.waves.length}`);
    const count = Math.min(wave.count, LIMITS.enemies - this.enemies.length);
    const tier = wave.tier ?? 0;
    const tint = tier >= 2 ? 0xff97cc : tier === 1 ? 0xffd08a : 0xffffff;
    let drop = wave.drop;
    if (drop?.startsWith('weapon-')) {
      const available = WEAPON_CYCLE.filter(kind => kind !== this.weapon);
      drop = Math.random() < 0.5 ? `weapon-${available[Math.floor(Math.random() * available.length)]}` as PickupKind : undefined;
    } else if (drop === 'rapid' || drop === 'spread' || drop === 'damage') {
      if (Math.random() >= 0.4) drop = undefined;
    }
    for (let i = 0; i < count; i++) {
      const target = this.formationTarget(wave, i);
      const side = i % 2 === 0 ? -1 : 1;
      const sx = wave.formation === 'pincer' || wave.formation === 'arc' ? 240 + side * 330 : target.x - side * 95;
      const sy = -80 - i * 22;
      const sprite = this.add.image(sx, sy, `enemy-${wave.kind}`).setDepth(5).setDisplaySize((wave.kind === 'shooter' ? 59 : 51) * (1 + tier * 0.09), (wave.kind === 'shooter' ? 62 : 57) * (1 + tier * 0.09)).setTint(tint);
      this.enemies.push({ sprite, x: sx, y: sy, px: sx, py: sy, sx, sy, tx: target.x, ty: target.y, age: -i * 0.045, entry: 1.65 - tier * 0.12 + (i % 3) * 0.15, hold: wave.hold + i * 0.15, dive: false, vx: 0, vy: 0, hp: wave.hp, maxHp: wave.hp, radius: (wave.kind === 'shooter' ? 20 : 17) * (1 + tier * 0.09), kind: wave.kind, phase: i * 0.9 + waveIndex * 2, shotAt: 2.4 + i * 0.2, flash: 0, speed: wave.speed, drop: i === Math.floor(count / 2) ? drop : undefined, boss: false, bossPhase: 0, attackAt: 0, telegraph: 0, attackAngle: 0, tier, tint });
    }
  }

  private spawnBoss(): void {
    const boss = this.level.boss!;
    const count = boss.count ?? 1;
    const kind = boss.kind ?? 'koschei';
    const tint = kind === 'warden' ? 0xffc485 : kind === 'twins' ? 0x9be8ff : kind === 'carrier' ? 0xb0ffca : kind === 'lattice' ? 0xe9a3ff : 0xffffff;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 240 : 132 + i * 216;
      const size = count > 1 ? 0.66 : kind === 'warden' ? 0.8 : 1;
      const sprite = this.add.image(x, -130, kind === 'koschei' ? 'boss' : `boss-${kind}`).setDepth(5).setDisplaySize((kind === 'lattice' ? 185 : kind === 'twins' ? 190 : 225) * size, (kind === 'lattice' ? 185 : 169) * size).setTint(tint);
      this.enemies.push({ sprite, x, y: -130, px: x, py: -130, sx: x, sy: -130, tx: x, ty: 143 + i * 45, age: 0, entry: 2.7, hold: 1e6, dive: false, vx: 0, vy: 0, hp: boss.hp, maxHp: boss.hp, radius: 66 * size, kind: 'shooter', phase: i, shotAt: 6.5 + i, flash: 0, speed: 0, boss: true, bossKind: kind, bossPhase: 1, attackAt: 4.5 + i * 0.9, telegraph: 0, attackAngle: Math.PI / 2, tier: 0, tint });
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
      if (enemy.age < enemy.entry) {
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
          const aim = aimedVelocity(enemy.x, enemy.y, clamp(this.player.x + Math.sin(enemy.phase) * 110, 20, 460), 840, enemy.speed);
          enemy.vx = aim.x;
          enemy.vy = Math.max(enemy.speed * 0.7, aim.y);
        }
        enemy.x += (enemy.vx + (enemy.kind === 'weaver' ? Math.cos((enemy.age - enemy.entry - enemy.hold) * 3.9 + enemy.phase) * 108 : 0)) * dt;
        enemy.y += enemy.vy * dt;
      }
      if (!enemy.boss && (enemy.kind === 'shooter' || enemy.tier > 0) && enemy.y > 40 && enemy.y < 615) {
        if (enemy.age >= enemy.shotAt - 0.45 && !enemy.telegraph) {
          enemy.telegraph = enemy.shotAt;
          enemy.attackAngle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        }
        if (enemy.age >= enemy.shotAt) {
          enemy.shotAt = enemy.age + Math.max(1.05, 2.75 - this.level.id * 0.17 - enemy.tier * 0.22);
          const speed = 165 + this.level.id * 13 + enemy.tier * 16;
          const count = enemy.kind === 'shooter' ? 1 + enemy.tier : enemy.tier === 2 ? 2 : 1;
          for (let shot = 0; shot < count; shot++) {
            const angle = enemy.attackAngle + (shot - (count - 1) / 2) * 0.19;
            this.fireProjectile(enemy.x, enemy.y + 17, Math.cos(angle) * speed, Math.sin(angle) * speed, true, 1);
          }
          enemy.telegraph = 0;
          this.spark(enemy.x, enemy.y + 17, 0xff8291, 3, 60);
        }
      }
      if (!enemy.boss) enemy.sprite.rotation = this.preferences.reducedMotion ? 0 : clamp((enemy.x - enemy.px) * 0.02, -0.22, 0.22);
      enemy.sprite.setPosition(enemy.x, enemy.y);
      if (enemy.y > 875 || enemy.x < -200 || enemy.x > 680) {
        enemy.sprite.destroy();
        this.enemies.splice(i, 1);
      }
    }
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
      enemy.shotAt = enemy.age + 8.5;
      this.callbacks.onNotice('CARRIER BAY OPEN · INTERCEPT DRONES');
      this.spawnWave({ at: 0, kind: phase === 3 ? 'weaver' : 'straight', formation: 'pincer', count: 2 + phase, hp: 3 + phase, speed: 160 + phase * 12, hold: 1, tier: 1 }, this.waveIndex);
    }
    if (enemy.age >= enemy.attackAt - 0.85 && enemy.telegraph === 0) {
      enemy.telegraph = enemy.attackAt;
      enemy.attackAngle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    }
    if (enemy.age < enemy.attackAt) return;
    const burst = Math.floor(enemy.phase++);
    const kind = enemy.bossKind;
    if (kind === 'lattice') {
      // Alternating vertical lanes have a full lane-wide opening on each pulse.
      const gap = burst % 5;
      for (let lane = 0; lane < 5; lane++) {
        if (lane === gap) continue;
        const x = 64 + lane * 88;
        this.fireProjectile(x, enemy.y + 30, 0, 185 + phase * 12, true, 1);
        if (phase === 3) this.fireProjectile(x + 20, enemy.y + 30, 0, 185 + phase * 12, true, 1);
      }
      // An aimed pulse punishes sitting indefinitely outside the fixed lattice lanes.
      if (burst % 2 === 0) {
        const count = phase === 3 ? 3 : 1;
        for (let shot = 0; shot < count; shot++) {
          const angle = enemy.attackAngle + (shot - (count - 1) / 2) * 0.14;
          this.fireProjectile(enemy.x, enemy.y + enemy.radius * 0.72, Math.cos(angle) * 228, Math.sin(angle) * 228, true, 1);
        }
      }
    } else {
      const count = kind === 'twins' ? 2 + phase : kind === 'warden' ? 3 + phase * 2 : kind === 'carrier' ? 4 + phase : 5 + phase * 2;
      for (let shot = 0; shot < count; shot++) {
        const angle = enemy.attackAngle + (shot - (count - 1) / 2) * (kind === 'twins' ? 0.21 : 0.16);
        const speed = (kind === 'warden' ? 165 : 182) + phase * 14;
        this.fireProjectile(enemy.x, enemy.y + enemy.radius * 0.72, Math.cos(angle) * speed, Math.sin(angle) * speed, true, 1);
      }
    }
    if (kind === 'koschei' && phase >= 2 && burst % 2 === 0) {
      for (let shot = 0; shot < 11; shot++) {
        const angle = 0.2 + shot / 10 * (Math.PI - 0.4) + Math.sin(burst) * 0.12;
        this.fireProjectile(enemy.x, enemy.y + 40, Math.cos(angle) * 134, Math.sin(angle) * 134, true, 1);
      }
    }
    this.spark(enemy.x, enemy.y + 45, 0xff506d, 8, 90);
    enemy.attackAt = enemy.age + (kind === 'warden' ? 2.8 : paired ? 2.7 : 2.5) - phase * 0.24;
    enemy.telegraph = 0;
  }

  private drawBossTelegraph(): void {
    this.bossTelegraph.clear();
    for (const enemy of this.enemies) {
      if (!enemy.telegraph) continue;
      const timeLeft = enemy.telegraph - enemy.age;
      const alpha = this.preferences.reducedMotion ? 0.32 : 0.2 + Math.sin(timeLeft * 20) ** 2 * 0.15;
      this.bossTelegraph.lineStyle(1, enemy.boss ? 0xffc26c : 0xff738b, alpha);
      if (enemy.bossKind === 'lattice') {
        const gap = Math.floor(enemy.phase) % 5;
        for (let lane = 0; lane < 5; lane++) {
          if (lane === gap) continue;
          const x = 64 + lane * 88;
          this.bossTelegraph.lineBetween(x, enemy.y + 30, x, 800);
          if (enemy.bossPhase === 3) this.bossTelegraph.lineBetween(x + 20, enemy.y + 30, x + 20, 800);
        }
        if (Math.floor(enemy.phase) % 2 === 0) {
          this.bossTelegraph.lineStyle(2, 0xff738b, alpha + 0.1);
          const originY = enemy.y + enemy.radius * 0.72;
          for (const offset of enemy.bossPhase === 3 ? [-0.14, 0, 0.14] : [0]) {
            const angle = enemy.attackAngle + offset;
            this.bossTelegraph.lineBetween(enemy.x, originY, enemy.x + Math.cos(angle) * 900, originY + Math.sin(angle) * 900);
          }
        }
      } else {
        const spread = enemy.boss ? (enemy.bossKind === 'twins' ? 0.21 : 0.16) * ((enemy.bossKind === 'twins' ? 2 + enemy.bossPhase : enemy.bossKind === 'warden' ? 3 + enemy.bossPhase * 2 : enemy.bossKind === 'carrier' ? 4 + enemy.bossPhase : 5 + enemy.bossPhase * 2) - 1) / 2 : 0;
        const offsets = enemy.boss ? [-spread, 0, spread] : [0];
        const originY = enemy.y + (enemy.boss ? enemy.radius * 0.72 : 17);
        for (const offset of offsets) {
          const angle = enemy.attackAngle + offset;
          this.bossTelegraph.lineBetween(enemy.x, originY, enemy.x + Math.cos(angle) * 900, originY + Math.sin(angle) * 900);
        }
      }
      this.bossTelegraph.lineStyle(enemy.boss ? 2 : 1, 0xffbf75, 0.75).strokeCircle(enemy.x, enemy.y + (enemy.boss ? 40 : 17), (enemy.boss ? 10 : 4) + Math.max(0, timeLeft) * 12);
    }
  }

  private fireProjectile(x: number, y: number, vx: number, vy: number, hostile: boolean, damage: number, pierce = 1): void {
    let count = 0;
    for (const bullet of this.bullets) if (bullet.hostile === hostile) count++;
    if (count >= (hostile ? LIMITS.hostile : LIMITS.friendly)) return;
    const sprite = this.add.image(x, y, hostile ? 'hostile-shot' : 'friendly-shot').setDepth(hostile ? 8 : 4);
    if (!hostile) sprite.setRotation(Math.atan2(vy, vx) + Math.PI / 2).setTint(this.weapon === 'lance' ? 0xcba2ff : this.weapon === 'scatter' ? 0xffc27b : damage > 1 ? 0xdfa4ff : 0xffffff).setScale(pierce > 1 ? 1.5 : 1, pierce > 1 ? 1.8 : 1);
    this.bullets.push({ sprite, x, y, px: x, py: y, vx, vy, radius: hostile ? 5 : 4, damage, age: 0, hostile, pierce, hitEnemies: new Set() });
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.px = bullet.x;
      bullet.py = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.age += dt;
      bullet.sprite.setPosition(bullet.x, bullet.y);
      let consumed = bullet.x < -40 || bullet.x > 520 || bullet.y < -50 || bullet.y > 850 || bullet.age > 9;
      if (!consumed && bullet.hostile) {
        if (this.invulnerable <= 0 && segmentCircleHit(bullet.px - this.playerPrev.x, bullet.py - this.playerPrev.y, bullet.x - this.player.x, bullet.y - this.player.y, 0, 0, 13 + bullet.radius)) {
          consumed = true;
          this.damagePlayer();
          if (this.mode !== 'combat') return;
        }
      } else if (!consumed) {
        for (let e = this.enemies.length - 1; e >= 0; e--) {
          const enemy = this.enemies[e];
          if (bullet.hitEnemies.has(enemy) || enemy.y < -25 || !segmentCircleHit(bullet.px - enemy.px, bullet.py - enemy.py, bullet.x - enemy.x, bullet.y - enemy.y, 0, 0, enemy.radius + bullet.radius)) continue;
          bullet.hitEnemies.add(enemy);
          consumed = --bullet.pierce <= 0;
          enemy.hp -= bullet.damage;
          enemy.flash = 0.06;
          this.spark(bullet.x, bullet.y, bullet.damage > 1 ? 0xe4a0ff : 0x9ef6ff, 2, 68);
          if (enemy.hp <= 0) this.destroyEnemy(e);
          if (consumed) break;
        }
      }
      if (consumed) { bullet.sprite.destroy(); this.bullets.splice(i, 1); }
    }
    if (this.invulnerable <= 0) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (!segmentCircleHit(enemy.px - this.playerPrev.x, enemy.py - this.playerPrev.y, enemy.x - this.player.x, enemy.y - this.player.y, 0, 0, enemy.radius + 12)) continue;
        if (!enemy.boss) this.destroyEnemy(i);
        this.damagePlayer();
        break;
      }
    }
  }

  private damagePlayer(): void {
    if (this.invulnerable > 0 || this.mode !== 'combat' || (this.bossDefeated && this.enemies.length === 0)) return;
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
    this.score += enemy.boss ? 5000 : enemy.kind === 'shooter' ? 180 : enemy.kind === 'weaver' ? 140 : 100;
    this.explode(enemy.x, enemy.y, enemy.boss ? 0xffdf92 : 0xff8375, enemy.boss);
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
    else if (kind === 'multishot') this.multishot++;
    else if (kind === 'ship-part') {
      if (this.shipParts >= SHIP_PARTS_REQUIRED) return;
      this.shipParts++;
      this.callbacks.onShipPart();
    } else if (kind.startsWith('weapon-')) this.weapon = kind.slice(7) as WeaponKind;
    else this.buffs[kind] = this.elapsed + BUFF_SECONDS;
    this.score += 25;
    this.callbacks.onSound('pickup');
    // The persistence callback owns fragment progress and the unlock announcement.
    if (kind !== 'ship-part') this.callbacks.onNotice(kind === 'multishot' ? `MULTISHOT +${this.multishot} · ${this.projectileCount()} PROJECTILES` : PICKUP_NAMES[kind]);
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
      buffs: Object.fromEntries(Object.entries(this.buffs).map(([kind, expiry]) => [kind, Math.max(0, expiry! - this.elapsed)])),
      progress: this.bossSpawned ? 0.75 + (1 - bossHp / Math.max(1, this.bossTotalHp)) * 0.25 : Math.min(0.74, this.waveIndex / Math.max(1, this.level.waves.length) * 0.74),
      wave: this.waveIndex + (this.bossSpawned ? 1 : 0), totalWaves: this.level.waves.length + (this.level.boss ? 1 : 0),
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
      this.score += 500 + this.hp * 100;
      for (const bullet of this.bullets) bullet.sprite.destroy();
      this.bullets.length = 0;
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
    this.playerExplosion?.clear();
    this.deathElapsed = 0;
    this.pointerAnchor = null;
    this.input.keyboard?.resetKeys();
  }

  public getDebugState(): object {
    return { mode: this.mode, deathElapsed: this.deathElapsed, deathExplosion: this.mode === 'dying', level: this.level.id, hp: this.hp, maxHp: this.stats.maxHp, shipId: this.shipId, loadout: this.loadout, weapon: this.weapon, multishot: this.multishot, projectiles: this.projectileCount(), stats: this.stats, shipParts: this.shipParts, bossSpawned: this.bossSpawned, bossDefeated: this.bossDefeated, salvageStarted: this.salvageStarted, score: this.score, kills: this.kills, elapsed: this.elapsed, wave: this.waveIndex, totalWaves: this.level.waves.length, player: { x: this.player?.x, y: this.player?.y, visible: this.player?.visible }, invulnerable: this.invulnerable, buffs: { ...this.buffs }, enemies: this.enemies.map(enemy => ({ x: enemy.x, y: enemy.y, hp: enemy.hp, boss: enemy.boss, kind: enemy.kind, tier: enemy.tier, bossKind: enemy.bossKind, phase: enemy.bossPhase, telegraph: enemy.telegraph })), bullets: { friendly: this.bullets.filter(bullet => !bullet.hostile).length, hostile: this.bullets.filter(bullet => bullet.hostile).length }, pickups: this.pickups.map(pickup => ({ x: pickup.x, y: pickup.y, kind: pickup.kind })), effects: this.effects.length, limits: LIMITS, runSerial: this.runSerial };
  }

  /** Development-only scenarios let browser tests exercise real update/collision paths. */
  public debug(action: string, payload: Record<string, unknown> = {}): void {
    if (!import.meta.env.DEV || !this.ready) return;
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
      for (const kind of ['rapid', 'spread', 'damage'] as PickupKind[]) if (this.buffs[kind]) this.buffs[kind] = this.elapsed;
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
