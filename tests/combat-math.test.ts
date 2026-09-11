import { describe, expect, it } from 'vitest';
import { aimedVelocity, moveRelative, segmentCircleHit } from '../src/game/math';

describe('swept projectile collision', () => {
  it('hits a small target crossed completely between rendered frames', () => {
    expect(segmentCircleHit(240, 700, 240, 580, 240, 640, 13)).toBe(true);
  });
  it('rejects a near miss and targets beyond the traveled segment', () => {
    expect(segmentCircleHit(220, 700, 220, 580, 240, 640, 13)).toBe(false);
    expect(segmentCircleHit(240, 700, 240, 580, 240, 540, 13)).toBe(false);
  });
  it('handles stationary overlapping and non-overlapping entities', () => {
    expect(segmentCircleHit(12, 12, 12, 12, 12, 12, 3)).toBe(true);
    expect(segmentCircleHit(12, 12, 12, 12, 18, 12, 3)).toBe(false);
  });
  it('detects a moving target by using relative segment endpoints', () => {
    expect(segmentCircleHit(-40, 0, 40, 0, 0, 0, 13)).toBe(true);
  });
});

describe('one-thumb relative input', () => {
  it('does not move the ship when a new touch starts far from it', () => {
    expect(moveRelative({ x: 240, y: 654 }, { x: 30, y: 780 }, { x: 30, y: 780 })).toEqual({ x: 240, y: 654 });
  });
  it('preserves the ship-to-finger offset during a drag', () => {
    expect(moveRelative({ x: 240, y: 654 }, { x: 240, y: 754 }, { x: 270, y: 724 })).toEqual({ x: 270, y: 624 });
  });
  it('clamps all edges and leaves room below the ship for the thumb', () => {
    expect(moveRelative({ x: 240, y: 654 }, { x: 0, y: 0 }, { x: 900, y: 900 })).toEqual({ x: 452, y: 700 });
    expect(moveRelative({ x: 240, y: 654 }, { x: 900, y: 900 }, { x: 0, y: 0 })).toEqual({ x: 28, y: 110 });
  });
});

it('aimed shots preserve speed and apply spread angles', () => {
  const shot = aimedVelocity(0, 0, 0, 100, 200, 0.2);
  expect(Math.hypot(shot.x, shot.y)).toBeCloseTo(200);
  expect(shot.x).toBeLessThan(0);
  expect(shot.y).toBeGreaterThan(0);
});
