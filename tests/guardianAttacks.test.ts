import { describe, expect, it, vi } from 'vitest';
import { createGuardianAttack, sampleGuardianShot, type GuardianAttackInput, type GuardianKind, type GuardianShot } from '../src/game/guardianAttacks';

const kinds: GuardianKind[] = ['warden', 'twins', 'carrier', 'lattice', 'koschei'];
const base: GuardianAttackInput = { kind: 'warden', phase: 1, cycle: 0, x: 240, y: 150, playerX: 240, playerY: 680, side: -1 };
const plan = (kind: GuardianKind, phase = 1, cycle = 0) => createGuardianAttack({ ...base, kind, phase, cycle });

describe('guardian attack planning', () => {
  it('gives all five guardians distinct mechanics and clear warnings', () => {
    const plans = kinds.map(kind => plan(kind));
    expect(new Set(plans.map(attack => attack.name)).size).toBe(5);
    expect(new Set(plans.map(attack => attack.shots[0].shape)).size).toBe(5);
    for (const attack of plans) {
      expect(attack.warningSeconds).toBeGreaterThanOrEqual(1);
      expect(attack.recoverySeconds).toBeGreaterThanOrEqual(2.5);
    }
    expect(plan('warden').shots.every(shot => shot.vx !== 0)).toBe(true);
    expect(plan('twins').shots.every(shot => shot.turnFor && shot.turnRate)).toBe(true);
    expect(plan('carrier').shots.every(shot => shot.burstAfter)).toBe(true);
    expect(plan('lattice').safeLane).toBeDefined();
    expect(plan('koschei').portals).toHaveLength(2);
  });

  it('uses no random state and does not track the player after the warning starts', () => {
    const random = vi.spyOn(Math, 'random');
    try {
      for (const kind of kinds) {
        const input = { ...base, kind };
        const planned = createGuardianAttack(input);
        const before = JSON.stringify(planned);
        input.playerX = 40;
        input.playerY = 400;
        input.x = 420;
        expect(JSON.stringify(planned)).toBe(before);
        expect(planned).toEqual(createGuardianAttack({ ...base, kind }));
      }
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });

  it('keeps volleys, hit cores, lifetimes, and velocity bounded through phase three', () => {
    for (const kind of kinds) for (const phase of [1, 2, 3]) for (let cycle = 0; cycle < 10; cycle++) {
      const attack = plan(kind, phase, cycle);
      expect(attack.shots.length).toBeGreaterThan(0);
      expect(attack.shots.length).toBeLessThanOrEqual(26);
      for (const shot of attack.shots) {
        expect(shot.radius).toBeGreaterThanOrEqual(5);
        expect(shot.radius).toBeLessThanOrEqual(8);
        expect(shot.lifetime).toBeGreaterThan(0);
        expect(shot.lifetime).toBeLessThanOrEqual(9);
        const speed = Math.hypot(shot.vx, shot.vy);
        expect(speed).toBeGreaterThanOrEqual(150);
        expect(speed).toBeLessThanOrEqual(240);
        for (const age of [0, 0.5, 1.35, 2, shot.lifetime]) {
          const position = sampleGuardianShot(shot, age);
          expect(Object.values(position).every(Number.isFinite)).toBe(true);
          expect(Math.hypot(position.vx, position.vy)).toBeCloseTo(speed);
        }
        if (!shot.burstAfter) {
          const end = sampleGuardianShot(shot, shot.lifetime);
          expect(end.x < -20 || end.x > 500 || end.y > 820).toBe(true);
        }
      }
    }
  });

  it('escalates every guardian without reducing the warning below one second', () => {
    for (const kind of kinds) {
      const early = plan(kind, 1);
      const late = plan(kind, 3);
      expect(late.shots.length).toBeGreaterThan(early.shots.length);
      expect(late.warningSeconds).toBeGreaterThanOrEqual(1);
      expect(late.recoverySeconds).toBeLessThan(early.recoverySeconds);
    }
  });

  it('slides the warden gate while preserving a ship-wide opening across its rows', () => {
    const attack = plan('warden', 3);
    for (const age of [0, 1, 2, 3]) {
      const positions = attack.shots.map(shot => sampleGuardianShot(shot, age));
      const gateX = 156 + age * 22;
      expect(positions.every(position => Math.abs(position.x - gateX) >= 64)).toBe(true);
      expect(gateX).toBeGreaterThan(80);
      expect(gateX).toBeLessThan(400);
    }
  });

  it('mirrors the twins into crossing cuts that stop steering', () => {
    const left = createGuardianAttack({ ...base, kind: 'twins', x: 150, side: -1 });
    const right = createGuardianAttack({ ...base, kind: 'twins', x: 330, side: 1 });
    for (const [index, leftShot] of left.shots.entries()) {
      const rightShot = right.shots[right.shots.length - index - 1];
      for (const age of [0, 0.4, 1, 2, 3]) {
        const a = sampleGuardianShot(leftShot, age);
        const b = sampleGuardianShot(rightShot, age);
        expect(a.x + b.x).toBeCloseTo(480);
        expect(a.y).toBeCloseTo(b.y);
      }
      expect(sampleGuardianShot(leftShot, 3).x).toBeGreaterThan(240);
      expect(sampleGuardianShot(leftShot, 1).vx).toBe(sampleGuardianShot(leftShot, 3).vx);
    }
  });

  it('detonates carrier mines inside the playfield with advance visible travel', () => {
    for (const phase of [1, 2, 3]) {
      const attack = plan('carrier', phase);
      expect(attack.shots).toHaveLength(phase + 2);
      for (const mine of attack.shots) {
        expect(mine.burstAfter).toBeGreaterThanOrEqual(1.3);
        expect(mine.burstAfter).toBeLessThan(mine.lifetime);
        const burst = sampleGuardianShot(mine, mine.burstAfter!);
        expect(burst.y - mine.y).toBeGreaterThan(200);
        expect(burst.x).toBeGreaterThan(30);
        expect(burst.x).toBeLessThan(450);
        expect(burst.y).toBeLessThan(600);
      }
    }
  });

  it('keeps every lattice shot outside the marked corridor for the entire volley', () => {
    const corridors = new Set<number>();
    for (const phase of [1, 2, 3]) for (let cycle = 0; cycle < 5; cycle++) {
      const attack = plan('lattice', phase, cycle);
      const lane = attack.safeLane!;
      corridors.add(lane.x);
      expect(lane.width).toBeGreaterThanOrEqual(110);
      expect(lane.x - lane.width / 2).toBeGreaterThanOrEqual(16);
      expect(lane.x + lane.width / 2).toBeLessThanOrEqual(464);
      for (const shot of attack.shots) {
        expect(shot.vx).toBe(0);
        expect(Math.abs(shot.x - lane.x) - shot.radius).toBeGreaterThanOrEqual(lane.width / 2 + 9);
      }
    }
    expect(corridors.size).toBe(5);
  });

  it('launches koschei pincers out of two portals and curves them inward only once', () => {
    const attack = plan('koschei', 3);
    expect(attack.portals).toHaveLength(2);
    for (const portal of attack.portals!) {
      const pincers = attack.shots.filter(shot => shot.x === portal.x && shot.y === portal.y);
      expect(pincers).toHaveLength(5);
      for (const pincer of pincers) {
        const turned = sampleGuardianShot(pincer, pincer.turnFor!);
        expect(Math.sign(pincer.vx)).toBe(portal.x < 240 ? -1 : 1);
        expect(Math.sign(turned.vx)).toBe(portal.x < 240 ? 1 : -1);
        expect(turned.vy).toBeGreaterThan(0);
        expect(sampleGuardianShot(pincer, 4).vx).toBe(turned.vx);
      }
    }
  });
});

describe('guardian trajectory sampling', () => {
  const shot: GuardianShot = { x: 10, y: 20, vx: 200, vy: 0, radius: 5, lifetime: 6,
    shape: 'crescent', turnRate: Math.PI / 2, turnFor: 1 };

  it('integrates a quarter circle exactly, then continues along its final tangent', () => {
    const radius = 200 / (Math.PI / 2);
    const turn = sampleGuardianShot(shot, 1);
    expect(turn.x).toBeCloseTo(10 + radius);
    expect(turn.y).toBeCloseTo(20 + radius);
    expect(turn.vx).toBeCloseTo(0);
    expect(turn.vy).toBeCloseTo(200);
    const end = sampleGuardianShot(shot, 2.5);
    expect(end.x).toBeCloseTo(turn.x);
    expect(end.y).toBeCloseTo(turn.y + 300);
  });

  it('has a continuous position and velocity at the end of its curve', () => {
    const before = sampleGuardianShot(shot, 1 - 1e-8);
    const after = sampleGuardianShot(shot, 1 + 1e-8);
    for (const key of ['x', 'y', 'vx', 'vy'] as const) expect(before[key]).toBeCloseTo(after[key], 4);
  });

  it('handles straight shots and nonpositive or invalid ages without NaN values', () => {
    expect(sampleGuardianShot({ ...shot, turnRate: 0 }, 2)).toEqual({ x: 410, y: 20, vx: 200, vy: 0 });
    for (const age of [-1, NaN, Infinity]) {
      expect(sampleGuardianShot(shot, age)).toEqual({ x: 10, y: 20, vx: 200, vy: 0 });
    }
  });
});
