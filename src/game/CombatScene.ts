import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import type { Checkpoint, CombatCallbacks, EnemyKind, HudState, Level, PickupKind, Preferences, Wave } from './types';
import { aimedVelocity, ARENA, clamp, moveRelative, segmentCircleHit } from './math';

type Sprite = Phaser.GameObjects.Image;
type Projectile = { sprite: Sprite; x: number; y: number; px: number; py: number; vx: number; vy: number; radius: number; damage: number; age: number; hostile: boolean };
type Enemy = { sprite: Sprite; x: number; y: number; px: number; py: number; sx: number; sy: number; tx: number; ty: number; age: number; entry: number; hold: number; dive: boolean; vx: number; vy: number; hp: number; maxHp: number; radius: number; kind: EnemyKind; phase: number; shotAt: number; flash: number; speed: number; drop?: PickupKind; boss: boolean; bossPhase: number; attackAt: number; telegraph: number; attackAngle: number };
type Pickup = { sprite: Phaser.GameObjects.Container; x: number; y: number; px: number; py: number; age: number; kind: PickupKind; phase: number };
type Effect = { sprite: Sprite; x: number; y: number; vx: number; vy: number; age: number; life: number; scale: number; rotation: number };
type Star = { sprite: Sprite; speed: number; phase: number };

const MAX_HP = 5;
const LIMITS = { friendly: 100, hostile: 150, effects: 100, enemies: 48, pickups: 20 };
const BUFF_SECONDS = 8;
const PICKUP_COLORS: Record<PickupKind, number> = { health: 0x7bffc6, rapid: 0xffc66c, spread: 0x9bf2ff, damage: 0xe4a0ff };
const PICKUP_LABELS: Record<PickupKind, string> = { health: '+', rapid: 'R', spread: 'S', damage: 'D' };
const PICKUP_NAMES: Record<PickupKind, string> = { health: 'HULL REPAIRED +2', rapid: 'RAPID FIRE · 8 SECONDS', spread: 'SPREAD SHOT · 8 SECONDS', damage: 'OVERCHARGE · 8 SECONDS' };

