import type Phaser from 'phaser';
import type { LevelVisual } from '../data/visuals';
import type { EnemyKind } from './types';

type GuardianKind = 'warden' | 'twins' | 'carrier' | 'lattice' | 'koschei';
type Role = 'straight' | 'weaver' | 'shooter';
type Point = readonly [number, number];
type Paint = string | CanvasGradient;

export interface EnemyVisualSet {
  enemies: Record<EnemyKind, string>;
  bosses: Record<GuardianKind, string>;
  /** Destroy the old sprites first, then retire their nine generated textures. Idempotent. */
  dispose(): void;
}

let generation = 0;
const GUARDIANS: GuardianKind[] = ['warden', 'twins', 'carrier', 'lattice', 'koschei'];

function hex(color: number): string { return `#${(color >>> 0).toString(16).padStart(6, '0').slice(-6)}`; }
function mix(first: number, second: number, amount: number): number {
  const channel = (shift: number) => Math.round(((first >> shift) & 255) * (1 - amount) + ((second >> shift) & 255) * amount);
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}
function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], fill: Paint, stroke?: Paint, width = 1): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx: CanvasRenderingContext2D, points: readonly Point[], color: Paint, width = 1): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: Paint, width: number, from = 0, to = Math.PI * 2): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, from, to);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function light(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: number): void {
  ctx.save();
  ctx.shadowBlur = radius * 3; ctx.shadowColor = hex(color);
  ctx.fillStyle = hex(color); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = hex(mix(color, 0xffffff, 0.75));
  ctx.beginPath(); ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function paints(ctx: CanvasRenderingContext2D, visual: LevelVisual) {
  const { palette } = visual;
  const base = mix(palette.metal, palette.enemy, 0.42);
  const armor = ctx.createLinearGradient(15, 12, 76, 90);
  armor.addColorStop(0, hex(mix(base, palette.light, 0.58)));
  armor.addColorStop(0.3, hex(base));
  armor.addColorStop(0.62, hex(mix(base, palette.void, 0.28)));
  armor.addColorStop(1, hex(mix(base, palette.void, 0.65)));
  return {
    armor,
    dark: hex(mix(palette.void, palette.metal, 0.2)),
    shadow: hex(mix(palette.void, 0x050812, 0.65)),
    edge: hex(mix(palette.enemy, palette.light, 0.58)),
    seam: hex(mix(base, palette.void, 0.62)),
    trim: hex(mix(palette.accent, palette.light, 0.38)),
  };
}

/** Native vector hulls share a readable facing and role equipment, not a silhouette. */
function drawHull(ctx: CanvasRenderingContext2D, visual: LevelVisual, role: Role, guardian = false): void {
  const p = paints(ctx, visual);
  const variant = visual.hullVariant;
  const plate = (points: readonly Point[]) => polygon(ctx, points, p.armor, p.edge, guardian ? 0.9 : 1.15);
  const inset = (points: readonly Point[]) => polygon(ctx, points, p.dark, p.seam, 0.7);
  const mirror = (points: readonly Point[]) => points.map(([x, y]) => [100 - x, y] as Point);
  const pair = (points: readonly Point[]) => { plate(points); plate(mirror(points)); };

  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Engines sit at the back; the illuminated cockpit and gun tips face downward.
  for (const x of role === 'straight' ? [44, 56] : [32, 68]) {
    polygon(ctx, [[x - 3, 22], [x, 4 + variant], [x + 3, 22]], hex(mix(visual.palette.accent, visual.palette.void, 0.28)));
    line(ctx, [[x, 19], [x, 10 + variant]], p.trim, 1.2);
  }

  // Variants alter the exterior, giving every style five distinct configurations.
  if (variant === 1) {
    pair([[20, 28], [9, 19], [12, 63], [24, 85], [27, 59]]);
    line(ctx, [[11, 28], [15, 63], [23, 79]], p.trim, 1.1);
    line(ctx, [[89, 28], [85, 63], [77, 79]], p.trim, 1.1);
  } else if (variant === 2) {
    line(ctx, [[9, 43], [91, 43]], p.shadow, 7);
    pair([[5, 26], [17, 22], [22, 49], [16, 71], [5, 63]]);
    light(ctx, 11, 58, 2.6, visual.palette.accent); light(ctx, 89, 58, 2.6, visual.palette.accent);
  } else if (variant === 3) {
    pair([[45, 25], [18, 4], [7, 14], [14, 39], [31, 43]]);
    for (let bar = 0; bar < 3; bar++) {
      line(ctx, [[14 + bar * 6, 12 + bar * 3], [20 + bar * 5, 35]], p.seam, 1.4);
      line(ctx, [[86 - bar * 6, 12 + bar * 3], [80 - bar * 5, 35]], p.seam, 1.4);
    }
  } else if (variant === 4) {
    pair([[24, 19], [6, 37], [4, 65], [17, 78], [24, 67], [15, 60], [15, 42], [31, 30]]);
    ring(ctx, 50, 44, 42, 34, p.trim, 1, Math.PI * 1.08, Math.PI * 1.92);
  }

  switch (visual.hullStyle) {
    case 0: // Arrow fleet: swept segmented chevrons and a long central keel.
      pair([[40, 25], [23, 19], [5, 60], [13, 74], [32, 58], [41, 68]]);
      pair([[28, 30], [14, 56], [16, 63], [33, 47]]);
      plate([[50, 12], [64, 37], [61, 70], [50, 94], [39, 70], [36, 37]]);
      inset([[50, 28], [57, 42], [54, 69], [50, 77], [46, 69], [43, 42]]);
      line(ctx, [[20, 34], [12, 58], [15, 65]], p.trim, 1.3);
      line(ctx, [[80, 34], [88, 58], [85, 65]], p.trim, 1.3);
      break;
    case 1: // Relay fleet: open annular hull with a central suspended dart.
      ring(ctx, 50, 45, 36, 32, p.shadow, 13, 0.15, Math.PI * 2 - 0.15);
      ring(ctx, 50, 45, 35, 31, p.armor, 9, 0.15, Math.PI * 2 - 0.15);
      ring(ctx, 50, 45, 40, 36, p.edge, 1.2, 0.15, Math.PI * 2 - 0.15);
      for (const angle of [-2.5, -0.64, 0.72, 2.42]) {
        const x = 50 + Math.cos(angle) * 35, y = 45 + Math.sin(angle) * 31;
        light(ctx, x, y, 2.4, visual.palette.accent);
      }
      line(ctx, [[17, 42], [83, 42]], p.seam, 4);
      plate([[50, 17], [61, 37], [59, 66], [50, 92], [41, 66], [39, 37]]);
      inset([[50, 33], [55, 45], [50, 69], [45, 45]]);
      break;
    case 2: // Salvage fleet: asymmetric girders, offset riveted armor, exposed bridge.
      line(ctx, [[11, 39], [87, 54]], p.shadow, 12);
      line(ctx, [[11, 39], [87, 54]], p.trim, 2.2);
      plate([[9, 20], [28, 17], [31, 38], [25, 72], [10, 66]]);
      plate([[70, 31], [89, 24], [94, 52], [83, 80], [68, 69]]);
      plate([[37, 13], [61, 21], [64, 74], [53, 93], [36, 82], [32, 44]]);
      inset([[40, 34], [55, 31], [58, 67], [43, 73]]);
      for (const [x, y] of [[15, 27], [21, 58], [79, 38], [83, 65], [42, 22], [58, 80]]) light(ctx, x, y, 1, visual.palette.metal);
      for (let stripe = 0; stripe < 3; stripe++) line(ctx, [[12, 37 + stripe * 6], [25, 31 + stripe * 6]], p.seam, 2.7);
      break;
    case 3: // Prism fleet: four razor-cut crystals and a translucent central spear.
      pair([[30, 15], [42, 39], [30, 73], [8, 50]]);
      pair([[29, 23], [33, 42], [17, 50]]);
      plate([[50, 5], [69, 45], [50, 97], [31, 45]]);
      inset([[50, 18], [59, 44], [50, 77], [41, 44]]);
      line(ctx, [[50, 5], [50, 97]], p.trim, 1);
      line(ctx, [[9, 50], [30, 42], [42, 39]], p.trim, 1.2);
      line(ctx, [[91, 50], [70, 42], [58, 39]], p.trim, 1.2);
      break;
    case 4: // Bastion fleet: layered shield plates, broad shoulders, stepped jaw.
      plate([[21, 15], [39, 15], [50, 22], [61, 15], [79, 15], [93, 32], [87, 71], [68, 80], [60, 91], [40, 91], [32, 80], [13, 71], [7, 32]]);
      pair([[19, 23], [35, 23], [31, 62], [19, 70], [14, 35]]);
      plate([[40, 26], [60, 26], [68, 48], [62, 77], [50, 89], [38, 77], [32, 48]]);
      inset([[42, 36], [58, 36], [59, 65], [50, 76], [41, 65]]);
      for (const y of [38, 46, 54]) { line(ctx, [[17, y], [29, y]], p.seam, 2); line(ctx, [[71, y], [83, y]], p.seam, 2); }
      break;
    case 5: // Garden fleet: curved overlapping petals, vein traces, seed-pod core.
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(50, 30);
        ctx.bezierCurveTo(50 + side * 21, 4, 50 + side * 49, 14, 50 + side * 42, 43);
        ctx.bezierCurveTo(50 + side * 38, 64, 50 + side * 19, 69, 50 + side * 6, 73);
        ctx.bezierCurveTo(50 + side * 19, 49, 50 + side * 7, 45, 50, 30);
        ctx.fillStyle = p.armor; ctx.fill(); ctx.strokeStyle = p.edge; ctx.lineWidth = 1.2; ctx.stroke();
        line(ctx, [[50 + side * 35, 25], [50 + side * 23, 39], [50 + side * 13, 58]], p.trim, 1.2);
      }
      plate([[50, 17], [63, 38], [61, 69], [50, 94], [39, 69], [37, 38]]);
      inset([[50, 34], [57, 49], [50, 75], [43, 49]]);
      break;
    case 6: // Spindle fleet: three long forked lances and elevated antenna crossbars.
      line(ctx, [[16, 30], [84, 30]], p.armor, 8);
      line(ctx, [[16, 30], [84, 30]], p.edge, 1);
      pair([[21, 6], [29, 31], [27, 60], [18, 87], [13, 62], [15, 29]]);
      plate([[50, 8], [61, 24], [60, 72], [50, 98], [40, 72], [39, 24]]);
      inset([[47, 24], [53, 24], [54, 68], [50, 82], [46, 68]]);
      line(ctx, [[20, 19], [20, 68]], p.trim, 1.3); line(ctx, [[80, 19], [80, 68]], p.trim, 1.3);
      for (const y of [36, 45, 54]) line(ctx, [[28, y], [39, y + 5], [61, y + 5], [72, y]], p.seam, 1.1);
      break;
    case 7: // Pelagic fleet: a shell-shaped manta with ribbed swept lobes.
      ctx.beginPath(); ctx.moveTo(50, 19);
      ctx.bezierCurveTo(29, 0, 0, 27, 8, 60); ctx.lineTo(24, 86);
      ctx.quadraticCurveTo(27, 60, 42, 66); ctx.lineTo(50, 95); ctx.lineTo(58, 66);
      ctx.quadraticCurveTo(73, 60, 76, 86); ctx.lineTo(92, 60);
      ctx.bezierCurveTo(100, 27, 71, 0, 50, 19);
      ctx.fillStyle = p.armor; ctx.fill(); ctx.strokeStyle = p.edge; ctx.lineWidth = 1.2; ctx.stroke();
      for (const width of [35, 27, 19]) ring(ctx, 50, 45, width, width * 0.7, p.seam, 2, Math.PI, Math.PI * 2);
      inset([[50, 25], [63, 44], [50, 78], [37, 44]]);
      line(ctx, [[16, 51], [24, 66]], p.trim, 2); line(ctx, [[84, 51], [76, 66]], p.trim, 2);
      break;
    case 8: // Rift fleet: separated arrowhead shards held by visible energy bridges.
      line(ctx, [[16, 30], [50, 47], [81, 26]], p.trim, 1.5);
      line(ctx, [[18, 61], [50, 57], [83, 65]], p.trim, 1.1);
      plate([[18, 8], [34, 32], [26, 47], [7, 31]]);
      plate([[78, 10], [95, 33], [74, 43], [65, 26]]);
      plate([[18, 51], [31, 59], [23, 88], [9, 72]]);
      plate([[76, 48], [94, 63], [83, 86], [68, 68]]);
      plate([[50, 22], [62, 47], [50, 92], [38, 47]]);
      inset([[50, 35], [56, 49], [50, 73], [44, 49]]);
      break;
    case 9: // Beacon fleet: rectangular solar wings around an antenna-bearing spine.
      pair([[4, 21], [29, 17], [35, 61], [9, 73]]);
      pair([[10, 27], [24, 25], [28, 57], [14, 63]]);
      for (const y of [34, 43, 52]) { line(ctx, [[10, y], [28, y - 3]], p.seam, 1.7); line(ctx, [[72, y - 3], [90, y]], p.seam, 1.7); }
      line(ctx, [[18, 24], [23, 58]], p.trim, 0.9); line(ctx, [[82, 24], [77, 58]], p.trim, 0.9);
      plate([[42, 10], [58, 10], [64, 30], [60, 75], [50, 94], [40, 75], [36, 30]]);
      inset([[44, 28], [56, 28], [56, 65], [50, 77], [44, 65]]);
      ring(ctx, 50, 18, 12, 7, p.edge, 2);
      break;
  }

  // Shared equipment makes damage roles legible across all fifty fleet designs.
  if (role === 'shooter') {
    for (const x of [31, 69]) {
      polygon(ctx, [[x - 4, 54], [x + 4, 54], [x + 4, 88], [x - 4, 88]], p.shadow, p.edge, 0.9);
      line(ctx, [[x, 61], [x, 80]], p.trim, 2.2);
      line(ctx, [[x - 3, 88], [x + 3, 88]], hex(visual.palette.light), 2.5);
    }
  } else if (role === 'weaver') {
    // Forward stabilizers distinguish the agile role even at a 51 px footprint.
    pair([[16, 53], [29, 63], [22, 92], [8, 78], [15, 72]]);
    line(ctx, [[17, 66], [13, 77], [21, 86]], p.trim, 1.2);
    line(ctx, [[83, 66], [87, 77], [79, 86]], p.trim, 1.2);
    for (const side of [-1, 1]) {
      line(ctx, [[50 + side * 33, 37], [50 + side * 23, 54], [50 + side * 16, 58]], p.trim, 2);
      light(ctx, 50 + side * 30, 39, 1.9, visual.palette.accent);
    }
  } else {
    polygon(ctx, [[47, 75], [50, 85], [53, 75], [50, 79]], p.trim);
  }
  light(ctx, 50, 51, role === 'shooter' ? 4.4 : 3.5, role === 'weaver' ? visual.palette.accent : visual.palette.enemy);
  line(ctx, [[46, 34], [50, 30], [54, 34]], p.edge, 0.8);
}

