/** Guardian attacks are planned once, before the warning, so the preview and live shots agree. */
export type GuardianKind = 'warden' | 'twins' | 'carrier' | 'lattice' | 'koschei';

export interface GuardianShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shape: 'diamond' | 'crescent' | 'mine' | 'beam' | 'pincer';
  radius: number;
  lifetime: number;
  /** Signed angular velocity in radians per second, applied only for turnFor seconds. */
  turnRate?: number;
  turnFor?: number;
  /** The mine is replaced with radial fragments at this age, in seconds. */
  burstAfter?: number;
}

export interface GuardianPlan {
  name: string;
  warningSeconds: number;
  /** Quiet time after firing, before the next warning starts. */
  recoverySeconds: number;
  shots: GuardianShot[];
  portals?: { x: number; y: number; radius: number }[];
  /** A stationary, guaranteed open corridor for this lattice volley. */
  safeLane?: { x: number; width: number };
}

export interface GuardianAttackInput {
  kind: GuardianKind;
  phase: number;
  cycle: number;
  x: number;
  y: number;
  playerX: number;
  playerY: number;
  side: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;

/** No random state or live target reference is retained in an attack plan. */
export function createGuardianAttack(input: GuardianAttackInput): GuardianPlan {
  const phase = clamp(Math.floor(finite(input.phase, 1)), 1, 3);
  const cycle = Math.max(0, Math.floor(finite(input.cycle, 0)));
  const x = clamp(finite(input.x, 240), 24, 456);
  const y = clamp(finite(input.y, 160), 72, 280);
  const playerX = clamp(finite(input.playerX, 240), 16, 464);
  const playerY = clamp(finite(input.playerY, 680), 340, 772);
  const side = input.side < 0 ? -1 : input.side > 0 ? 1 : x < 240 ? -1 : 1;
  const shots: GuardianShot[] = [];

  if (input.kind === 'warden') {
    // The entire diamond gate slides toward the middle as it descends. Two rows in
    // the exposed-core phase lengthen the passage without closing the opening.
    const gate = [156, 240, 324][cycle % 3];
    const drift = gate < 240 ? 22 : gate > 240 ? -22 : cycle % 2 ? -16 : 16;
    const rows = phase === 3 ? 2 : 1;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < 13; column++) {
        const originX = 24 + column * 36;
        if (Math.abs(originX - gate) < 64) continue;
        shots.push({ x: originX, y: y + 48 - row * 46, vx: drift, vy: 174 + phase * 12,
          shape: 'diamond', radius: 6, lifetime: 6 });
      }
    }
    return { name: 'WARDEN · MOVING GATE', warningSeconds: 1.25, recoverySeconds: 3.4 - phase * 0.15, shots };
  }

  if (input.kind === 'twins') {
    // Each guardian cuts past the other side of the locked target position.
    // Opposing twins produce mirrored scissors, then stop turning and leave.
    const originX = clamp(x + side * 22, 24, 456);
    const originY = y + 46;
    const targetX = clamp(playerX - side * 96, 96, 384);
    const angle = clamp(Math.atan2(playerY - originY, targetX - originX), 0.9, Math.PI - 0.9);
    const count = 3 + phase;
    const speed = 180 + phase * 14;
    for (let shot = 0; shot < count; shot++) {
      const heading = angle + (shot - (count - 1) / 2) * 0.115;
      shots.push({ x: originX, y: originY, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed,
        shape: 'crescent', radius: 5, lifetime: 6.5, turnRate: side * 0.3, turnFor: 0.85 });
    }
    return { name: 'TWINS · SCISSOR CROSSING', warningSeconds: 1.2 + phase * 0.1,
      recoverySeconds: 3.8 - phase * 0.2, shots };
  }

  if (input.kind === 'carrier') {
    // Slow, visible mines drift away from the bay before an eight-fragment burst.
    // Burst positions can be previewed with the same sampler as normal shots.
    const count = 2 + phase;
    const offset = cycle % 2 ? -1 : 1;
    for (let mine = 0; mine < count; mine++) {
      const spread = mine - (count - 1) / 2;
      shots.push({ x: clamp(x + spread * 20, 38, 442), y: y + 54,
        vx: spread * 36 + offset * 10, vy: 148 + phase * 6,
        shape: 'mine', radius: 8, lifetime: 2, burstAfter: 1.8 - phase * 0.15 });
    }
    return { name: 'CARRIER · SCATTER MINES', warningSeconds: 1.5,
      recoverySeconds: 4.5 - phase * 0.15, shots };
  }

  if (input.kind === 'lattice') {
    // The open corridor alternates across five positions. No aimed follow-up is
    // mixed into this volley: the explicitly marked opening remains trustworthy.
    const lane = { x: [96, 240, 384, 168, 312][cycle % 5], width: 112 };
    const spacing = phase === 1 ? 48 : phase === 2 ? 32 : 24;
    for (let originX = 24; originX <= 456; originX += spacing) {
      if (Math.abs(originX - lane.x) < lane.width / 2 + 14) continue;
      shots.push({ x: originX, y: y + 40, vx: 0, vy: 186 + phase * 14,
        shape: 'beam', radius: 5, lifetime: 5.5 });
    }
    return { name: 'LATTICE · OPEN CORRIDOR', warningSeconds: 1.4,
      recoverySeconds: 3.6 - phase * 0.15, shots, safeLane: lane };
  }

  // Two black holes open wide of the guardian. Each pincer first curves outward,
  // then turns inward once, crosses the lower field, and flies off the far side.
  const portalY = clamp(y + 18 + (cycle % 2) * 24, 120, 240);
  const portals = [{ x: 74, y: portalY, radius: 27 }, { x: 406, y: portalY, radius: 27 }];
  const count = 2 + phase;
  const speed = 175 + phase * 12;
  for (const [index, portal] of portals.entries()) {
    for (let pincer = 0; pincer < count; pincer++) {
      const leftAngle = 2.15 + (pincer - (count - 1) / 2) * 0.105;
      const angle = index === 0 ? leftAngle : Math.PI - leftAngle;
      shots.push({ x: portal.x, y: portal.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        shape: 'pincer', radius: 6, lifetime: 7, turnRate: index === 0 ? -0.8 : 0.8, turnFor: 1.35 });
    }
  }
  return { name: 'KOSCHEI · BLACK HOLE PINCERS', warningSeconds: 1.65,
    recoverySeconds: 4.6 - phase * 0.15, shots, portals };
}

/** Exact constant-speed arc followed by a straight line; independent of frame rate. */
export function sampleGuardianShot(shot: GuardianShot, age: number): { x: number; y: number; vx: number; vy: number } {
  const elapsed = Math.max(0, finite(age, 0));
  const rate = finite(shot.turnRate ?? 0, 0);
  const turnTime = Math.min(elapsed, Math.max(0, finite(shot.turnFor ?? 0, 0)));
  if (Math.abs(rate) < 1e-7 || turnTime === 0) {
    return { x: shot.x + shot.vx * elapsed, y: shot.y + shot.vy * elapsed, vx: shot.vx, vy: shot.vy };
  }
  const angle = rate * turnTime;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const vx = shot.vx * cosine - shot.vy * sine;
  const vy = shot.vx * sine + shot.vy * cosine;
  const tailTime = elapsed - turnTime;
  return {
    x: shot.x + (shot.vx * sine + shot.vy * (cosine - 1)) / rate + vx * tailTime,
    y: shot.y + (shot.vx * (1 - cosine) + shot.vy * sine) / rate + vy * tailTime,
    vx, vy,
  };
}
