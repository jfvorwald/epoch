export const ARENA = { width: 480, height: 800, minX: 28, maxX: 452, minY: 110, maxY: 700 };

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Closest point on a swept segment. Includes starting overlaps and zero-length motion. */
export function segmentCircleHit(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / lengthSquared, 0, 1) : 0;
  const x = ax + t * dx - cx;
  const y = ay + t * dy - cy;
  return x * x + y * y <= radius * radius;
}

/** Pointer positions are already in the Phaser logical viewport; down only sets the anchor. */
export function moveRelative(ship: { x: number; y: number }, previous: { x: number; y: number }, current: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp(ship.x + current.x - previous.x, ARENA.minX, ARENA.maxX),
    y: clamp(ship.y + current.y - previous.y, ARENA.minY, ARENA.maxY),
  };
}

export function aimedVelocity(fromX: number, fromY: number, toX: number, toY: number, speed: number, offset = 0): { x: number; y: number } {
  const angle = Math.atan2(toY - fromY, toX - fromX) + offset;
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}
