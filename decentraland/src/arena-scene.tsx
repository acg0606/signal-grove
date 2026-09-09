import { engine, Entity, Transform, MeshRenderer, MeshCollider, Material, TextShape, UiCanvasInformation, AudioSource, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { getPlayer } from '@dcl/sdk/src/players'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { ArenaSession, CHANNEL } from './arena-session'
import { GENRES, GENRE_NAMES, cueFor, CARD_PICK_MS, type Genre, type Command } from './arena'
import { arenaLayout, ARENA_TEXT_RGB } from './arena-layout'
import { NOTE_NAMES, noteTime, tempo, TRACKS, EARLY_MS, LATE_MS } from './rhythm'
import { Warmup, ChangeGate, crewAvailability, lobbyHint, phaseCue } from './arena-experience'

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
let audioEntity: Entity
let resultAudio: Entity
let previousHp = [100, 100]
let pulseUntil = 0
let audioEnabled = false
let audioKey = ''
let practice: Warmup | null = null
let lobbyView: 'crews' | 'warmup' | 'guide' = 'crews'
let reducedMotion = false
let stageOnly = false
const stageGate = new ChangeGate()
let played = 0
let noteFeedback = 'Tap C / E / G when a note meets the gold line.'
const crewSigns: Entity[] = []
const pulseNotes: Entity[] = []

function phaseKey() { const s = session?.state; return s ? `${s.match}/${s.phase}/${s.round}` : '' }
function flush() { if (session) for (const p of session.drain()) bus.emit(CHANNEL, p) }
function send(command: Command) {
  if (!session || (session.pending && !(command.kind === 'note' && session.pending.packet.envelope.command.kind === 'note'))) return
  intent = { key: phaseKey(), command }
  session.command(command, Date.now()); flush(); confirmation()
}
function confirmation() {
  if (session && intent && !session.pending) {
    if (session.notice === 'Confirmed.' && intent.command.kind === 'card') submitted = intent.key
    if (session.notice === 'Confirmed.' && intent.command.kind === 'note' && intent.key === phaseKey()) {
      played |= 1 << intent.command.index
      noteFeedback = intent.command.value === cueFor(session.state, session.id, intent.command.index) ? 'ON BEAT — keep the crew together!' : 'Wrong lane. Follow the next note.'
    }
    intent = null
  }
}
function tapLane(lane: number) {
  const s = session?.state
  if (practice && s?.phase === 'lobby') { practice.tap(lane, Date.now()); return }
  if (!s || !session || (session.pending && session.pending.packet.envelope.command.kind !== 'note') || !s.players.some(p => p.id === session!.id) || !['training', 'battle'].includes(s.phase)) return
  const age = Date.now() + session.offset - s.since
  const candidates = [0, 1, 2, 3].filter(i => !(played & (1 << i)) && age >= noteTime(s.round, i, s.phase === 'battle') - EARLY_MS && age <= noteTime(s.round, i, s.phase === 'battle') + LATE_MS)
  candidates.sort((a, b) => Math.abs(age - noteTime(s.round, a, s.phase === 'battle')) - Math.abs(age - noteTime(s.round, b, s.phase === 'battle')))
  if (!candidates.length) { noteFeedback = 'Wait for the note to reach the gold line.'; return }
  send({ kind: 'note', value: lane, index: candidates[0] })
}
function instrument(age: number, compact: boolean) {
  const s = session!.state, drill = s.phase === 'lobby' ? practice : null
  const active = drill ? !drill.done(now) : s.players.some(p => p.id === session!.id)
  const round = drill?.round ?? s.round, mask = drill?.mask ?? played, h = compact ? 48 : 108
  return <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', flexShrink: 0 }}>
    <UiEntity uiTransform={{ width: '100%', height: h, positionType: 'relative', flexShrink: 0 }} uiBackground={{ color: Color4.create(.09, .11, .15, 1) }}>
      {[0, 1, 2].map(lane => <UiEntity key={`lane-${lane}`} uiTransform={{ positionType: 'absolute', position: { left: `${lane * 33.33}%`, top: 0 }, width: '32%', height: h, borderWidth: 1, borderColor: muted }} />)}
      <UiEntity uiTransform={{ positionType: 'absolute', position: { left: 0, top: h - 18 }, width: '100%', height: 3 }} uiBackground={{ color: accent }} />
      {[0, 1, 2, 3].map(i => {
        const delta = noteTime(round, i, s.phase === 'battle') - age
        const y = (h - 18) - delta / 1500 * (h - 18)
        const lane = drill ? drill.lane(i) : cueFor(s, session!.id, i)
        return active && delta <= 1500 && delta >= -LATE_MS && !(mask & (1 << i)) ? <UiEntity key={`note-${i}`} uiTransform={{ positionType: 'absolute', position: { left: `${lane * 33.33 + 3}%`, top: Math.min(h - 20, Math.max(0, y - 10)) }, width: '26%', height: 20 }} uiBackground={{ color: accent }}><Label value={NOTE_NAMES[lane]} fontSize={14} color={ink} uiTransform={{ width: '100%', height: 20 }} /></UiEntity> : null
      })}
    </UiEntity>
    <UiEntity uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between', flexShrink: 0 }}>
      {NOTE_NAMES.map((name, i) => <Button key={name} value={`${name}  /  ${i + 1}`} fontSize={17} color={ink} uiTransform={{ width: '32%', height: 46 }} uiBackground={{ color: active ? accent : muted }} onMouseDown={() => tapLane(i)} />)}
    </UiEntity>
  </UiEntity>
}
function rect(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color4, solid = false) {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(sx, sy, sz) })
  MeshRenderer.setBox(e)
  if (solid) MeshCollider.setBox(e)
  Material.setBasicMaterial(e, { diffuseColor: color, castShadows: false })
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
function localButton(value: string, action: () => void, selected = false, width: '49%' | '32%' | '100%' = '32%') {
  return <Button value={value} fontSize={12} color={selected ? ink : white} uiTransform={{ width, height: 42, flexShrink: 0, borderWidth: 1, borderColor: selected ? accent : muted }} uiBackground={{ color: selected ? accent : ink }} onMouseDown={action} />
}
function startWarmup(round = 0) { practice = new Warmup(Date.now(), round); audioKey = ''; lobbyView = 'warmup' }
function stopWarmup() { practice = null; audioKey = '' }
function ui() {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  const inset = canvas?.interactableArea
  const layout = arenaLayout(canvas?.width ?? 800, canvas?.height ?? 600, inset?.left ?? 0, inset?.right ?? 0, inset?.top ?? 0, inset?.bottom ?? 0)
  const compact = layout.compact
  const s = session?.state
  const me = s?.players.find(p => p.id === session?.id)
  const pending = !!session?.pending
  const locked = submitted === phaseKey()
  const cue = s ? phaseCue(s, now + (session?.offset ?? 0)) : null
  const age = cue?.age ?? 0, seconds = cue?.seconds ?? 0
  const rows = [GENRES.slice(0, 3), GENRES.slice(3)]
  const title = s?.phase === 'lobby' && lobbyView === 'warmup' ? 'Soundcheck. Find your timing.' : s?.phase === 'lobby' && lobbyView === 'guide' ? 'The crowd is your crew.' : cue?.text ?? 'Connecting to Decentraland...'
  const myCrew = s?.crews.find(c => c.genre === me?.genre)
  if (layout.width < 280 || layout.height < 332) return <UiEntity uiTransform={{ width: '95%', height: 70 }} uiBackground={{ color: ink }}>
    {label('Affinity Arena: close chat/overlays or rotate to portrait for the note controls.', 70, 14)}
  </UiEntity>
  if (stageOnly && s?.phase === 'lobby') return <UiEntity uiTransform={{ positionType: 'absolute', position: { right: 8, bottom: 8 }, width: 220, height: 46 }} uiBackground={{ color: ink }}>{localButton('Back to crew controls', () => { stageOnly = false }, true, '100%')}</UiEntity>
  const deskHeight = compact ? 332 : s?.phase === 'result' ? 430 : 410
  return <UiEntity uiTransform={{ positionType: 'absolute', position: { right: 8, bottom: 8 }, width: layout.width, height: Math.min(layout.height, deskHeight), padding: 10, flexDirection: 'column' }} uiBackground={{ color: ink }}>
    <UiEntity uiTransform={{ width: '100%', height: 40, flexShrink: 0, justifyContent: 'space-between' }}>
      <Label value="AFFINITY ARENA" fontSize={compact ? 16 : 20} color={accent} textAlign="middle-left" uiTransform={{ width: '65%', height: 40 }} />
      <Button value={audioEnabled ? 'Mute' : 'Sound on'} fontSize={12} color={ink} uiTransform={{ width: '33%', height: 40 }} uiBackground={{ color: muted }} onMouseDown={() => { audioEnabled = !audioEnabled; audioKey = '' }} />
    </UiEntity>
    {label(title, compact ? 22 : 25, 15, accent)}
    <UiEntity uiTransform={{ width: '100%', height: 6, flexShrink: 0 }} uiBackground={{ color: Color4.create(.18, .20, .24, 1) }}><UiEntity uiTransform={{ width: `${(cue?.progress ?? 0) * 100}%`, height: 3 }} uiBackground={{ color: accent }} /></UiEntity>
    {!s ? label('Waiting for your player identity. No wallet action required to play.', 60) : s.phase === 'lobby' ? <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', flexShrink: 0 }}>
      {lobbyView === 'crews' ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', flexShrink: 0 }}>
      {!compact && label(me ? `Your crew: ${GENRE_NAMES[me.genre]}${me.ready ? ' - READY' : ''}` : 'Choose your music. Train together, then duel.', 24, 13)}
      {rows.map((row, i) => <UiEntity key={`genres-${i}`} uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {row.map(g => { const choice = crewAvailability(s, session!.id, g, pending); return control(`${GENRE_NAMES[g]}\n${choice.count}/2 · ${choice.reason}`, { kind: 'join', genre: g }, choice.enabled, crewColor(g), '32%') })}
      </UiEntity>)}
      <UiEntity uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {control(me?.ready ? 'Ready confirmed' : 'Ready to rehearse', { kind: 'ready' }, !!me && !me.ready && !pending)}
        {control('Leave crew', { kind: 'leave' }, !!me && !pending, white)}
      </UiEntity>
      {label(`${s.players.length}/4 joined | ${s.players.filter(p => p.ready).length}/4 ready${compact && me ? ` | ${GENRE_NAMES[me.genre]}` : ''}`, 22, 13)}
      {!compact && label(lobbyHint(s, session!.id), 38, 13, muted)}
      </UiEntity> : lobbyView === 'warmup' ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', flexShrink: 0 }}>
        {label('SOLO PRACTICE · no team points or extra players', 22, 12, muted)}
        {practice ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', flexShrink: 0 }}>
          {!compact && label(`${TRACKS[practice.round]} · ${tempo(practice.round)} BPM`, 24, 14)}
          {practice.done(now) ? <UiEntity uiTransform={{ width: '100%', height: compact ? 98 : 158, flexDirection: 'column' }}>
            {label(`${practice.hits}/4 on beat. ${practice.hits >= 3 ? 'You found the groove.' : 'Try again. No pressure.'}`, 48, 16, accent)}
            <UiEntity uiTransform={{ width: '100%', height: 44, justifyContent: 'space-between' }}>{localButton('Replay', () => startWarmup(practice!.round), false, '49%')}{localButton('Next groove', () => startWarmup((practice!.round + 1) % 6), true, '49%')}</UiEntity>
          </UiEntity> : instrument(practice.age(now), compact)}
          {label(practice.done(now) ? 'Head back to Crews whenever you are ready.' : practice.feedback, 36, 12, muted)}
        </UiEntity> : <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', height: compact ? 150 : 210 }}>
          {label('Tap the matching C / E / G pad at the gold line.\nKeys 1 / 2 / 3. Sound is optional.', 64, 14)}
          {localButton('Start 7-second warm-up', () => startWarmup(), true, '100%')}
        </UiEntity>}
      </UiEntity> : <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', flexShrink: 0 }}>
        {label('1  CREW UP\nTwo music crews. Two real fans on each.', compact ? 38 : 48, 13)}
        {label('2  REHEARSE\n3/4 notes earns success. Both succeed: shield.', compact ? 38 : 48, 13)}
        {label('3  DUEL\nPick a card, then hit notes. Share your energy.', compact ? 38 : 48, 13)}
        {!compact && label('Original synthesized grooves. No artist recordings.\nDifferent tastes. Equal power. Good games.', 42, 13, muted)}
        <UiEntity uiTransform={{ width: '100%', height: 44, justifyContent: 'space-between' }}>{localButton(reducedMotion ? 'Motion: reduced' : 'Reduce motion', () => { reducedMotion = !reducedMotion }, reducedMotion, '49%')}{localButton('View the stage', () => { stopWarmup(); stageOnly = true }, false, '49%')}</UiEntity>
      </UiEntity>}
      <UiEntity uiTransform={{ width: '100%', height: 44, justifyContent: 'space-between', flexShrink: 0 }}>{(['crews', 'warmup', 'guide'] as const).map(view => localButton(view === 'crews' ? 'Crews' : view === 'warmup' ? 'Warm-up' : 'How to play', () => { if(view !== 'warmup') stopWarmup(); lobbyView = view }, lobbyView === view))}</UiEntity>
    </UiEntity> : s.phase === 'training' ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {label(`${TRACKS[s.round]} | ${tempo(s.round)} BPM | ${me ? 'C / E / G' : 'SPECTATING'}`, 24, 13)}
      {instrument(age, compact)}
      {label(pending ? 'Sending note...' : noteFeedback, 20, 12, accent)}
      {label('3/4 notes = success. Both succeed = shield.', 22, 12, muted)}
      {!compact && label(s.crews.map(c => `${GENRE_NAMES[c.genre]}: ${c.hits} successes / ${c.harmony} harmony`).join('\n'), 36, 13)}
    </UiEntity> : s.phase === 'battle' ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      <UiEntity uiTransform={{ width: '100%', height: 44, justifyContent: 'space-between', flexShrink: 0 }}>
        {s.crews.map(c => <UiEntity key={`score-${c.genre}`} uiTransform={{ width: '49%', height: 44, flexDirection: 'column' }}>
          {label(`${c.genre === me?.genre ? 'YOU · ' : ''}${GENRE_NAMES[c.genre]} · ${c.hp} HP`, 20, 12, crewColor(c.genre))}
          <UiEntity uiTransform={{ width: '100%', height: 4 }} uiBackground={{ color: muted }}><UiEntity uiTransform={{ width: `${c.hp}%`, height: 4 }} uiBackground={{ color: crewColor(c.genre) }} /></UiEntity>
          {label(`Energy ${c.energy}/12 · Shield ${c.shield}`, 20, 12, muted)}
        </UiEntity>)}
      </UiEntity>
      {age < CARD_PICK_MS ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}><UiEntity uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {control('RIFF  |  cost 2\n13 damage + notes', { kind: 'card', value: 'attack' }, !!me && !pending && !locked && (myCrew?.energy ?? 0) >= 2, crewColor('kpop'))}
        {control('REST  |  cost 1\nBlock 10 damage', { kind: 'card', value: 'guard' }, !!me && !pending && !locked && (myCrew?.energy ?? 0) >= 1, crewColor('electronic'))}
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', height: 50, justifyContent: 'space-between' }}>
        {control('AMP  |  free\nGain 3 energy', { kind: 'card', value: 'charge' }, !!me && !pending && !locked, accent)}
        {control('CHORD  |  cost 3 each\nSolo 5 / together 36', { kind: 'card', value: 'combo' }, !!me && !pending && !locked && (myCrew?.energy ?? 0) >= 3, crewColor('hiphop'))}
      </UiEntity>
      </UiEntity> : instrument(age, compact)}
      {label(age < CARD_PICK_MS ? locked ? 'Card confirmed. Get ready for the notes.' : 'Shared budget. Coordinate; overspending fails.' : pending ? 'Sending note...' : noteFeedback, 26, 12, accent)}
      {label(s.round === 0 ? 'Notes: up to +4 crew attack. Reveal at 12s.\nEach turn restores 1 energy. No card = pass.' : s.log.slice(0, 2).join('\n'), compact ? 32 : 38, 12, muted)}
    </UiEntity> : <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
      {label(s.winner ? 'Different tastes. Shared teamwork. Good game!' : 'No winner awarded.', compact ? 28 : 45, 15)}
      {label(s.crews.map(c => `${GENRE_NAMES[c.genre]}: ${c.hp} HP remaining`).join('\n'), compact ? 34 : 46, 15)}
      {label(s.log.slice(0, 2).join('\n'), compact ? 44 : 62, 12, muted)}
      {label(`New lobby in ${seconds}s. Choose your crew again.`, compact ? 30 : 44, 14, accent)}
    </UiEntity>}
    {s?.phase !== 'training' && label(pending ? 'Confirming your choice...' : session?.notice ?? 'Connecting...', 23, 12, muted)}
  </UiEntity>
}
function refreshStage() {
  const s = session?.state
  if (!s || !board) return
  const names = [...new Set(s.players.map(p => p.genre))]
  const battleLines = s.crews.map(c => `${GENRE_NAMES[c.genre]}   ${c.hp} HP   ${c.energy} ENERGY`).join('\n')
  const boardText = s.phase === 'lobby' ? `AFFINITY ARENA\n${s.players.length}/4 PLAYERS\nTWO CREWS. ONE SHARED RHYTHM.`
    : `${s.phase.toUpperCase()}\n${battleLines}\n${s.phase === 'result' ? s.winner === 'draw' ? 'DRAW' : s.winner ? `${GENRE_NAMES[s.winner]} WINS` : 'CANCELLED' : ''}`
  if (stageGate.changed('board', boardText)) TextShape.getMutable(board).text = boardText
  for (let i = 0; i < 2; i++) {
    if (stageGate.changed(`crew-${i}`, names[i] ?? '')) {
      TextShape.getMutable(crewSigns[i]).text = names[i] ? GENRE_NAMES[names[i]].toUpperCase() : i === 0 ? 'YOUR CREW' : 'RIVAL CREW'
      Material.setBasicMaterial(stages[i], { diffuseColor: names[i] ? crewColor(names[i]) : muted, castShadows: false })
    }
    const height = s.crews[i] ? 0.2 + s.crews[i].hp / 100 * 2 : 0.2
    if (stageGate.changed(`hp-${i}`, height)) {
      Transform.getMutable(meters[i]).scale.y = height
      Transform.getMutable(meters[i]).position.y = 0.3 + height / 2
    }
  }
  const key = phaseKey()
  if (key !== lastPhase) {
    played = 0; noteFeedback = 'Tap C / E / G at the gold line. Keys 1 / 2 / 3.'
    lastPhase = key
    if (s.phase !== 'lobby') { stopWarmup(); stageOnly = false; lobbyView = 'crews' }
    console.log('[Affinity Arena]', JSON.stringify({ phase: s.phase, round: s.round, players: s.players.length, mode: 'SDK7_NATIVE', walletActions: 0, simulatedPlayers: 0 }))
  }
  const age = now + (session?.offset ?? 0) - s.since
  if (s.crews.some((c, i) => c.hp < previousHp[i])) {
    pulseUntil = now + 800
    if (audioEnabled) AudioSource.createOrReplace(resultAudio, { audioClipUrl: 'assets/sounds/resolve.wav', playing: true, loop: false, global: true, volume: .4, currentTime: 0 })
  }
  previousHp = s.crews.length ? s.crews.map(c => c.hp) : [100, 100]
  if (!audioEnabled) {
    if (AudioSource.getOrNull(audioEntity)?.playing) AudioSource.getMutable(audioEntity).playing = false
    if (AudioSource.getOrNull(resultAudio)?.playing) AudioSource.getMutable(resultAudio).playing = false
  }
  const soundAge = practice ? practice.age(now) : age - (s.phase === 'battle' ? 3000 : 0)
  const soundKey = practice ? `practice/${practice.startedAt}/${audioEnabled}` : `${key}/${audioEnabled}`
  if (soundKey !== audioKey && soundAge >= 0) {
    audioKey = soundKey
    const soundPlaying = audioEnabled && (!!practice || ['training', 'battle'].includes(s.phase)) && soundAge < 7000
    if (soundPlaying) AudioSource.createOrReplace(audioEntity, { audioClipUrl: `assets/sounds/arena-${practice?.round ?? s.round}.wav`, playing: true, loop: false, volume: .4, global: true, currentTime: Math.max(0, soundAge / 1000) })
    else if (AudioSource.getOrNull(audioEntity)?.playing) AudioSource.getMutable(audioEntity).playing = false
  }
  for (let i = 0; i < pulseNotes.length; i++) {
    const active = !reducedMotion && now < pulseUntil
    // A single outward swell, not repeated flashing; no writes while idle.
    const height = active ? .08 + .12 * Math.sin(Math.PI * (1 - (pulseUntil - now) / 800)) : .08
    if (stageGate.changed(`pulse-${i}`, height)) Transform.getMutable(pulseNotes[i]).scale.y = height
  }
}
export function main() {
  rect(8, 0, 8, 15.7, 0.1, 15.7, Color4.create(.12, .14, .18, 1), true)
  // Architectural backdrop keeps the show legible against changing World terrain.
  rect(8, 2.65, 14.6, 15.2, 5.3, .18, ink)
  rect(8, 0.09, 8, 0.15, 0.08, 13, accent)
  stages.push(rect(4, 0.17, 8, 5.5, 0.2, 6, crewColor('kpop')), rect(12, 0.17, 8, 5.5, 0.2, 6, crewColor('funk')))
  for (const x of [4, 12]) {
    rect(x, .29, 8, 5.3, .03, 5.8, Color4.create(.10, .12, .16, 1))
    for (const z of [5.15, 10.85]) rect(x, .33, z, 5.3, .06, .08, accent)
    crewSigns.push(text(x, 2.65, 11.6, x === 4 ? 'YOUR CREW' : 'RIVAL CREW', 1.6))
    for (const dx of [-2.8, 2.8]) rect(x + dx, 2.4, 12.8, .12, 4.8, .12, accent)
    rect(x, 4.8, 12.8, 5.7, .12, .12, accent)
    for (let n = 0; n < 7; n++) rect(x - 2.1 + n * .7, 3.5, 12.6, .18, .3 + (n % 3) * .2, .1, x === 4 ? crewColor('kpop') : crewColor('funk'))
  }
  rect(8, 4, 13.25, 7.2, 2.1, .15, accent)
  rect(8, 4, 13.14, 7, 1.9, .08, ink)
  for (let i = 0; i < 20; i++) pulseNotes.push(rect(3.2 + i * .5, .42, 8, .15, .08, .12, i < 10 ? crewColor('kpop') : crewColor('funk')))
  for (const x of [2, 6, 10, 14]) {
    rect(x, 1.05, 12.5, .85, 2.1, .75, Color4.create(.10, .12, .16, 1))
    for (const y of [.5, 1.35]) {
      const cone = engine.addEntity(); Transform.create(cone, { position: Vector3.create(x, y, 12.08), scale: Vector3.create(.52, .52, .06) })
      MeshRenderer.setSphere(cone); Material.setBasicMaterial(cone, { diffuseColor: muted, castShadows: false })
    }
  }
  meters.push(rect(4, 0.4, 11, 0.5, 0.2, 0.5, accent), rect(12, 0.4, 11, 0.5, 0.2, 0.5, accent))
  board = text(8, 4, 13, 'AFFINITY ARENA\nFIND YOUR MUSIC CREW', 2.5)
  text(8, 0.7, 3, 'REHEARSE TOGETHER. DUEL TOGETHER.', 1.5)
  audioEntity = engine.addEntity()
  resultAudio = engine.addEntity()
  Transform.create(audioEntity, { position: Vector3.create(8, 2, 8) })
  Transform.create(resultAudio, { position: Vector3.create(8, 2, 8) })
  engine.addSystem(() => {
    for (const [i, action] of [InputAction.IA_ACTION_3, InputAction.IA_ACTION_4, InputAction.IA_ACTION_5].entries()) if (inputSystem.isTriggered(action, PointerEventType.PET_DOWN)) tapLane(i)
  })
  bus.on(CHANNEL, (packet: unknown, sender: string) => {
    if (!session || !sender || sender === 'self') return
    session.receive(packet, sender.toLowerCase(), Date.now()); flush(); confirmation()
  })
  engine.addSystem(dt => {
    elapsed += dt
    if (elapsed < 0.05) return
    elapsed = 0; now = Date.now()
    const id = getPlayer()?.userId?.toLowerCase()
    if (id && (!session || session.id !== id)) session = new ArenaSession(id, now)
    if (!id) { session = null; return }
    session!.tick(now); flush(); confirmation(); refreshStage()
  })
  ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 0, virtualHeight: 0, screenInset: 'interactable' })
}
