/** Logical dimensions scale with density. Physical mobile QA remains required. */
export function concertLayout(width: number, height: number, dpr = 1, left = 0, right = 0, top = 0, bottom = 0, large = false) {
  const w = Math.max(0, width - left - right), h = Math.max(0, height - top - bottom)
  // High-density Android canvases can report physical rather than logical pixels.
  const density = Math.max(1, Math.min(3.5, Number.isFinite(dpr) ? dpr : 1))
  const inferred = Math.min(w / 390, h / 360)
  const base = Math.max(1, Math.min(density, inferred))
  const scale = large ? Math.max(1, Math.min(base * 1.25, w / 360, h / 354)) : base
  const logicalW = w / scale, logicalH = h / scale
  return { scale, width: Math.max(0, Math.min(720, logicalW - 16)), height: Math.max(0, Math.min(680, logicalH - 16)), compact: logicalH < 490, wide: logicalW > 760 }
}
export const CONCERT_RGB = {
  ink: [0.025, 0.018, 0.065], panel: [0.08, 0.045, 0.15], white: [0.98, 0.98, 1], muted: [0.79, 0.83, 0.96],
  kpop: [1, 0.46, 0.76], funk: [0.76, 1, 0.22], latin: [1, 0.65, 0.36],
  afrobeats: [0.32, 0.96, 0.76], hiphop: [0.76, 0.62, 1], electronic: [0.22, 0.9, 1]
} as const
