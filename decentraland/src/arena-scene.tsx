import { engine, Entity, Transform, MeshRenderer, MeshCollider, Material, TextShape, UiCanvasInformation } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { getPlayer } from '@dcl/sdk/src/players'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { ArenaSession, CHANNEL } from './arena-session'
import { GENRES, GENRE_NAMES, cueFor, CUE_MS, TRAINING_MS, TURN_MS, RESULT_MS, type Genre, type Command } from './arena'
import { arenaLayout, ARENA_TEXT_RGB } from './arena-layout'

const ink = Color4.create(...ARENA_TEXT_RGB.ink, 1)
const white = Color4.create(...ARENA_TEXT_RGB.white, 1)
const muted = Color4.create(...ARENA_TEXT_RGB.muted, 1)
const accent = Color4.create(...ARENA_TEXT_RGB.accent, 1)
export const CREW_RGB: Record<Genre, [number, number, number]> = {
  kpop: [1, 0.64, 0.78], funk: [0.68, 0.86, 0.31], latin: [1, 0.69, 0.42],
  afrobeats: [0.36, 0.83, 0.7], hiphop: [0.74, 0.69, 1], electronic: [0.44, 0.82, 1]
}
const crewColor = (g: Genre) => Color4.create(...CREW_RGB[g], 1)
const bus = new MessageBus()
let session: ArenaSession | null = null
let now = Date.now()
let board: Entity
const stages: Entity[] = []
const meters: Entity[] = []
let elapsed = 0
let submitted = ''
let intent: { key: string; command: Command } | null = null
let lastPhase = ''

