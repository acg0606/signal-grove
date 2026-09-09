export function arenaLayout(width: number, height: number, left = 0, right = 0, top = 0, bottom = 0) {
  const safeWidth = Math.max(0, width - left - right)
  const safeHeight = Math.max(0, height - top - bottom)
  return { width: Math.max(0, Math.min(450, safeWidth - 16)), height: Math.max(0, Math.min(530, safeHeight - 16)), compact: safeHeight < 496 }
}
export const ARENA_TEXT_RGB = {
  ink: [0.045, 0.055, 0.075], white: [0.97, 0.98, 1], muted: [0.76, 0.81, 0.88], accent: [0.98, 0.77, 0.32]
} as const