function drawGuardian(ctx: CanvasRenderingContext2D, visual: LevelVisual, kind: GuardianKind): void {
  // Work in a 240 × 192 frame. Each guardian keeps its combat-role architecture
  // while adopting this level's outer geometry, plates, and illumination.
  ctx.save(); ctx.translate(120, 98);
  const p = paints(ctx, visual);
  const accent = visual.palette.accent;
  const armorPod = (x: number, y: number, width: number, height: number) => {
    polygon(ctx, [[x - width / 2 + 5, y - height / 2], [x + width / 2 - 5, y - height / 2], [x + width / 2, y - height / 2 + 9], [x + width / 2, y + height / 2 - 8], [x, y + height / 2], [x - width / 2, y + height / 2 - 8], [x - width / 2, y - height / 2 + 9]], p.armor, p.edge, 1.5);
    for (let bar = 0; bar < 3; bar++) line(ctx, [[x - width * 0.27, y - 7 + bar * 7], [x + width * 0.27, y - 7 + bar * 7]], p.seam, 3);
    light(ctx, x, y + height * 0.28, 3, accent);
  };
  if (kind === 'warden') {
    ring(ctx, 0, -3, 77, 68, p.shadow, 16);
    ring(ctx, 0, -3, 77, 68, p.armor, 11);
    ring(ctx, 0, -3, 85, 75, p.edge, 1.4);
    for (const side of [-1, 1]) armorPod(side * 80, 15, 25, 65);
  } else if (kind === 'twins') {
    for (const side of [-1, 1]) {
      polygon(ctx, [[side * 15, -39], [side * 87, -69], [side * 103, -50], [side * 88, 22], [side * 57, 77], [side * 53, 1]], p.armor, p.edge, 1.5);
      line(ctx, [[side * 82, -50], [side * 73, 17], [side * 59, 52]], p.trim, 2.2);
    }
  } else if (kind === 'carrier') {
    polygon(ctx, [[-99, -36], [-70, -68], [70, -68], [99, -36], [106, 47], [79, 69], [-79, 69], [-106, 47]], p.armor, p.edge, 1.8);
    for (const side of [-1, 1]) {
      armorPod(side * 81, -12, 27, 98);
      for (const y of [-32, -9, 14]) {
        polygon(ctx, [[side * 53 - 13, y], [side * 53 + 13, y], [side * 53 + 13, y + 15], [side * 53 - 13, y + 15]], p.shadow, p.edge, 0.9);
        line(ctx, [[side * 53 - 8, y + 11], [side * 53 + 8, y + 11]], p.trim, 2);
      }
    }
  } else if (kind === 'lattice') {
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const x = Math.cos(angle) * 75, y = Math.sin(angle) * 67;
      line(ctx, [[0, 0], [x, y]], p.trim, 2);
      polygon(ctx, [[x, y - 18], [x + 15, y], [x, y + 18], [x - 15, y]], p.armor, p.edge, 1.4);
      light(ctx, x, y, 4, accent);
    }
    ring(ctx, 0, 0, 76, 68, p.seam, 9);
    ring(ctx, 0, 0, 76, 68, p.trim, 1.5);
    ring(ctx, 0, 0, 59, 51, p.edge, 1, Math.PI * 0.1, Math.PI * 1.6);
  } else {
    for (const side of [-1, 1]) {
      polygon(ctx, [[side * 23, -49], [side * 60, -71], [side * 95, -58], [side * 109, -11], [side * 103, 55], [side * 76, 73], [side * 55, 44], [side * 60, -1]], p.armor, p.edge, 1.8);
      armorPod(side * 91, 10, 21, 69);
      light(ctx, side * 56, -49, 4, accent);
    }
    polygon(ctx, [[-24, -63], [0, -87], [24, -63], [18, -32], [-18, -32]], p.armor, p.edge, 1.2);
  }
  ctx.save();
  const scaleX = kind === 'carrier' ? 1.03 : kind === 'lattice' ? 1.13 : kind === 'twins' ? 1.4 : 1.36;
  const scaleY = kind === 'twins' ? 1.38 : kind === 'carrier' ? 1.6 : 1.5;
  ctx.scale(scaleX, scaleY); ctx.translate(-50, -50);
  drawHull(ctx, visual, kind === 'twins' ? 'weaver' : 'shooter', true);
  ctx.restore();
  // A larger exposed reactor gives all guardians a focal point at combat scale.
  ring(ctx, 0, 4, kind === 'lattice' ? 21 : 18, kind === 'lattice' ? 21 : 18, p.shadow, 6);
  ring(ctx, 0, 4, kind === 'lattice' ? 21 : 18, kind === 'lattice' ? 21 : 18, p.edge, 1.7);
  light(ctx, 0, 4, kind === 'koschei' ? 10 : 7, visual.palette.enemy);
  ctx.restore();
}