function phaseKey() { const s = session?.state; return s ? `${s.match}/${s.phase}/${s.round}` : '' }
function flush() { if (session) for (const p of session.drain()) bus.emit(CHANNEL, p) }
function send(command: Command) {
  if (!session || session.pending) return
  intent = { key: phaseKey(), command }
  session.command(command, Date.now()); flush(); confirmation()
}
function confirmation() {
  if (session && intent && !session.pending) {
    if (session.notice === 'Confirmed.' && (intent.command.kind === 'beat' || intent.command.kind === 'card')) submitted = intent.key
    intent = null
  }
}
function rect(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color4, solid = false) {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(sx, sy, sz) })
  MeshRenderer.setBox(e)
  if (solid) MeshCollider.setBox(e)
  Material.setPbrMaterial(e, { albedoColor: color, roughness: 1, metallic: 0 })
  return e
}
function text(x: number, y: number, z: number, value: string, size = 3) {
  const e = engine.addEntity(); Transform.create(e, { position: Vector3.create(x, y, z) })
  TextShape.create(e, { text: value, fontSize: size, textColor: white }); return e
}
const label = (value: string, height = 26, size = 14, color = white) => <Label value={value} fontSize={size} color={color} textAlign="middle-left" uiTransform={{ width: '100%', height, flexShrink: 0 }} />
function control(value: string, command: Command, enabled: boolean, color = accent, width: '49%' | '32%' = '49%') {
  return <Button value={value} fontSize={13} color={enabled ? ink : muted}
    uiTransform={{ width, height: 46, flexShrink: 0, borderWidth: enabled ? 0 : 1, borderColor: muted }}
    uiBackground={{ color: enabled ? color : ink }} onMouseDown={() => { if (enabled) send(command) }} />
}
function ui() {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  const inset = canvas?.interactableArea
  const layout = arenaLayout(canvas?.width ?? 800, canvas?.height ?? 600, inset?.left ?? 0, inset?.right ?? 0, inset?.top ?? 0, inset?.bottom ?? 0)
  const compact = layout.compact
  const s = session?.state
  const me = s?.players.find(p => p.id === session?.id)
  const pending = !!session?.pending
  const locked = submitted === phaseKey()
  const age = s ? Math.max(0, now + (session?.offset ?? 0) - s.since) : 0
  const duration = s?.phase === 'training' ? TRAINING_MS : s?.phase === 'battle' ? TURN_MS : RESULT_MS
  const seconds = Math.max(0, Math.ceil((duration - age) / 1000))
  const pairs = s ? [...new Set(s.players.map(p => p.genre))] : []
  const rows = [GENRES.slice(0, 3), GENRES.slice(3)]
  const canPick = (g: Genre) => !!session && !pending && !me && s?.phase === 'lobby' && s.players.filter(p => p.genre === g).length < 2 && (pairs.includes(g) || pairs.length < 2)
  const title = !s ? 'Connecting to Decentraland...' : s.phase === 'lobby' ? 'Find your crew'
    : s.phase === 'training' ? `REHEARSAL ${s.round + 1}/6  |  ${seconds}s`
      : s.phase === 'battle' ? `DUEL ${s.round + 1}/5  |  ${seconds}s` : s.winner === 'draw' ? 'DRAW - RUN IT BACK'
        : s.winner ? `${GENRE_NAMES[s.winner].toUpperCase()} WINS` : 'MATCH CANCELLED'
  const myCrew = s?.crews.find(c => c.genre === me?.genre)
  if (layout.width < 280 || layout.height < 272) return <UiEntity uiTransform={{ width: '95%', height: 70 }} uiBackground={{ color: ink }}>
    {label('Affinity Arena: close chat/overlays or use landscape to make room for the controls.', 70, 14)}
  </UiEntity>
  return <UiEntity uiTransform={{ positionType: 'absolute', position: { right: 8, top: 8 }, width: layout.width, height: layout.height, padding: 10, flexDirection: 'column' }} uiBackground={{ color: ink }}>
    {label('AFFINITY ARENA', compact ? 22 : 25, 22)}
    {label(title, compact ? 22 : 25, 15, accent)}
    {!s ? label('Waiting for your player identity. No wallet action required to play.', 60) : s.phase === 'lobby' ? <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      {!compact && label(me ? `Your crew: ${GENRE_NAMES[me.genre]}${me.ready ? ' - READY' : ''}` : 'Choose your music. Train together, then duel.', 24, 13)}
      {rows.map((row, i) => <UiEntity key={`genres-${i}`} uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {row.map(g => control(`${GENRE_NAMES[g]}\n${s.players.filter(p => p.genre === g).length}/2`, { kind: 'join', genre: g }, canPick(g), crewColor(g), '32%'))}
      </UiEntity>)}
      <UiEntity uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {control(me?.ready ? 'Ready confirmed' : 'Ready to rehearse', { kind: 'ready' }, !!me && !me.ready && !pending)}
        {control('Leave crew', { kind: 'leave' }, !!me && !pending, white)}
      </UiEntity>
      {label(`${s.players.length}/4 joined | ${s.players.filter(p => p.ready).length}/4 ready${compact && me ? ` | ${GENRE_NAMES[me.genre]}` : ''}`, 22, 13)}
    </UiEntity> : s.phase === 'training' ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {label(!me ? 'Spectating rehearsal. Join the next match.' : age < CUE_MS ? `REMEMBER: ${['ONE', 'TWO', 'THREE'][cueFor(s, session!.id)]}` : locked ? 'Your cue is locked. Your teammate has their own.' : 'What was YOUR cue? Tap once before time runs out.', 40, 15)}
      <UiEntity uiTransform={{ width: '100%', height: 52, justifyContent: 'space-between' }}>
        {[0, 1, 2].map(v => control(['ONE', 'TWO', 'THREE'][v], { kind: 'beat', value: v }, !!me && age >= CUE_MS && age < TRAINING_MS && !pending && !locked, accent, '32%'))}
      </UiEntity>
      {label(compact ? 'Both correct = shield. Each correct = energy progress.' : 'Both teammates correct = harmony shield.\nEvery correct cue helps build battle energy.', compact ? 24 : 42, 13, muted)}
      {label(s.crews.map(c => `${GENRE_NAMES[c.genre]}: ${c.hits} cues / ${c.harmony} harmony`).join('\n'), 36, 13)}
    </UiEntity> : s.phase === 'battle' ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {label(myCrew ? `Shared energy ${myCrew.energy}/12 | HP ${myCrew.hp} | Shield ${myCrew.shield}` : 'Spectating. Join after this duel.', 27, 13)}
      <UiEntity uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {control('Attack  |  cost 2\n13 damage', { kind: 'card', value: 'attack' }, !!me && !pending && !locked && age < TURN_MS)}
        {control('Guard  |  cost 1\nBlock 10 damage', { kind: 'card', value: 'guard' }, !!me && !pending && !locked && age < TURN_MS, white)}
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {control('Charge  |  free\nGain 3 energy', { kind: 'card', value: 'charge' }, !!me && !pending && !locked && age < TURN_MS, white)}
        {control('Combo  |  cost 3 each\nSolo 5 / together 36', { kind: 'card', value: 'combo' }, !!me && !pending && !locked && age < TURN_MS)}
      </UiEntity>
      {!compact && label(locked ? 'Choice locked. Reveal when the timer ends.' : 'One card each. Overspend: both paid cards fail.', 28, 13, muted)}
      {label(s.round === 0 ? 'Shared budget: overspend and paid cards fail.\nEach turn also restores 1 energy. No card = pass.' : s.log.slice(0, 2).join('\n'), compact ? 50 : 62, 12, muted)}
    </UiEntity> : <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {label(s.winner ? 'Different tastes. Shared teamwork. Good game!' : 'No winner awarded.', compact ? 28 : 45, 15)}
      {label(s.crews.map(c => `${GENRE_NAMES[c.genre]}: ${c.hp} HP remaining`).join('\n'), compact ? 34 : 46, 15)}
      {label(s.log.slice(0, 2).join('\n'), 62, 12, muted)}
      {label(`New lobby in ${seconds}s. Choose your crew again.`, compact ? 30 : 44, 14, accent)}
    </UiEntity>}
    {label(session?.notice ?? 'Connecting...', 23, 12, muted)}
  </UiEntity>
}
function refreshStage() {
  const s = session?.state
  if (!s || !board) return
  const names = [...new Set(s.players.map(p => p.genre))]
  const battleLines = s.crews.map(c => `${GENRE_NAMES[c.genre]}   ${c.hp} HP   ${c.energy} ENERGY`).join('\n')
  TextShape.getMutable(board).text = s.phase === 'lobby' ? `AFFINITY ARENA\n${s.players.length}/4 PLAYERS\nTWO CREWS. ONE SHARED RHYTHM.`
    : `${s.phase.toUpperCase()}\n${battleLines}\n${s.phase === 'result' ? s.winner === 'draw' ? 'DRAW' : s.winner ? `${GENRE_NAMES[s.winner]} WINS` : 'CANCELLED' : ''}`
  for (let i = 0; i < 2; i++) {
    Material.setPbrMaterial(stages[i], { albedoColor: names[i] ? crewColor(names[i]) : muted, roughness: 1 })
    const height = s.crews[i] ? 0.2 + s.crews[i].hp / 100 * 2 : 0.2
    Transform.getMutable(meters[i]).scale.y = height
    Transform.getMutable(meters[i]).position.y = 0.3 + height / 2
  }
  const key = phaseKey()
  if (key !== lastPhase) {
    lastPhase = key
    console.log('[Affinity Arena]', JSON.stringify({ phase: s.phase, round: s.round, players: s.players.length, mode: 'SDK7_NATIVE', walletActions: 0, simulatedPlayers: 0 }))
  }
}
export function main() {
  rect(8, 0, 8, 15.7, 0.1, 15.7, ink, true)
  rect(8, 0.09, 8, 0.15, 0.08, 13, accent)
  stages.push(rect(4, 0.17, 8, 5.5, 0.2, 6, muted), rect(12, 0.17, 8, 5.5, 0.2, 6, muted))
  for (const x of [2, 6, 10, 14]) {
    rect(x, 0.7, 12.5, 0.75, 1.4, 0.75, muted)
    rect(x, 1, 12.08, 0.48, 0.48, 0.05, ink)
  }
  meters.push(rect(4, 0.4, 11, 0.5, 0.2, 0.5, accent), rect(12, 0.4, 11, 0.5, 0.2, 0.5, accent))
  board = text(8, 4, 13, 'AFFINITY ARENA\nFIND YOUR MUSIC CREW', 2.5)
  text(8, 0.7, 3, 'REHEARSE TOGETHER. DUEL TOGETHER.', 1.5)
  bus.on(CHANNEL, (packet: unknown, sender: string) => {
    if (!session || !sender || sender === 'self') return
    session.receive(packet, sender.toLowerCase(), Date.now()); flush(); confirmation()
  })
  engine.addSystem(dt => {
    elapsed += dt
    if (elapsed < 0.1) return
    elapsed = 0; now = Date.now()
    const id = getPlayer()?.userId?.toLowerCase()
    if (id && (!session || session.id !== id)) session = new ArenaSession(id, now)
    if (!id) { session = null; return }
    session!.tick(now); flush(); confirmation(); refreshStage()
  })
  ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 0, virtualHeight: 0, screenInset: 'interactable' })
}
