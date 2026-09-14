import type Phaser from 'phaser';
import type { EnemyKind, ShipId, WeaponKind } from './types';

export type ProjectileShape = 'bolt' | 'chevron' | 'needle' | 'shard' | 'orb' | 'crescent' | 'diamond' | 'ring' | 'mine' | 'beam' | 'pincer';
type GuardianKind = 'warden' | 'twins' | 'carrier' | 'lattice' | 'koschei';
type Point = readonly [number, number];

export interface ProjectileStyle {
  texture: string;
  width: number;
  height: number;
  /** Core hit radius in game pixels; the outer corona is decorative. */
  radius: number;
  rotates: boolean;
}

const STYLES: Record<ProjectileShape, ProjectileStyle> = {
  bolt: { texture: 'shot-bolt', width: 10, height: 26, radius: 4, rotates: true },
  chevron: { texture: 'shot-chevron', width: 25, height: 20, radius: 4, rotates: true },
  needle: { texture: 'shot-needle', width: 8, height: 36, radius: 4, rotates: true },
  shard: { texture: 'shot-shard', width: 19, height: 27, radius: 5, rotates: true },
  orb: { texture: 'shot-orb', width: 19, height: 19, radius: 5, rotates: false },
  crescent: { texture: 'shot-crescent', width: 29, height: 20, radius: 5, rotates: true },
  diamond: { texture: 'shot-diamond', width: 20, height: 26, radius: 5, rotates: true },
  ring: { texture: 'shot-ring', width: 26, height: 26, radius: 6, rotates: false },
  mine: { texture: 'shot-mine', width: 27, height: 27, radius: 7, rotates: false },
  beam: { texture: 'shot-beam', width: 13, height: 38, radius: 5, rotates: true },
  pincer: { texture: 'shot-pincer', width: 33, height: 29, radius: 7, rotates: true },
};

const PLAYER_SHAPES: Record<ShipId, Record<WeaponKind, ProjectileShape>> = {
  strelka: { pulse: 'bolt', lance: 'needle', scatter: 'shard' },
  manta: { pulse: 'chevron', lance: 'beam', scatter: 'crescent' },
};

const ENEMY_SHAPES: Record<EnemyKind | GuardianKind, ProjectileShape> = {
  straight: 'orb', weaver: 'shard', shooter: 'diamond', debris: 'diamond',
  warden: 'diamond', twins: 'crescent', carrier: 'mine', lattice: 'beam', koschei: 'pincer',
};

export function getPlayerShotShape(shipId: ShipId, weapon: WeaponKind): ProjectileShape {
  return PLAYER_SHAPES[shipId][weapon];
}

export function getEnemyShotShape(kind: EnemyKind | GuardianKind): ProjectileShape {
  return ENEMY_SHAPES[kind];
}

export function getProjectileStyle(shape: ProjectileShape): ProjectileStyle {
  return STYLES[shape];
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}

/** Paths use a centered 100-unit square. Every directional tip points upward. */
function silhouette(ctx: CanvasRenderingContext2D, shape: ProjectileShape): void {
  switch (shape) {
    case 'bolt':
      polygon(ctx, [[0, -42], [28, -22], [22, 27], [0, 41], [-22, 27], [-28, -22]]);
      break;
    case 'chevron':
      polygon(ctx, [[0, -40], [44, 28], [17, 16], [0, -4], [-17, 16], [-44, 28]]);
      break;
    case 'needle':
      polygon(ctx, [[0, -46], [23, 8], [13, 39], [0, 47], [-13, 39], [-23, 8]]);
      break;
    case 'shard':
      polygon(ctx, [[5, -44], [36, -7], [12, 9], [-6, 42], [-31, 8], [-15, -12]]);
      break;
    case 'orb':
      ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2);
      break;
    case 'crescent':
      ctx.beginPath();
      ctx.moveTo(-44, 29);
      ctx.bezierCurveTo(-39, -48, 39, -48, 44, 29);
      ctx.bezierCurveTo(22, -9, -22, -9, -44, 29);
      ctx.closePath();
      break;
    case 'diamond':
      polygon(ctx, [[0, -43], [34, 0], [0, 43], [-34, 0]]);
      break;
    case 'ring':
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.arc(0, 0, 23, 0, Math.PI * 2, true);
      break;
    case 'mine': {
      const points: Point[] = [];
      for (let i = 0; i < 16; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 8;
        const radius = i % 2 ? 23 : i % 4 ? 35 : 44;
        points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
      polygon(ctx, points);
      break;
    }
    case 'beam':
      // A split rail silhouette distinguishes Manta's lance from Strelka's needle.
      polygon(ctx, [[-28, -43], [-9, -30], [-9, 35], [-28, 44], [-37, 27], [-37, -23]]);
      ctx.moveTo(28, -43); ctx.lineTo(9, -30); ctx.lineTo(9, 35);
      ctx.lineTo(28, 44); ctx.lineTo(37, 27); ctx.lineTo(37, -23); ctx.closePath();
      ctx.rect(-16, -6, 32, 12);
      break;
    case 'pincer':
      ctx.beginPath();
      ctx.moveTo(-9, -42);
      ctx.bezierCurveTo(-46, -31, -49, 8, -26, 34);
      ctx.lineTo(-9, 19); ctx.lineTo(9, 19); ctx.lineTo(26, 34);
      ctx.bezierCurveTo(49, 8, 46, -31, 9, -42);
      ctx.bezierCurveTo(27, -11, 29, 0, 15, 8);
      ctx.lineTo(-15, 8);
      ctx.bezierCurveTo(-29, 0, -27, -11, -9, -42);
      ctx.closePath();
      break;
  }
}

