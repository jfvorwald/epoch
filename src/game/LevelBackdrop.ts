import type Phaser from 'phaser';
import type { LevelVisual } from '../data/visuals';

const W = 480, H = 800;
const color = (value: number, alpha = 1) => `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;

/** A separate random stream keeps scenery from changing encounters or rewards. */
function sceneryRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

/** Render detailed scenery once on entry; only stars move during combat. */
export class LevelBackdrop {
  private image?: Phaser.GameObjects.Image;
  private readonly key = 'level-environment';

  constructor(private scene: Phaser.Scene) {}

  apply(visual: LevelVisual) {
    this.dispose();
    const texture = this.scene.textures.createCanvas(this.key, W * 2, H * 2)!;
    const ctx = texture.context;
    ctx.scale(2, 2);
    const p = visual.palette;
    const random = sceneryRandom(visual.seed);
    const v = visual.landmark;
    const angle = (v - 2) * 0.13;
    ctx.fillStyle = color(p.void); ctx.fillRect(0, 0, W, H);

    const glow = (x: number, y: number, radius: number, tint: number, strength: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, color(tint, strength)); g.addColorStop(0.48, color(tint, strength * 0.3)); g.addColorStop(1, color(tint, 0));
      ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    const line = (x: number, y: number, ex: number, ey: number, tint: number, alpha = 0.3, width = 1) => {
      ctx.strokeStyle = color(tint, alpha); ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    };
    const ellipse = (x: number, y: number, rx: number, ry: number, rotation: number, tint: number, alpha: number, width = 1) => {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.strokeStyle = color(tint, alpha); ctx.lineWidth = width; ctx.stroke();
    };
    const polygon = (points: number[][], fill: number, stroke: number, alpha = 1) => {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      const minY = Math.min(...points.map(point => point[1])), maxY = Math.max(...points.map(point => point[1]));
      const paint = ctx.createLinearGradient(0, minY, 35, maxY);
      const dark = (fill >> 16 & 255) * 0.35 << 16 | (fill >> 8 & 255) * 0.35 << 8 | (fill & 255) * 0.35;
      paint.addColorStop(0, color(fill, alpha * 0.8)); paint.addColorStop(1, color(dark, alpha));
      ctx.fillStyle = paint; ctx.fill(); ctx.strokeStyle = color(stroke, alpha * 0.4); ctx.lineWidth = 0.8; ctx.stroke();
    };
    const rock = (x: number, y: number, radius: number, rotation: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
      const points = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; const r = radius * (0.72 + random() * 0.3); return [Math.cos(a) * r, Math.sin(a) * r]; });
      polygon(points, p.metal, p.haze, 0.7);
      line(-radius * 0.3, -radius * 0.5, radius * 0.6, radius * 0.1, p.light, 0.14);
      ctx.fillStyle = color(p.void, 0.75); ctx.beginPath(); ctx.arc(-radius * 0.14, radius * 0.13, radius * 0.23, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    const tower = (x: number, y: number, scale: number, rotation: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale);
      polygon([[-13, -79], [13, -79], [19, 43], [9, 67], [-9, 67], [-19, 43]], p.metal, p.haze);
      for (let row = 0; row < 5; row++) {
        const yy = -64 + row * 23;
        for (const side of [-1, 1]) {
          ctx.fillStyle = color(p.haze, 0.2); ctx.fillRect(side > 0 ? 22 : -79, yy, 57, 18);
          ctx.strokeStyle = color(p.light, 0.18); ctx.strokeRect(side > 0 ? 22 : -79, yy, 57, 18);
          for (let cell = 1; cell < 5; cell++) line(side > 0 ? 22 + cell * 11 : -79 + cell * 11, yy, side > 0 ? 22 + cell * 11 : -79 + cell * 11, yy + 18, p.accent, 0.12);
        }
      }
      line(0, -110, 0, 91, p.light, 0.45, 2);
      glow(0, -112, 14, p.accent, 0.8);
      ctx.restore();
    };

    // Far dust, colored illumination and pinprick stars sit well below gunfire.
    for (let i = 0; i < 13; i++) glow(random() * 640 - 80, random() * H, 110 + random() * 200, i % 3 ? p.haze : p.accent, 0.07 + random() * 0.07);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = color(i % 5 ? p.light : p.accent, 0.1 + random() * 0.42);
      const size = i % 17 ? 0.55 : 1.1;
      ctx.fillRect(random() * W, random() * H, size, size);
    }

    switch (visual.environment) {
      case 'orbit': {
        const x = v % 2 ? 440 : 26, y = 215 + v * 53, radius = 170 + v * 14;
        glow(x, y, radius + 42, p.haze, 0.36);
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
        const surface = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
        surface.addColorStop(0, color(p.haze, 0.72)); surface.addColorStop(0.45, color(p.metal)); surface.addColorStop(1, color(p.void));
        ctx.fillStyle = surface; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        for (let i = 0; i < 42; i++) ellipse(x + (random() - 0.5) * radius, y + (random() - 0.5) * radius * 2, radius * (0.4 + random()), 5 + random() * 17, angle - 0.3, p.light, 0.03 + random() * 0.035, 1 + random() * 6);
        ctx.restore(); ellipse(x, y, radius, radius, 0, p.light, 0.26, 2);
        ellipse(x, y, radius * 1.48, radius * 0.34, -0.55 + angle, p.haze, 0.19, 5);
        ellipse(x, y, radius * 1.58, radius * 0.37, -0.55 + angle, p.light, 0.2);
        tower(410 - v * 36, 105, 0.28, 0.4 + angle);
        break;
      }
      case 'relay': {
        const cx = v % 2 ? 410 : 60, cy = 255 + v * 42;
        glow(cx, cy, 240, p.haze, 0.25);
        for (let ring = 0; ring < 4; ring++) ellipse(cx, cy, 86 + ring * 39, 86 + ring * 39, 0, p.light, 0.06 + ring * 0.025, ring === 2 ? 4 : 1);
        for (let i = 0; i < 3; i++) {
          const x = 55 + i * 194 + (v - 2) * 10, y = 170 + (i % 2) * 265;
          line(x, y, cx, cy, p.accent, 0.12);
          tower(x, y, i === 1 ? 0.55 : 0.9, angle + (i - 1) * 0.36);
        }
        break;
      }
      case 'wreckage': {
        ctx.save(); ctx.translate(v % 2 ? 397 : 70, 312 + v * 26); ctx.rotate(-0.5 + angle);
        polygon([[-55,-245],[36,-221],[62,-135],[26,-57],[40,48],[-17,21],[-32,93],[-64,18],[-43,-70],[-73,-171]], p.metal, p.haze, 0.9);
        for (let i = 0; i < 12; i++) {
          const y = -219 + i * 25;
          line(-38, y, 23, y + 18, p.light, 0.19, 3);
          line(-27, y + 4, -31, y + 16, p.accent, 0.38, 2);
        }
        ctx.restore();
        for (let i = 0; i < 39; i++) { const y = random() * H; rock((y * 0.43 + v * 63 + random() * 220) % 570 - 45, y, 4 + random() * 25, random() * 6.28); }
        glow(75 + v * 65, 345, 190, p.accent, 0.13);
        break;
      }
      case 'nebula': {
        for (let i = 0; i < 30; i++) { const y = i * 31 - 70; const x = 160 + Math.sin(i * 0.19 + v) * 205; glow(x, y, 100 + random() * 95, i % 3 ? p.light : p.accent, 0.17); }
        for (let i = 0; i < 12; i++) {
          ctx.beginPath(); ctx.moveTo(-20, 130 + i * 31); ctx.bezierCurveTo(160, 5 + i * 24 + v * 22, 350, 630 - i * 24, 510, 310 + i * 29);
          ctx.strokeStyle = color(i % 3 ? p.haze : p.light, 0.09); ctx.lineWidth = 1 + i % 3; ctx.stroke();
        }
        glow(355 - v * 54, 196 + v * 40, 27, p.light, 0.35);
        break;
      }
      case 'array': {
        const x = 95 + v * 76, y = 285 + v * 31;
        glow(x, y, 205, p.accent, 0.27);
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2 + angle;
          const dx = Math.cos(a), dy = Math.sin(a);
          line(x + dx * 117, y + dy * 117, x + dx * 210, y + dy * 210, p.metal, 1, 20);
          line(x + dx * 125, y + dy * 125, x + dx * 205, y + dy * 205, p.haze, 0.65, 2);
        }
        ellipse(x, y, 143, 143, 0, p.metal, 0.52, 33); ellipse(x, y, 155, 155, 0, p.light, 0.28, 1);
        ellipse(x, y, 122, 122, 0, p.accent, 0.35, 3);
        ctx.fillStyle = color(p.void); ctx.beginPath(); ctx.arc(x, y, 112, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 10; i++) ellipse(x, y, 37 + i * 7, 37 + i * 7, 0, p.haze, 0.09);
        break;
      }
      case 'garden': {
        for (let i = 0; i < 5; i++) {
          const x = 15 + i * 135 - v * 18, y = 70 + (i % 3) * 220;
          ctx.save(); ctx.translate(x, y); ctx.rotate(0.48 + angle);
          polygon([[-40,-91],[30,-91],[47,-72],[47,100],[-40,100]], p.metal, p.light, 0.6);
          for (let row = 0; row < 7; row++) for (let col = 0; col < 3; col++) {
            ctx.fillStyle = color((row + col) % 3 ? p.haze : p.accent, 0.15 + random() * 0.16); ctx.fillRect(-31 + col * 23, -78 + row * 24, 18, 18);
            line(-31 + col * 23, -76 + row * 24, -15 + col * 23, -62 + row * 24, p.light, 0.1);
          }
          ctx.restore();
        }
        ellipse(260, 310, 300, 190, -0.62, p.light, 0.1, 3);
        break;
      }
      case 'ice': {
        for (let i = 0; i < 17; i++) {
          const x = i % 2 ? 422 + random() * 48 : random() * 85, y = random() * H;
          const size = 28 + random() * 65;
          ctx.save(); ctx.translate(x, y); ctx.rotate(random() * 1.4 - 0.7);
          polygon([[0,-size], [size*0.4,-size*0.23], [size*0.25,size*0.63], [-size*0.3,size], [-size*0.47,-size*0.08]], p.metal, p.light, 0.75);
          polygon([[0,-size], [size*0.07,0], [-size*0.3,size], [-size*0.47,-size*0.08]], p.haze, p.light, 0.22);
          line(0, -size, 4, size * 0.38, p.light, 0.25); ctx.restore();
        }
        glow(320 - v * 33, 230, 240, p.haze, 0.32);
        for (let i = 0; i < 6; i++) ellipse(240, 350, 130 + i * 22, 270 + i * 25, angle, p.light, 0.035);
        break;
      }
      case 'ocean': {
        const x = v % 2 ? 435 : 30, y = 270 + v * 39;
        glow(x, y, 275, p.light, 0.3);
        for (let i = 0; i < 24; i++) {
          const yy = 100 + i * 21;
          ctx.beginPath(); ctx.moveTo(-20, yy); ctx.bezierCurveTo(130, yy - 60 - v * 10, 290, yy + 68, 510, yy - 12);
          ctx.strokeStyle = color(p.light, 0.035 + i % 4 * 0.012); ctx.lineWidth = i % 3 === 0 ? 4 : 1; ctx.stroke();
        }
        ellipse(x, y, 211, 260, angle, p.light, 0.19, 2);
        tower(v % 2 ? 45 : 432, 205 + v * 48, 0.8, -0.25);
        break;
      }
      case 'rift': {
        const x = v % 2 ? 358 : 112, y = 310 + v * 29;
        glow(x, y, 270, p.haze, 0.3);
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.4 + angle);
        for (let i = 14; i >= 0; i--) ellipse(0, 0, 30 + i * 8, 165 + i * 7, 0, i % 3 ? p.haze : p.accent, 0.045 + (14 - i) * 0.009, 2);
        ctx.fillStyle = color(p.void); ctx.beginPath(); ctx.ellipse(0, 0, 34, 182, 0, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 14; i++) { const y = random() * 340 - 170; line(-34 - random() * 30, y, -88 - random() * 54, y + 32, p.light, 0.16); }
        ctx.restore();
        break;
      }
      case 'beacons': {
        const nodes = Array.from({ length: 9 }, (_, i) => ({ x: 30 + random() * 420, y: 80 + i * 76 }));
        nodes.forEach((node, i) => {
          if (i) line(nodes[i - 1].x, nodes[i - 1].y, node.x, node.y, p.haze, 0.16);
          if (i > 2) line(nodes[i - 3].x, nodes[i - 3].y, node.x, node.y, p.accent, 0.045);
          glow(node.x, node.y, i % 3 ? 30 : 60, p.accent, 0.36);
          ellipse(node.x, node.y, 9 + v, 9 + v, 0, p.light, 0.27);
          line(node.x - 15, node.y, node.x + 15, node.y, p.haze, 0.6, 2);
          line(node.x, node.y - 15, node.x, node.y + 15, p.light, 0.3);
        });
        tower(v % 2 ? 415 : 54, 210 + v * 38, 0.55, angle);
        break;
      }
    }

    // A calm lower flight area preserves contrast for bullets, pickups and HUD.
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, color(p.void, 0.28)); shade.addColorStop(0.28, color(p.void, 0));
    shade.addColorStop(0.66, color(p.void, 0.17)); shade.addColorStop(1, color(p.void, 0.76));
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    const vignette = ctx.createRadialGradient(240, 365, 90, 240, 390, 485);
    vignette.addColorStop(0, color(p.void, 0)); vignette.addColorStop(1, color(p.void, 0.72));
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    texture.refresh();
    this.image = this.scene.add.image(W / 2, H / 2, this.key).setDisplaySize(W, H).setDepth(-10);
  }

  dispose() {
    this.image?.destroy(); this.image = undefined;
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
