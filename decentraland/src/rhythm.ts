/** Shared deterministic score: original short exercises, not transcribed songs. */
export const TEMPOS = [80, 90, 100, 110, 120, 130] as const
export const TRACKS = ['Neon Steps', 'Street Bounce', 'Sunset Clave', 'Crosscurrent', 'Pocket Session', 'Afterhours'] as const
export const NOTE_NAMES = ['C', 'E', 'G'] as const
export const NOTE_COUNT = 4
export const EARLY_MS = 180
export const LATE_MS = 350 // Casual transport-arrival tolerance; not esports timing.
export function tempo(round: number) { return TEMPOS[Math.max(0, Math.min(5, round))] }
export function noteTime(round: number, index: number, battle = false) { return (battle ? 5000 : 2000) + index * 60000 / tempo(round) }
export function noteLane(seed: number, round: number, member: number, index: number) { return (seed % 3 + round + member + index * (round % 2 + 1)) % 3 }
export function hitCount(mask: number) { let hits = 0; for (let i = 0; i < NOTE_COUNT; i++) if (mask & (1 << (i + 4))) hits++; return hits }
export function recordNote(mask: number, index: number, lane: number, expected: number, age: number, target: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= NOTE_COUNT || !Number.isInteger(lane) || lane < 0 || lane > 2 || !Number.isFinite(age)) return mask
  if (mask & (1 << index) || age < target - EARLY_MS || age > target + LATE_MS) return mask
  return mask | (1 << index) | (lane === expected ? 1 << (index + 4) : 0)
}
