import type { Genre } from './concert'

type RGB = readonly [number, number, number]
export type CabinTheme = { shape: 'dome' | 'cone' | 'terrace' | 'vinyl' | 'igloo'; shell: RGB; roof: RGB; trim: RGB; title: string; motif: string }
export const CABINS: Record<Genre, CabinTheme> = {
  kpop: { shape: 'dome', shell: [.98,.79,.87], roof: [.95,.36,.64], trim: [1,.94,.75], title: 'STARLIGHT DOME', motif: 'star' },
  funk: { shape: 'cone', shell: [.81,.95,.5], roof: [.34,.64,.15], trim: [1,.86,.22], title: 'BASS CABANA', motif: 'speakers' },
  latin: { shape: 'terrace', shell: [1,.82,.56], roof: [.86,.3,.18], trim: [1,.64,.27], title: 'SUNSET CASITA', motif: 'sun' },
  afrobeats: { shape: 'cone', shell: [.54,.88,.75], roof: [.73,.47,.23], trim: [1,.78,.35], title: 'GROOVE PAVILION', motif: 'drum' },
  hiphop: { shape: 'vinyl', shell: [.79,.72,.96], roof: [.36,.24,.62], trim: [.92,.64,1], title: 'VINYL LODGE', motif: 'record' },
  electronic: { shape: 'igloo', shell: [.79,.94,1], roof: [.47,.81,.95], trim: [.15,.84,.96], title: 'PRISM IGLOO', motif: 'equalizer' }
}
export const VILLAGE = {
  radiusX: 4.75, radiusZ: 4.05, footprintPower: 4.5, eave: 5.15, doorwayHalfAngle: Math.PI / 3,
  ground: [.57,.73,.78] as RGB, avenue: [.87,.92,.89] as RGB,
  boundary: [.34,.58,.69] as RGB, stage: [.3,.35,.53] as RGB,
  skyTime: 15 * 60 * 60
}
export function canopyPulse(now: number, playing: boolean, reduced: boolean) {
  return playing && !reduced ? 1 + .06 * Math.sin(now / 900) : 1
}
