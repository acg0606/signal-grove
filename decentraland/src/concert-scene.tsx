import { engine, Entity, Transform, UiCanvasInformation, AudioSource, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { getPlayer } from '@dcl/sdk/src/players'
import { movePlayerTo } from '~system/RestrictedActions'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { ConcertSession, CHANNEL } from './concert-session'
import { GENRES, GENRE_NAMES, ATTRIBUTES, QUEUE_MS, cueFor, total, type Genre, type Command } from './concert'
import { concertLayout } from './concert-layout'
import { buildClub, refreshClub, studioPosition, color, crewUV, ATLAS } from './concert-world'
import { NOTE_NAMES, noteTime, tempo, TRACKS, EARLY_MS, LATE_MS } from './rhythm'
import { Warmup } from './arena-experience'

const bus = new MessageBus(), ink = color('ink'), white = color('white'), muted = color('muted'), cyan = color('electronic')
let session: ConcertSession | null = null, clock = Date.now(), delta = 0
let sound = false, reduced = false, large = false, hidden = false, guide = false, page = 0, scorePage = 0
let practice: Warmup | null = null, entered = '', phaseKey = '', played = 0, feedback = 'Tap at the white strike line.'
let soundEntity: Entity, resultEntity: Entity, audioKey = '', resultKey = '', moveNotice = ''
let intent: { index: number; lane: number; phase: string } | null = null
let scale = 1
const px = (n: number) => n * scale
const key = () => session ? `${session.state.match}/${session.state.phase}/${session.state.round}` : ''
function flush() { if (session) for (const p of session.drain()) bus.emit(CHANNEL, p) }
function command(c: Command) { if (!session) return; session.command(c, Date.now()); flush() }
function travel(x: number, y: number, z: number, targetZ: number) {
  moveNotice = ''
  void movePlayerTo({ newRelativePosition: Vector3.create(x, y, z), cameraTarget: Vector3.create(x, 2.3, targetZ) }).then(r => {
    if (!r.success) moveNotice = 'Auto-move unavailable. Follow the studio / stage signs.'
  }).catch(() => { moveNotice = 'Auto-move unavailable. Follow the studio / stage signs.' })
}
function choose(g: Genre) { command({ kind: 'join', genre: g }); guide = false; hidden = false }
function tap(lane: number) {
  if (!session) return
  const s = session.state
  if (practice && s.phase === 'lobby') { practice.tap(lane, Date.now()); feedback = practice.feedback.replace(/gold/g, 'white'); return }
  if (!['training', 'battle'].includes(s.phase) || !s.players.some(p => p.id === session!.id)) return
  const age = Date.now() + session.offset - s.since
  const available = [0, 1, 2, 3].filter(i => !(played & (1 << i)) && age >= noteTime(s.round, i, s.phase === 'battle') - EARLY_MS && age <= noteTime(s.round, i, s.phase === 'battle') + LATE_MS)
  available.sort((a, b) => Math.abs(age - noteTime(s.round, a, s.phase === 'battle')) - Math.abs(age - noteTime(s.round, b, s.phase === 'battle')))
  if (!available.length) { feedback = 'Wait for the white strike line.'; return }
  intent = { index: available[0], lane, phase: key() }
  command({ kind: 'note', index: available[0], value: lane })
}
function line(value: string, height = 28, size = 18, c = white) {
  return <Label value={value} fontSize={px(size)} color={c} textAlign="middle-left" uiTransform={{ width: '100%', height: px(height), flexShrink: 0 }} />
}
function button(value: string, action: () => void, width: number | `${number}%` = '100%', active = true, c = cyan, height = 56) {
  return <Button value={value} fontSize={px(18)} color={active ? ink : muted}
    uiTransform={{ width: typeof width === 'number' ? px(width) : width, height: px(height), flexShrink: 0, borderWidth: active ? 0 : px(1), borderColor: muted }}
    uiBackground={{ color: active ? c : color('panel') }} onMouseDown={() => { if (active) action() }} />
}
function icon(g: Genre, size: number, action: () => void) {
  return <UiEntity uiTransform={{ width: px(size), height: px(size), flexShrink: 0 }} uiBackground={{ textureMode: 'stretch', texture: { src: ATLAS }, uvs: crewUV(g) }} onMouseDown={action} />
}
function crewTile(g: Genre, height: number) {
  const s = session!.state, count = s.players.filter(p => p.genre === g).length
  const enabled = s.phase === 'lobby' && count < 2 && (new Set(s.players.map(p => p.genre)).size < 2 || count > 0)
  const title = g === 'funk' ? 'Brazilian\nFunk' : GENRE_NAMES[g]
  return <UiEntity key={g} uiTransform={{ width: '49%', height: px(height), flexDirection: 'row', alignItems: 'center', padding: px(6) }} uiBackground={{ color: color('panel') }}>
    {icon(g, height - 18, () => { if (enabled) choose(g) })}
    <UiEntity uiTransform={{ flexDirection: 'column', flexGrow: 1, height: px(height - 10) }}>
      <Button value={title} fontSize={px(18)} color={enabled ? color(g) : muted} uiTransform={{ width: '100%', height: px(height - 38) }} uiBackground={{ color: color('panel') }} onMouseDown={() => { if (enabled) choose(g) }} />
      <Label value={enabled ? `Enter studio · ${count}/2` : 'Crew full'} fontSize={px(14)} color={white} uiTransform={{ width: '100%', height: px(24) }} />
    </UiEntity>
  </UiEntity>
}
function instrument(height: number, age: number, round: number, lobby: boolean) {
  const s = session!.state, h = Math.max(60, height - 68), mask = lobby ? practice?.mask ?? 0 : played
  const active = lobby ? !!practice : s.players.some(p => p.id === session!.id)
  return <UiEntity uiTransform={{ width: '100%', height: px(height), flexDirection: 'column', flexShrink: 0 }}>
    <UiEntity uiTransform={{ width: '100%', height: px(h), positionType: 'relative', flexShrink: 0 }} uiBackground={{ color: color('panel') }}>
      {[0, 1, 2].map(l => <UiEntity key={`track-${l}`} uiTransform={{ positionType: 'absolute', position: { left: `${l * 33.33}%`, top: 0 }, width: '32%', height: '100%', borderWidth: px(1), borderColor: color(['kpop', 'funk', 'electronic'][l] as Genre) }} />)}
      <UiEntity uiTransform={{ positionType: 'absolute', position: { left: 0, top: px(h - 18) }, width: '100%', height: px(4) }} uiBackground={{ color: white }} />
      {[0, 1, 2, 3].map(i => {
        const target = noteTime(round, i, !lobby && s.phase === 'battle'), wait = target - age
        const lane = lobby ? practice!.lane(i) : cueFor(s, session!.id, i)
        const y = Math.max(0, Math.min(h - 28, h - 18 - wait / 1700 * (h - 18) - 14))
        return active && wait <= 1700 && wait >= -LATE_MS && !(mask & (1 << i)) ? <UiEntity key={`note-${i}`} uiTransform={{ positionType: 'absolute', position: { left: `${lane * 33.33 + 3}%`, top: px(y) }, width: '26%', height: px(28) }} uiBackground={{ color: color(['kpop', 'funk', 'electronic'][lane] as Genre) }}><Label value={NOTE_NAMES[lane]} fontSize={px(22)} color={ink} uiTransform={{ width: '100%', height: px(28) }} /></UiEntity> : null
      })}
    </UiEntity>
    <UiEntity uiTransform={{ width: '100%', height: px(68), justifyContent: 'space-between', flexShrink: 0 }}>
      {NOTE_NAMES.map((n, i) => <Button key={n} value={`${n}   ${i + 1}`} fontSize={px(28)} color={ink} uiTransform={{ width: '32%', height: px(64) }} uiBackground={{ color: color(['kpop', 'funk', 'electronic'][i] as Genre) }} onMouseDown={() => tap(i)} />)}
    </UiEntity>
  </UiEntity>
}
function ui() {
  const c = UiCanvasInformation.getOrNull(engine.RootEntity), inset = c?.interactableArea
  const l = concertLayout(c?.width ?? 800, c?.height ?? 600, c?.devicePixelRatio ?? 1, inset?.left, inset?.right, inset?.top, inset?.bottom, large)
  scale = l.scale
  const s = session?.state, me = s?.players.find(p => p.id === session?.id), compact = l.compact
  const height = Math.min(l.height, compact ? 338 : 610), inner = height - 24
  const age = s ? clock + (session?.offset ?? 0) - s.since : 0
  const queue = s?.queueAt !== null && s?.queueAt !== undefined ? Math.max(0, Math.ceil((s.queueAt + QUEUE_MS - clock - (session?.offset ?? 0)) / 1000)) : 20
  if (hidden) return <UiEntity uiTransform={{ positionType: 'absolute', position: { right: px(8), bottom: px(8) }, width: px(260), height: px(56) }}>{button('Open music controls', () => { hidden = false })}</UiEntity>
  if (l.width < 290 || l.height < 320) return <UiEntity uiTransform={{ width: '95%', height: px(144), padding: px(8), flexDirection: 'column' }} uiBackground={{ color: ink }}>{line('Close chat / overlays or rotate your phone\nto make room for the instrument.', 72, 18)}{button('Reset UI size', () => { large = false }, '100%', true, cyan, 48)}</UiEntity>
  const footer = <UiEntity uiTransform={{ width: '100%', height: px(44), justifyContent: 'space-between', flexShrink: 0 }}>
    {button(sound ? 'Mute' : 'Sound on', () => { sound = !sound; audioKey = '' }, '32%', true, muted, 44)}
    {s?.phase === 'result' && compact ? button(scorePage === 2 ? 'Totals' : 'Attributes', () => { scorePage = (scorePage + 1) % 3 }, '32%', true, muted, 44) : button(large ? 'Size: XL' : 'Larger UI', () => { large = !large }, '32%', true, muted, 44)}
    {button('View club', () => { hidden = true }, '32%', true, muted, 44)}
  </UiEntity>
  return <UiEntity uiTransform={{ positionType: 'absolute', position: { right: px(8), bottom: px(8) }, width: px(l.width), height: px(height), padding: px(12), flexDirection: 'column' }} uiBackground={{ color: ink }}>
    {line('AFFINITY ARENA · 0.7', 32, compact ? 21 : 26, cyan)}
    {!s ? line('Connecting your player identity…', 80) : !me && s.phase === 'lobby' ? <UiEntity uiTransform={{ width: '100%', height: px(inner - 76), flexDirection: 'column', flexShrink: 0 }}>
      {guide ? <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
        {line('STUDIO → LIVE SHOW → CROWD', 36, 20, cyan)}
        {line('Tap C / E / G at the strike line.\nRehearse to build four attributes.\nThe main stage counts DOUBLE.\nHighest combined score wins.', compact ? 104 : 132, 18)}
        {button(reduced ? 'Motion reduced' : 'Reduce motion', () => { reduced = !reduced }, '100%', true, muted, 44)}
        {button('Choose my studio', () => { guide = false }, '100%', true, cyan, 44)}
      </UiEntity> : <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
        {line(session?.pending ? 'Joining studio… waiting for confirmation' : session?.notice && /No confirmation|Not accepted|Connection changed/.test(session.notice) ? 'Connection changed or crew full. Try again.' : 'Choose your music. Enter your studio.', 28, 17)}
        {(compact ? [GENRES.slice(page * 2, page * 2 + 2)] : [GENRES.slice(0, 2), GENRES.slice(2, 4), GENRES.slice(4)]).map((row, i) => <UiEntity key={`crew-row-${i}`} uiTransform={{ width: '100%', height: px(compact ? 90 : 98), justifyContent: 'space-between', flexShrink: 0 }}>{row.map(g => crewTile(g, compact ? 86 : 92))}</UiEntity>)}
        {compact && <UiEntity uiTransform={{ width: '100%', height: px(48), justifyContent: 'space-between' }}>{button('Previous', () => { page = (page + 2) % 3 }, '49%', true, muted, 44)}{button('More crews', () => { page = (page + 1) % 3 }, '49%', true, muted, 44)}</UiEntity>}
        {line(session?.notice && /No confirmation|Not accepted|Connection changed/.test(session.notice) ? session.notice : '20s queue. Empty seats become labeled bots.', compact ? 24 : 42, compact ? 14 : 17, muted)}
        {button('How to play', () => { guide = true }, '100%', true, cyan, 44)}
      </UiEntity>}
    </UiEntity> : me && s.phase === 'lobby' ? <UiEntity uiTransform={{ width: '100%', height: px(inner - 76), flexDirection: 'column', flexShrink: 0 }}>
      {line(`${GENRE_NAMES[me.genre]} studio · start in ${queue}s`, 30, 20, color(me.genre))}
      {!compact && line(`${s.players.length} real fan(s). Empty seats become BOTS.\nSoundcheck now; scored rehearsal begins after queue.`, 54, 17, muted)}
      {practice && instrument(Math.max(128, inner - (compact ? 184 : 238)), practice.age(clock), practice.round, true)}
      {line(feedback, 28, 16, cyan)}
      {button('Leave queue', () => command({ kind: 'leave' }), '100%', true, muted, 44)}
    </UiEntity> : s.phase === 'result' ? <UiEntity uiTransform={{ width: '100%', height: px(inner - 76), flexDirection: 'column', flexShrink: 0 }}>
      {line(s.winner === 'draw' ? 'DRAW · Both crews shine!' : s.winner ? `${GENRE_NAMES[s.winner]} wins!` : 'Show cancelled', 34, 24, s.winner && s.winner !== 'draw' ? color(s.winner) : cyan)}
      {line(s.mode === 'BOT_EXHIBITION' ? 'EXHIBITION · Includes simulated musicians' : 'HUMAN MATCH · Real participants', 24, 14, muted)}
      {(!compact || scorePage === 0) && line('Final = (studio + 2 × live) ÷ 3', 28, 18)}
      {s.crews.filter((_,i) => !compact || scorePage === 0 || i === scorePage - 1).map(crew => <UiEntity key={crew.genre} uiTransform={{ width: '100%', height: px(compact && scorePage === 0 ? 44 : 118), flexDirection: 'column' }}>
        {line(`${GENRE_NAMES[crew.genre]} · ${total(crew.final).toFixed(1)} / 400`, 28, 20, color(crew.genre))}
        {(!compact || scorePage > 0) && ATTRIBUTES.map(a => line(`${a.toUpperCase()}  ${crew.final[a].toFixed(1)}  (${crew.training[a].toFixed(0)} + 2×${crew.live[a].toFixed(0)})/3`, 21, 16))}
      </UiEntity>)}
      {line(`Next show in ${Math.max(0, Math.ceil((24000 - age) / 1000))}s · NPC crowd celebrates scores`, 30, 14, muted)}
    </UiEntity> : <UiEntity uiTransform={{ width: '100%', height: px(inner - 76), flexDirection: 'column', flexShrink: 0 }}>
      {line(s.phase === 'training' ? `STUDIO ${s.round + 1}/6 · ${tempo(s.round)} BPM` : age < 4500 ? `TO THE STAGE · LIVE IN ${Math.max(1, Math.ceil((5000 - age) / 1000))}` : `LIVE SHOW ${s.round + 1}/5 · SCORE ×2`, 30, 20, cyan)}
      {line(`${s.mode === 'BOT_EXHIBITION' ? 'BOTS · Exhibition' : 'REAL CREWS'}${!me ? ' · SPECTATING' : ''} · ${TRACKS[s.round]}`, 24, 14, muted)}
      {!compact && line(s.crews.map(crew => `${GENRE_NAMES[crew.genre]} · ${s.phase === 'training' ? 'Studio' : 'Projected'} ${total(s.phase === 'training' ? crew.training : crew.final).toFixed(0)}/400`).join('\n'), 52, 18)}
      {instrument(Math.max(128, inner - (compact ? 174 : 234)), age, s.round, false)}
      {line(me ? feedback : 'Watch the crew. Join the next show.', 28, 16, cyan)}
      {!compact && line(moveNotice || (s.phase === 'training' ? 'Rhythm · Precision · Harmony · Consistency' : 'All crew members play. The crowd follows the final score.'), 24, 14, muted)}
    </UiEntity>}
    {footer}
  </UiEntity>
}
function tick() {
  if (!session) return
  const s = session.state, me = s.players.find(p => p.id === session!.id), phase = key()
  if (me && entered !== `${s.match}/${me.genre}`) {
    entered = `${s.match}/${me.genre}`; const p = studioPosition(me.genre)
    travel(p.x, p.y, p.z - 1, p.z + 3); practice = new Warmup(clock, GENRES.indexOf(me.genre)); feedback = 'Soundcheck: tap C / E / G at the white line.'
  }
  if (!me) { practice = null; entered = '' }
  if (practice?.done(clock) && s.phase === 'lobby') practice = new Warmup(clock, (practice.round + 1) % 6)
  if (phase !== phaseKey) {
    if (s.phase === 'battle' && s.round === 0 && me) travel(me.genre === s.crews[0].genre ? 12 : 20, 1, 26, 31)
    phaseKey = phase; played = 0; intent = null; scorePage = 0; feedback = 'Tap each note at the white line.'; audioKey = ''
    if (s.phase !== 'lobby') { practice = null; hidden = false }
  }
  if (intent && !session.pending) {
    if (session.notice === 'Confirmed.' && intent.phase === phase) {
      played |= 1 << intent.index
      const hit = intent.lane === cueFor(s, session.id, intent.index)
      feedback = hit ? 'ON BEAT! Keep the crew together.' : 'Wrong lane. Follow the next note.'
    } else feedback = 'Note not confirmed. Keep playing.'
    intent = null
  }
  const age = clock + session.offset - s.since, soundAge = practice ? practice.age(clock) : age - (s.phase === 'battle' ? 3000 : 0)
  const nextAudio = `${practice ? `warmup/${practice.startedAt}` : phase}/${sound}`
  if (sound && nextAudio !== audioKey && soundAge >= 0 && soundAge < 7000 && (practice || ['training', 'battle'].includes(s.phase))) {
    AudioSource.createOrReplace(soundEntity, { audioClipUrl: `assets/sounds/arena-${practice?.round ?? s.round}.wav`, playing: true, loop: false, global: true, volume: .4, currentTime: soundAge / 1000 }); audioKey = nextAudio
  }
  if (sound && s.phase === 'result' && s.winner && resultKey !== s.match) { resultKey = s.match; AudioSource.createOrReplace(resultEntity, { audioClipUrl: 'assets/sounds/resolve.wav', playing: true, loop: false, global: true, volume: .4 }) }
  if (!sound || (!practice && !['training', 'battle'].includes(s.phase))) {
    if (AudioSource.getOrNull(soundEntity)?.playing) AudioSource.getMutable(soundEntity).playing = false
  }
  if (!sound && AudioSource.getOrNull(resultEntity)?.playing) AudioSource.getMutable(resultEntity).playing = false
  refreshClub(s, clock, reduced)
}
export function main() {
  buildClub(); soundEntity = engine.addEntity(); resultEntity = engine.addEntity()
  Transform.create(soundEntity, { position: Vector3.create(16, 2, 26) }); Transform.create(resultEntity, { position: Vector3.create(16, 2, 26) })
  bus.on(CHANNEL, (packet: unknown, sender: string) => { if (session && sender && sender !== 'self') { session.receive(packet, sender.toLowerCase(), Date.now()); flush() } })
  engine.addSystem(dt => {
    for (const [i, action] of [InputAction.IA_ACTION_3, InputAction.IA_ACTION_4, InputAction.IA_ACTION_5].entries()) if (inputSystem.isTriggered(action, PointerEventType.PET_DOWN)) tap(i)
    delta += dt; if (delta < .05) return; delta = 0; clock = Date.now()
    const id = getPlayer()?.userId?.toLowerCase()
    if (!id) { session = null; if (AudioSource.getOrNull(soundEntity)?.playing) AudioSource.getMutable(soundEntity).playing = false; return }
    if (!session || session.id !== id) session = new ConcertSession(id, clock)
    session.tick(clock); flush(); tick()
  })
  ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 0, virtualHeight: 0, screenInset: 'interactable' })
}
