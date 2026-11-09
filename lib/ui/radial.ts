// Geometry for a hold-and-release radial menu (the game "weapon wheel").
// Items sit evenly round a circle, the first at 12 o'clock, then clockwise.
// Screen coordinates: +x right, +y down.

/** Offset of item `index` of `count` from the wheel's centre. */
export function radialPosition(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = (index / count) * 2 * Math.PI
  // `+ 0` turns -0 into 0.
  const round = (n: number) => Math.round(n * 100) / 100 + 0
  return { x: round(radius * Math.sin(angle)), y: round(-radius * Math.cos(angle)) }
}

/**
 * Which item a pointer at (dx, dy) from the centre is aiming at: the one
 * whose slice contains its angle. Inside `deadzone` nothing is chosen, so
 * releasing near the centre cancels.
 */
export function radialIndex(dx: number, dy: number, count: number, deadzone: number): number | null {
  if (count <= 0 || Math.hypot(dx, dy) < deadzone) return null
  // Clockwise from 12 o'clock, in [0, 2π).
  const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)
  const slice = (2 * Math.PI) / count
  return Math.floor((angle + slice / 2) / slice) % count
}