function drawAsteroid(ctx: CanvasRenderingContext2D, visual: LevelVisual): void {
  const p = paints(ctx, visual);
  const facets = 8 + visual.hullVariant;
  const points: Point[] = Array.from({ length: facets }, (_, index) => {
    const angle = index / facets * Math.PI * 2;
    const radius = 35 + Math.sin(visual.seed * 0.0003 + index * 3.17) * 7;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  });
  polygon(ctx, points, p.armor, p.edge, 1.5);
  for (let index = 0; index < facets; index++) {
    const next = points[(index + 1) % facets];
    polygon(ctx, [points[index], next, [48 + Math.sin(index) * 9, 48 + Math.cos(index) * 8]], index % 3 === 0 ? p.dark : index % 2 ? p.armor : p.seam);
  }
  for (const [x, y, radius] of [[34, 31, 9], [63, 61, 12], [40, 69, 5], [66, 30, 5]]) {
    ctx.fillStyle = p.shadow; ctx.beginPath(); ctx.ellipse(x, y, radius, radius * 0.72, 0.5, 0, Math.PI * 2); ctx.fill();
    ring(ctx, x, y, radius, radius * 0.72, p.edge, 0.8, 0.1, Math.PI * 0.85);
  }
  if (visual.hullStyle === 3 || visual.hullStyle === 6 || visual.hullStyle === 8) {
    polygon(ctx, [[36, 34], [43, 17], [51, 39], [47, 55]], p.trim, p.edge, 0.9);
    polygon(ctx, [[55, 55], [69, 39], [65, 65], [59, 70]], p.trim, p.edge, 0.8);
  } else {
    line(ctx, [[19, 46], [34, 49], [44, 59]], p.trim, 1.2);
    line(ctx, [[68, 18], [59, 34], [62, 41]], p.trim, 1.1);
  }
}

