import { engine, Entity, Transform, MeshRenderer, MeshCollider, Material, TextShape, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Color4, Vector3, Quaternion } from '@dcl/sdk/math'
import { GENRES, GENRE_NAMES, type Genre, type Arena, total } from './concert'
import { CONCERT_RGB } from './concert-layout'
export const ATLAS = 'assets/images/crew-atlas-v07.png'
export const color = (g: keyof typeof CONCERT_RGB) => Color4.create(...CONCERT_RGB[g], 1)
export function crewUV(g: Genre) {
  const i = GENRES.indexOf(g), x = (i % 3) / 3, y = i < 3 ? .5 : 0
  return [x, y, x, y + .5, x + 1 / 3, y + .5, x + 1 / 3, y]
}
export function studioPosition(g: Genre) { const i = GENRES.indexOf(g); return { x: i < 3 ? 5 : 27, y: .6, z: 6 + (i % 3) * 7 } }
const ink = color('ink'), white = color('white')
export function box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c = ink, solid = false, rotation = 0) {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(sx, sy, sz), rotation: Quaternion.fromEulerDegrees(0, 0, rotation) })
  MeshRenderer.setBox(e); if (solid) MeshCollider.setBox(e)
  Material.setBasicMaterial(e, { diffuseColor: c, castShadows: false }); return e
}
function sphere(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: Color4) {
  const e = engine.addEntity(); Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(sx, sy, sz) })
  MeshRenderer.setSphere(e); Material.setBasicMaterial(e, { diffuseColor: c, castShadows: false }); return e
}
function sign(x: number, y: number, z: number, value: string, size: number, c = white) {
  const e = engine.addEntity(); Transform.create(e, { position: Vector3.create(x, y, z) })
  TextShape.create(e, { text: value, fontSize: size, textColor: c, outlineWidth: .06, outlineColor: ink }); return e
}
function emblem(x: number, y: number, z: number, size: number, g: Genre) {
  const e = engine.addEntity(); Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(size, size, 1) })
  const uv = crewUV(g); MeshRenderer.setPlane(e, [...uv, ...uv])
  Material.setBasicMaterial(e, { texture: Material.Texture.Common({ src: ATLAS }), diffuseColor: white, castShadows: false }); return e
}
function speaker(x: number, y: number, z: number, c: Color4, size = 1) {
  box(x, y + 1.1 * size, z, size, 2.2 * size, .8 * size, color('panel'))
  for (const dy of [.55, 1.4]) {
    sphere(x, y + dy * size, z - .42 * size, .73 * size, .73 * size, .08, c)
    sphere(x, y + dy * size, z - .47 * size, .52 * size, .52 * size, .1, ink)
  }
  box(x, y + 2.02 * size, z - .43 * size, .8 * size, .08, .04, c)
}
function keyboard(x: number, z: number, c: Color4) {
  const e = box(x, 1.2, z, 2.3, .2, .75, c)
  for (let k = 0; k < 12; k++) box(x - 1.04 + k * .19, 1.32, z - .12, .16, .04, .4, k % 3 === 0 ? ink : white)
  for (const dx of [-.8, .8]) box(x + dx, .65, z, .09, 1.1, .1, white)
  return e
}
function drum(x: number, z: number, c: Color4) {
  const e = sphere(x, .85, z, .9, 1.3, .9, c); sphere(x, 1.45, z, .95, .1, .95, white); return e
}
const crowd: { body: Entity; sign: Entity; icon: Entity; x: number; y: number; z: number }[] = []
const bars: Entity[] = []
let board: Entity, lastBoard = '', lastWinner = '', lastFrame = -1
export function buildClub(onStudio: (g: Genre) => void = () => {}, onStage: () => void = () => {}) {
  function interact(e: Entity, title: string, action: () => void) {
    MeshCollider.setBox(e)
    pointerEventsSystem.onPointerDown({ entity: e, opts: { button: InputAction.IA_POINTER, hoverText: title, maxDistance: 5 } }, action)
  }
  box(16, -.06, 16, 31.8, .12, 31.8, ink, true)
  // An enclosed club, not decorative landscape: no trees or surrounding terrain.
  for (const x of [.15, 31.85]) box(x, 4.5, 16, .3, 9, 31.8, color('panel'), true)
  for (const z of [.15, 31.85]) box(16, 4.5, z, 31.8, 9, .3, color('panel'), true)
  box(16, 8.95, 16, 31.8, .15, 31.8, ink)
  for (const x of [10, 22]) box(x, .025, 13, .12, .035, 24, color(x === 10 ? 'kpop' : 'electronic'))
  for (const z of [3, 10, 17, 24, 30]) box(16, 8.2, z, 30, .12, .12, color(z % 2 ? 'electronic' : 'kpop'))
  sign(16, 4.2, 3.5, 'AFFINITY ARENA', 3.5, color('electronic'))
  sign(16, 3.1, 3.5, 'CHOOSE A STUDIO. REHEARSE. OWN THE STAGE.', 1.1)
  sign(16, 2.25, 3.5, 'STUDIO x1 + LIVE x2 | HIGHEST ATTRIBUTES WIN', 1)
  const subtitles = ['LIGHTSTICK LAB', 'BASS BLOCK', 'FIRE ROOM', 'SUN PERCUSSION', 'VINYL VAULT', 'SYNTH CIRCUIT']
  GENRES.forEach((g, i) => {
    const p = studioPosition(g), c = color(g)
    box(p.x, .1, p.z, 8.6, .2, 6.3, color('panel'))
    box(p.x, .23, p.z + 2.95, 8.3, .06, .12, c)
    for (const dx of [-4.2, 4.2]) box(p.x + dx, 1.8, p.z + 2.8, .13, 3.6, .13, c)
    box(p.x, 3.6, p.z + 2.8, 8.5, .13, .13, c)
    box(p.x, 1.75, p.z + 3.1, 8.5, 3.5, .15, ink)
    emblem(p.x, 2, p.z + 2.99, 2.1, g)
    sign(p.x, 4.25, p.z + 2.8, GENRE_NAMES[g].toUpperCase(), 1.5, c)
    sign(p.x, 3.85, p.z + 2.8, subtitles[i], .8)
    speaker(p.x - 3.1, .2, p.z + 2.2, c, .7)
    speaker(p.x + 3.1, .2, p.z + 2.2, c, .7)
    let instrument: Entity
    if (g === 'electronic') instrument = keyboard(p.x, p.z + 1.3, c)
    else if (g === 'afrobeats') { instrument = drum(p.x - .7, p.z + 1.5, c); const second = drum(p.x + .7, p.z + 1.5, c); interact(second, 'Play ' + GENRE_NAMES[g] + ' · sound on', () => onStudio(g)) }
    else if (g === 'hiphop') {
      instrument = box(p.x, 1.1, p.z + 1.4, 2.5, .2, .9, c)
      for (const dx of [-.65, .65]) sphere(p.x + dx, 1.22, p.z + 1.4, .9, .035, .9, ink)
    } else if (g === 'funk') { speaker(p.x, .2, p.z + 1.6, c, 1); instrument = keyboard(p.x, p.z + .4, c) }
    else {
      box(p.x, 1, p.z + 1, .07, 1.7, .07, white)
      instrument = sphere(p.x, 1.88, p.z + 1, .35, .48, .35, c)
      if (g === 'kpop') { sphere(p.x - .15, 2.2, p.z + 1, .4, .4, .15, c); sphere(p.x + .15, 2.2, p.z + 1, .4, .4, .15, c); box(p.x, 2.04, p.z + 1, .43, .43, .1, c, false, 45) }
    }
    interact(instrument!, 'Play ' + GENRE_NAMES[g] + ' · sound on', () => onStudio(g))
    sign(p.x, 2.7, p.z + .9, 'TAP THE INSTRUMENT\n21-SECOND REHEARSAL', .65)
  })
  // Broad main stage with two performer positions and a central catwalk.
  box(16, .35, 27.5, 16, .7, 7, color('panel'), true)
  box(16, .72, 27.5, 15.7, .035, 6.7, ink)
  box(16, .2, 22.5, 3.5, .4, 4, color('panel'), true)
  box(16, .035, 21.8, 4.8, .06, 1.4, color('electronic'))
  for (const x of [8.3, 23.7]) {
    box(x, 4.3, 30.8, .22, 7.8, .22, white)
    speaker(x + (x < 16 ? 1 : -1), .7, 29.5, color(x < 16 ? 'kpop' : 'electronic'), 1.2)
    box(x, 1.4, 24.6, .12, 1.5, .12, color('electronic'))
  }
  for (const y of [5.5, 7.6]) box(16, y, 30.8, 15.6, .2, .2, white)
  box(16, 5.4, 31, 12.7, 3.7, .14, color('kpop'))
  box(16, 5.4, 30.88, 12.4, 3.4, .12, ink)
  board = sign(16, 5.6, 30.7, 'THE MAIN STAGE\nLIVE PERFORMANCE COUNTS 2x', 2.2)
  sign(16, 3.6, 30.7, 'RHYTHM / PRECISION / HARMONY / CONSISTENCY', 1.05, color('electronic'))
  for (const x of [12, 20]) { box(x, 1.5, 27, .08, 1.5, .08, white); const mic = sphere(x, 2.3, 27, .4, .5, .4, color(x === 12 ? 'kpop' : 'electronic')); interact(mic, 'Ready for the live show', onStage) }
  // Walkable low steps instead of automatically teleporting a performer.
  box(16, .08, 19.9, 3.5, .16, .9, color('panel'), true)
  box(16, .16, 20.7, 3.5, .32, .8, color('panel'), true)
  box(16, .27, 24.1, 3.5, .54, .7, color('panel'), true)
  sign(16, 2.9, 24, 'AFTER REHEARSAL\nWALK UP AND TAP A MICROPHONE', .9)
  for (let i = 0; i < 14; i++) bars.push(box(9.5 + i, 2.8, 30.4, .38, .6, .1, color(GENRES[i % 6])))
  // Clearly stylized NPC audience; never added to the room's real-player roster.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
    const x = 10.4 + col * 2.15, z = 15.5 + row * 2, c = color(GENRES[(row + col) % 6])
    const body = box(x, .85, z, .45, .7, .3, c)
    sphere(x, 1.48, z, .42, .45, .42, Color4.create(.65 + col * .045, .45 + row * .08, .36, 1))
    for (const dx of [-.15, .15]) box(x + dx, .31, z, .15, .6, .17, ink)
    const placard = box(x, 1.02, z - .22, .75, .58, .07, c)
    const icon = emblem(x, 1.02, z - .27, .53, GENRES[(row + col) % 6])
    crowd.push({ body, sign: placard, icon, x, y: 1.02, z })
  }
  sign(16, 2.5, 13.8, 'NPC FAN ZONE\nTHE CROWD CELEBRATES THE SCORE', .8)
}
export function refreshClub(s: Arena, now: number, reduced: boolean) {
  const text = s.phase === 'lobby' ? 'THE MAIN STAGE\nLIVE PERFORMANCE COUNTS 2x' : s.phase === 'training' ? 'STUDIO REHEARSAL\nBUILD YOUR CREW ATTRIBUTES' : s.phase === 'intermission' ? 'YOUR MOMENT IS NEXT\nWALK UP AND TAP A MICROPHONE' : s.phase === 'battle' ? `LIVE SHOW ${s.round + 1}/5\nEVERY NOTE COUNTS DOUBLE` : s.winner === 'draw' ? 'TWO CREWS. ONE RHYTHM.\nDRAW — BOTH CREWS CELEBRATE' : s.winner ? `${GENRE_NAMES[s.winner].toUpperCase()} WINS!\n${s.crews.map(c => `${GENRE_NAMES[c.genre]} ${total(c.final).toFixed(1)}`).join(' | ')}` : 'SHOW CANCELLED\nNO WINNER AWARDED'
  if (text !== lastBoard) { TextShape.getMutable(board).text = text; lastBoard = text }
  const winner = s.phase === 'result' ? s.winner ?? '' : ''
  if (winner !== lastWinner) {
    crowd.forEach((fan, i) => {
      const g = winner && winner !== 'draw' ? winner : GENRES[i % 6]
      Material.setBasicMaterial(fan.sign, { diffuseColor: color(g), castShadows: false })
      const uv = crewUV(g); MeshRenderer.setPlane(fan.icon, [...uv, ...uv])
    }); lastWinner = winner
  }
  const frame = Math.floor(now / 100)
  if (frame === lastFrame) return; lastFrame = frame
  const active = s.phase === 'battle' || (s.phase === 'result' && !!s.winner)
  bars.forEach((e, i) => {
    const height = !reduced && active ? .4 + .8 * (1 + Math.sin(now / 600 + i * .8)) : .6
    const t = Transform.get(e)
    if (Math.abs(t.scale.y - height) > .001) Transform.getMutable(e).scale.y = height
  })
  crowd.forEach((fan, i) => {
    const raised = s.phase === 'result' && !!s.winner
    const y = raised ? 2.2 + (!reduced ? Math.sin(now / 700 + i) * .12 : 0) : fan.y
    if (Math.abs(Transform.get(fan.sign).position.y - y) > .001) { Transform.getMutable(fan.sign).position.y = y; Transform.getMutable(fan.icon).position.y = y }
  })
}