function core(ctx: CanvasRenderingContext2D, shape: ProjectileShape): void {
  ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  switch (shape) {
    case 'bolt': ctx.moveTo(0, -25); ctx.lineTo(0, 22); break;
    case 'needle': ctx.lineWidth = 7; ctx.moveTo(0, -16); ctx.lineTo(0, 28); break;
    case 'chevron': ctx.moveTo(-25, 9); ctx.lineTo(0, -22); ctx.lineTo(25, 9); break;
    case 'shard': ctx.moveTo(4, -22); ctx.lineTo(-6, 21); break;
    case 'orb': ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); break;
    case 'crescent': ctx.moveTo(-27, -1); ctx.quadraticCurveTo(0, -33, 27, -1); break;
    case 'diamond': ctx.moveTo(0, -25); ctx.lineTo(15, 0); ctx.lineTo(0, 25); ctx.lineTo(-15, 0); ctx.closePath(); break;
    case 'ring': ctx.arc(0, 0, 29, 0, Math.PI * 2); break;
    case 'mine':
      polygon(ctx, [[0, -13], [13, 0], [0, 13], [-13, 0]]); ctx.fill();
      break;
    case 'beam':
      ctx.moveTo(-23, -24); ctx.lineTo(-23, 26);
      ctx.moveTo(23, -24); ctx.lineTo(23, 26); ctx.moveTo(-13, 0); ctx.lineTo(13, 0);
      break;
    case 'pincer':
      ctx.moveTo(-22, -22); ctx.quadraticCurveTo(-38, 0, -21, 19);
      ctx.moveTo(22, -22); ctx.quadraticCurveTo(38, 0, 21, 19);
      ctx.moveTo(-12, 13); ctx.lineTo(12, 13);
      break;
  }
  ctx.stroke();
  // The ring's center stays visibly hazardous despite its hollow silhouette.
  if (shape === 'ring') {
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * Eleven shared textures, generated once per texture manager. Neutral artwork
 * takes the caller's friendly cyan or hostile coral tint without muddy colors.
 * Native 3x resolution keeps the thin cores crisp when blasts power up.
 */
export function createProjectileTextures(scene: Phaser.Scene): void {
  for (const shape of Object.keys(STYLES) as ProjectileShape[]) {
    const style = STYLES[shape];
    if (scene.textures.exists(style.texture)) continue;
    const texture = scene.textures.createCanvas(style.texture, style.width * 3, style.height * 3);
    if (!texture) throw new Error(`Could not create projectile texture ${style.texture}`);
    const ctx = texture.getContext();
    ctx.translate(texture.width / 2, texture.height / 2);
    ctx.scale(texture.width / 100, texture.height / 100);
    ctx.lineJoin = 'round';

    silhouette(ctx, shape);
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#a8a8a8'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e9e9e9'; ctx.lineWidth = 3; ctx.stroke();
    core(ctx, shape);
    texture.refresh();
  }
}