export class CombatScene extends Phaser.Scene {
  private callbacks: CombatCallbacks;
  private preferences: Preferences;
  private mode: 'menu' | 'combat' | 'paused' | 'ended' = 'menu';
  private ready = false;
  private pendingCheckpoint: Checkpoint | null = null;
  private level: Level = LEVELS[0];
  private player!: Sprite;
  private engineLeft!: Sprite;
  private engineRight!: Sprite;
  private shield!: Phaser.GameObjects.Arc;
  private field!: Phaser.GameObjects.Graphics;
  private bossTelegraph!: Phaser.GameObjects.Graphics;
  private stars: Star[] = [];
  private bullets: Projectile[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private effects: Effect[] = [];
  private hp = MAX_HP;
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
    this.load.svg('strelka', '/art/strelka.svg', { width: 100, height: 124 });
    this.load.svg('enemy-straight', '/art/enemy-straight.svg', { width: 76, height: 84 });
    this.load.svg('enemy-weaver', '/art/enemy-weaver.svg', { width: 76, height: 84 });
    this.load.svg('enemy-shooter', '/art/enemy-shooter.svg', { width: 80, height: 84 });
    this.load.svg('boss', '/art/boss.svg', { width: 242, height: 182 });
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
      const moved = moveRelative(this.player, anchor, pointer);
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
    this.hp = clamp(checkpoint.hp, 1, MAX_HP);
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
    this.player.setPosition(240, 654).setRotation(0).setVisible(true).setAlpha(1).clearTint();
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

  public setPreferences(preferences: Preferences): void { this.preferences = { ...preferences }; }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
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
      else if (!this.level.boss || this.bossDefeated) this.finish('complete');
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
      this.player.x = clamp(this.player.x + dx / length * 310 * dt, ARENA.minX, ARENA.maxX);
      this.player.y = clamp(this.player.y + dy / length * 310 * dt, ARENA.minY, ARENA.maxY);
    }
    const desiredAngle = this.preferences.reducedMotion ? 0 : clamp((dx || this.pointerDisplacement * 0.06) * 0.15, -0.2, 0.2);
    this.player.rotation = Phaser.Math.Linear(this.player.rotation, desiredAngle, 0.15);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.player.setAlpha(this.invulnerable > 0 ? this.preferences.reducedMotion ? 0.7 : Math.floor(this.elapsed * 12) % 2 === 0 ? 0.48 : 1 : 1);
    this.shield.setPosition(this.player.x, this.player.y + 4).setVisible(this.invulnerable > 0);
    const pulse = this.preferences.reducedMotion ? 1 : 0.93 + Math.sin(this.elapsed * 37) * 0.12;
    this.engineLeft.setPosition(this.player.x - 13, this.player.y + 48).setScale(0.65, 0.65 * pulse).setAlpha(0.65);
    this.engineRight.setPosition(this.player.x + 13, this.player.y + 48).setScale(0.65, 0.65 * pulse).setAlpha(0.65);
    for (const kind of ['rapid', 'spread', 'damage'] as PickupKind[]) {
      if (this.buffs[kind] && this.buffs[kind]! <= this.elapsed) delete this.buffs[kind];
    }
    if (this.elapsed >= this.nextFire) {
      this.nextFire = this.elapsed + (this.buffs.rapid ? 0.095 : 0.2);
      const damage = this.buffs.damage ? 2 : 1;
      this.fireProjectile(this.player.x - 10, this.player.y - 31, 0, -680, false, damage);
      this.fireProjectile(this.player.x + 10, this.player.y - 31, 0, -680, false, damage);
      if (this.buffs.spread) {
        this.fireProjectile(this.player.x - 19, this.player.y - 21, -190, -640, false, damage);
        this.fireProjectile(this.player.x + 19, this.player.y - 21, 190, -640, false, damage);
      }
      if (this.elapsed - this.lastShotSound > 0.12 || this.lastShotSound > this.elapsed) {
        this.lastShotSound = this.elapsed;
        this.callbacks.onSound('shoot');
      }
    }
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
    this.callbacks.onNotice(`${wave.formation.toUpperCase()} FORMATION · ${waveIndex + 1}/${this.level.waves.length}`);
    const count = Math.min(wave.count, LIMITS.enemies - this.enemies.length);
    for (let i = 0; i < count; i++) {
      const target = this.formationTarget(wave, i);
      const side = i % 2 === 0 ? -1 : 1;
      const sx = wave.formation === 'pincer' || wave.formation === 'arc' ? 240 + side * 330 : target.x - side * 95;
      const sy = -80 - i * 22;
      const sprite = this.add.image(sx, sy, `enemy-${wave.kind}`).setDepth(5).setDisplaySize(wave.kind === 'shooter' ? 59 : 51, wave.kind === 'shooter' ? 62 : 57);
      this.enemies.push({ sprite, x: sx, y: sy, px: sx, py: sy, sx, sy, tx: target.x, ty: target.y, age: -i * 0.045, entry: 1.7 + (i % 3) * 0.15, hold: wave.hold + i * 0.15, dive: false, vx: 0, vy: 0, hp: wave.hp, maxHp: wave.hp, radius: wave.kind === 'shooter' ? 20 : 17, kind: wave.kind, phase: i * 0.9 + waveIndex * 2, shotAt: 2.4 + i * 0.25, flash: 0, speed: wave.speed, drop: i === Math.floor(count / 2) ? wave.drop : undefined, boss: false, bossPhase: 0, attackAt: 0, telegraph: 0, attackAngle: 0 });
    }
  }

  private spawnBoss(): void {
    const boss = this.level.boss!;
    const sprite = this.add.image(240, -130, 'boss').setDepth(5).setDisplaySize(225, 169);
    this.enemies.push({ sprite, x: 240, y: -130, px: 240, py: -130, sx: 240, sy: -130, tx: 240, ty: 163, age: 0, entry: 2.7, hold: 1e6, dive: false, vx: 0, vy: 0, hp: boss.hp, maxHp: boss.hp, radius: 66, kind: 'shooter', phase: 0, shotAt: 4, flash: 0, speed: 0, boss: true, bossPhase: 1, attackAt: 4.7, telegraph: 0, attackAngle: Math.PI / 2 });
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
      else enemy.sprite.clearTint();
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
      if (!enemy.boss && enemy.kind === 'shooter' && enemy.age >= enemy.shotAt && enemy.y > 40 && enemy.y < 640) {
        enemy.shotAt = enemy.age + Math.max(0.9, 2.4 - this.level.id * 0.16);
        const aim = aimedVelocity(enemy.x, enemy.y + 17, this.player.x, this.player.y, 160 + this.level.id * 11);
        this.fireProjectile(enemy.x, enemy.y + 17, aim.x, aim.y, true, 1);
        this.spark(enemy.x, enemy.y + 17, 0xff8291, 3, 60);
      }
      if (!enemy.boss) enemy.sprite.rotation = this.preferences.reducedMotion ? 0 : clamp((enemy.x - enemy.px) * 0.02, -0.22, 0.22);
      enemy.sprite.setPosition(enemy.x, enemy.y);
      if (enemy.y > 875 || enemy.x < -200 || enemy.x > 680) {
        if (enemy.drop) this.spawnPickup(clamp(enemy.x, 60, 420), 455, enemy.drop);
        enemy.sprite.destroy();
        this.enemies.splice(i, 1);
      }
    }
  }

  private updateBoss(enemy: Enemy, _dt: number): void {
    const phase = enemy.hp > enemy.maxHp * 0.58 ? 1 : enemy.hp > enemy.maxHp * 0.28 ? 2 : 3;
    if (phase > enemy.bossPhase) {
      enemy.bossPhase = phase;
      this.callbacks.onNotice(phase === 2 ? 'SIGNAL SURGE · WEAPONS UNSEALED' : 'CORE EXPOSED · FINISH THE RELAY');
      this.spawnPickup(240, 340, phase === 2 ? 'spread' : 'damage');
      this.spawnPickup(phase === 2 ? 130 : 350, 290, 'health');
      this.explode(enemy.x, enemy.y, 0xffba71, true);
    }
    enemy.x = 240 + Math.sin((enemy.age - enemy.entry) * 0.62) * (phase === 3 ? 132 : 105);
    enemy.y = enemy.ty + Math.sin(enemy.age * 0.8) * 17;
    if (enemy.age >= enemy.attackAt - 0.85 && enemy.telegraph === 0) {
      enemy.telegraph = enemy.attackAt;
      enemy.attackAngle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    }
    if (enemy.age >= enemy.attackAt) {
      const burst = Math.floor(enemy.phase++);
      const spreadCount = phase === 1 ? 5 : phase === 2 ? 7 : 9;
      for (let i = 0; i < spreadCount; i++) {
        const angle = enemy.attackAngle + (i - (spreadCount - 1) / 2) * (phase === 3 ? 0.145 : 0.17);
        this.fireProjectile(enemy.x, enemy.y + 49, Math.cos(angle) * (165 + phase * 13), Math.sin(angle) * (165 + phase * 13), true, 1);
      }
      if (phase >= 2) {
        for (let side = -1; side <= 1; side += 2) {
          const origin = enemy.x + side * 76;
          const aim = aimedVelocity(origin, enemy.y + 25, this.player.x, this.player.y, 220);
          this.fireProjectile(origin, enemy.y + 25, aim.x, aim.y, true, 1);
        }
      }
      if (phase === 3 && burst % 2 === 0) {
        for (let i = 0; i < 10; i++) {
          const angle = 0.2 + i / 9 * (Math.PI - 0.4) + Math.sin(burst) * 0.14;
          this.fireProjectile(enemy.x, enemy.y + 40, Math.cos(angle) * 128, Math.sin(angle) * 128, true, 1);
        }
      }
      this.spark(enemy.x, enemy.y + 52, 0xff506d, 8, 90);
      enemy.attackAt = enemy.age + (phase === 1 ? 2.35 : phase === 2 ? 1.85 : 1.6);
      enemy.telegraph = 0;
    }
  }

  private drawBossTelegraph(): void {
    this.bossTelegraph.clear();
    const boss = this.enemies.find(enemy => enemy.boss);
    if (!boss || !boss.telegraph) return;
    const timeLeft = boss.telegraph - boss.age;
    const alpha = this.preferences.reducedMotion ? 0.32 : 0.2 + Math.sin(timeLeft * 20) ** 2 * 0.2;
    this.bossTelegraph.lineStyle(1, 0xffc26c, alpha);
    const spread = boss.bossPhase === 1 ? 0.34 : boss.bossPhase === 2 ? 0.51 : 0.58;
    for (const offset of [-spread, 0, spread]) {
      const angle = boss.attackAngle + offset;
      this.bossTelegraph.lineBetween(boss.x, boss.y + 49, boss.x + Math.cos(angle) * 900, boss.y + 49 + Math.sin(angle) * 900);
    }
    this.bossTelegraph.lineStyle(2, 0xffbf75, 0.75).strokeCircle(boss.x, boss.y + 46, 10 + timeLeft * 19);
  }

  private fireProjectile(x: number, y: number, vx: number, vy: number, hostile: boolean, damage: number): void {
    let count = 0;
    for (const bullet of this.bullets) if (bullet.hostile === hostile) count++;
    if (count >= (hostile ? LIMITS.hostile : LIMITS.friendly)) return;
    const sprite = this.add.image(x, y, hostile ? 'hostile-shot' : 'friendly-shot').setDepth(hostile ? 8 : 4);
    if (!hostile) sprite.setRotation(Math.atan2(vy, vx) + Math.PI / 2).setScale(damage > 1 ? 1.3 : 1, 1).setTint(damage > 1 ? 0xdfa4ff : 0xffffff);
    this.bullets.push({ sprite, x, y, px: x, py: y, vx, vy, radius: hostile ? 5 : 4, damage, age: 0, hostile });
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
          if (enemy.y < -25 || !segmentCircleHit(bullet.px - enemy.px, bullet.py - enemy.py, bullet.x - enemy.x, bullet.y - enemy.y, 0, 0, enemy.radius + bullet.radius)) continue;
          consumed = true;
          enemy.hp -= bullet.damage;
          enemy.flash = 0.06;
          this.spark(bullet.x, bullet.y, bullet.damage > 1 ? 0xe4a0ff : 0x9ef6ff, 2, 68);
          if (enemy.hp <= 0) this.destroyEnemy(e);
          break;
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
    if (this.invulnerable > 0 || this.mode !== 'combat') return;
    this.hp = Math.max(0, this.hp - 1);
    this.invulnerable = 1.3;
    this.callbacks.onSound('hit');
    this.explode(this.player.x, this.player.y, 0x91efff, false);
    if (!this.preferences.reducedMotion) this.cameras.main.shake(110, 0.004, true);
    this.emitHud();
    if (this.hp <= 0) {
      this.explode(this.player.x, this.player.y, 0xffb777, true);
      this.player.setVisible(false);
      this.engineLeft.setVisible(false);
      this.engineRight.setVisible(false);
      this.shield.setVisible(false);
      this.finish('defeat');
    }
  }

  private destroyEnemy(index: number): void {
    const enemy = this.enemies[index];
    this.kills++;
    this.score += enemy.boss ? 5000 : enemy.kind === 'shooter' ? 180 : enemy.kind === 'weaver' ? 140 : 100;
    this.explode(enemy.x, enemy.y, enemy.boss ? 0xffdf92 : 0xff8375, enemy.boss);
    this.callbacks.onSound('explosion');
    if (enemy.drop) this.spawnPickup(enemy.x, enemy.y, enemy.drop);
    else if (!enemy.boss && this.kills % 9 === 0) this.spawnPickup(enemy.x, enemy.y, this.hp <= 3 ? 'health' : (['rapid', 'spread', 'damage'] as PickupKind[])[Math.floor(this.kills / 9) % 3]);
    if (enemy.boss) this.bossDefeated = true;
    enemy.sprite.destroy();
    this.enemies.splice(index, 1);
  }

  private spawnPickup(x: number, y: number, kind: PickupKind): void {
    if (this.pickups.length >= LIMITS.pickups) return;
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
      const magnetized = distance < 142 || pickup.age > 7.5;
      if (magnetized && distance > 0) {
        const travel = Math.min(distance, (180 + (142 - Math.min(distance, 142)) * 2) * dt);
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
      if (collected || pickup.y > 860 || pickup.age > 16) { pickup.sprite.destroy(); this.pickups.splice(i, 1); }
    }
  }

  private applyPickup(kind: PickupKind): void {
    if (kind === 'health') this.hp = Math.min(MAX_HP, this.hp + 2);
    else this.buffs[kind] = this.elapsed + BUFF_SECONDS;
    this.score += 25;
    this.callbacks.onSound('pickup');
    this.callbacks.onNotice(PICKUP_NAMES[kind]);
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
    const boss = this.enemies.find(enemy => enemy.boss);
    const state: HudState = {
      level: this.level.id, score: this.score, hp: this.hp, maxHp: MAX_HP,
      buffs: Object.fromEntries(Object.entries(this.buffs).map(([kind, expiry]) => [kind, Math.max(0, expiry! - this.elapsed)])),
      progress: this.level.boss && this.bossSpawned ? 0.75 + (1 - (boss?.hp ?? 0) / (boss?.maxHp ?? 1)) * 0.25 : Math.min(this.level.boss ? 0.74 : 0.99, this.waveIndex / Math.max(1, this.level.waves.length) * (this.level.boss ? 0.74 : 1)),
      wave: this.waveIndex, totalWaves: this.level.waves.length,
      ...(boss ? { bossHp: boss.hp, bossMaxHp: boss.maxHp, bossName: this.level.boss?.name } : {}),
    };
    this.callbacks.onHud(state);
  }

  private finish(type: 'complete' | 'defeat'): void {
    if (this.mode !== 'combat') return;
    this.mode = 'ended';
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
    this.callbacks.onOutcome({ type, level: this.level.id, score: this.score, hp: this.hp, kills: this.kills });
  }

  private clearRun(): void {
    for (const array of [this.bullets, this.enemies, this.pickups, this.effects]) {
      for (const entity of array) entity.sprite.destroy();
      array.length = 0;
    }
    this.bossTelegraph?.clear();
    this.pointerAnchor = null;
    this.input.keyboard?.resetKeys();
  }

  public getDebugState(): object {
    return { mode: this.mode, level: this.level.id, hp: this.hp, score: this.score, kills: this.kills, elapsed: this.elapsed, wave: this.waveIndex, totalWaves: this.level.waves.length, player: { x: this.player?.x, y: this.player?.y }, invulnerable: this.invulnerable, buffs: { ...this.buffs }, enemies: this.enemies.map(enemy => ({ x: enemy.x, y: enemy.y, hp: enemy.hp, boss: enemy.boss, kind: enemy.kind, phase: enemy.bossPhase })), bullets: { friendly: this.bullets.filter(bullet => !bullet.hostile).length, hostile: this.bullets.filter(bullet => bullet.hostile).length }, pickups: this.pickups.map(pickup => ({ x: pickup.x, y: pickup.y, kind: pickup.kind })), effects: this.effects.length, limits: LIMITS, runSerial: this.runSerial };
  }

  /** Development-only scenarios let browser tests exercise real update/collision paths. */
  public debug(action: string, payload: Record<string, unknown> = {}): void {
    if (!import.meta.env.DEV || !this.ready) return;
    if (action === 'pickup') this.spawnPickup(this.player.x, this.player.y, (payload.kind as PickupKind) || 'rapid');
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
      for (let t = 0; t < seconds && this.mode === 'combat'; t += 1 / 60) this.update(0, 1000 / 60);
    }
  }
}