/**
 * Build nine crisp canvas textures synchronously. No asset requests, timers, or
 * Math.random calls: visual variation cannot change asteroid rolls or rewards.
 * Keep one set per scene; clearRun() must destroy its sprites before dispose().
 */
export function createEnemyVisuals(scene: Phaser.Scene, visual: LevelVisual): EnemyVisualSet {
  // A hot-reloaded module or a visual-review import can coexist with an older
  // module instance. Consult the texture manager before reserving its namespace.
  let prefix: string;
  do { prefix = `epoch-fleet-${visual.level}-${generation++}`; }
  while (scene.textures.exists(`${prefix}-straight`));
  const keys: string[] = [];
  const texture = (name: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const key = `${prefix}-${name}`;
    const canvas = scene.textures.createCanvas(key, width * 2, height * 2);
    if (!canvas) throw new Error(`Unable to create enemy texture ${key}`);
    keys.push(key);
    const ctx = canvas.context;
    ctx.scale(2, 2);
    draw(ctx);
    canvas.refresh();
    return key;
  };
  const enemies = {} as Record<EnemyKind, string>;
  try {
    for (const role of ['straight', 'weaver', 'shooter'] as const) {
      enemies[role] = texture(role, 100, 100, ctx => {
        ctx.translate(50, 50);
        ctx.scale(role === 'straight' ? 0.87 : 1, role === 'shooter' ? 0.91 : 1);
        ctx.translate(-50, -50);
        drawHull(ctx, visual, role);
      });
    }
    enemies.debris = texture('asteroid', 100, 100, ctx => drawAsteroid(ctx, visual));
    const bosses = {} as Record<GuardianKind, string>;
    for (const kind of GUARDIANS) bosses[kind] = texture(kind, 240, 192, ctx => drawGuardian(ctx, visual, kind));
    let disposed = false;
    return {
      enemies, bosses,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const key of keys) if (scene.textures.exists(key)) scene.textures.remove(key);
      },
    };
  } catch (error) {
    for (const key of keys) if (scene.textures.exists(key)) scene.textures.remove(key);
    throw error;
  }
}
