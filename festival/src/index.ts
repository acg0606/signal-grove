import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { ConcertAuthority, type Position } from './authority'
import { ResultLedger, wallet } from './ledger'
import { nativeStore } from './native-store'
import type { Arena, Envelope } from './rules/concert'
import { room } from './messages'

/** Headless integration lab only. Never exports a client-controlled score submission. */
export async function main() {
  if (!isServer()) {
    const scene = await import('../compatibility/concert-scene')
    scene.main()
    return
  }
  const authority = new ConcertAuthority(Date.now(), Math.random().toString(36).slice(2, 12))
  const ledger = new ResultLedger(nativeStore)
  await ledger.load()
  console.log('[Authority lab]', ledger.ready ? 'STORAGE_READY' : 'STORAGE_HOLD')
  // No synthetic restart-counter writes: this candidate shares pinned dependencies.
  const positions = new Map<string, Position>()
  const limits = new Map<string, { since: number; count: number }>()
  let pending: Arena | null = null, completed = '', saveBusy = false, beat = 0, retry = 0
  const permitted = (id: string, now: number) => {
    if (!wallet(id) || !positions.has(id)) return false
    const rate = limits.get(id)
    if (!rate || now - rate.since >= 1000) { limits.set(id, { since: now, count: 1 }); return true }
    return ++rate.count <= 12
  }
  const broadcast = () => {
    const json = JSON.stringify(authority.state)
    if (json.length < 9000 && room.isReady()) void room.send('snapshot', { json, now: Date.now(), ready: ledger.ready && !pending })
  }
  const sendEnrollment = (id: string) => {
    if (room.isReady()) void room.send('enrollment', { json: JSON.stringify(authority.enrollment(id)), now: Date.now() }, { to: [id] })
  }
  room.onMessage('intent', (data, context) => {
    const id = context?.from.toLowerCase(), now = Date.now()
    if (!id || !permitted(id, now) || !Number.isSafeInteger(data.request) || data.request < 1 || data.json.length > 1024) return
    let accepted = false
    try {
      const envelope = JSON.parse(data.json) as Envelope
      // A storage outage must never trap a spectator in the next-show queue.
      const cancelQueue = envelope?.command?.kind === 'leave' && authority.enrollment(id).genre !== null
      if ((ledger.ready && !pending) || cancelQueue) accepted = authority.command(id, envelope, now, positions.get(id))
    } catch { /* reject malformed input */ }
    void room.send('reply', { request: data.request, accepted, message: accepted ? 'Confirmed by server.' : 'Not accepted; check phase, position or server readiness.' }, { to: [id] })
    sendEnrollment(id)
    if (accepted) broadcast()
  })
  room.onMessage('clock', (data, context) => {
    const id = context?.from.toLowerCase(), now = Date.now()
    if (id && permitted(id, now)) { void room.send('pong', { at: data.at, now }, { to: [id] }); sendEnrollment(id) }
  })
  room.onMessage('notebook', (data, context) => {
    const id = context?.from.toLowerCase()
    if (!id || !permitted(id, Date.now()) || !ledger.ready) return
    const json = JSON.stringify({ album: ledger.album(id).slice(0, 8), standings: ledger.standings(), scope: 'LAB_PILOT', permanentPhoto: false })
    if (json.length <= 10000) void room.send('memories', { json }, { to: [id] })
  })
  engine.addSystem(dt => {
    positions.clear()
    for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
      const transform = Transform.getOrNull(entity), id = identity.address.toLowerCase()
      if (transform && wallet(id)) positions.set(id, transform.position)
    }
    for (const id of limits.keys()) if (!positions.has(id)) limits.delete(id)
    const now = Date.now()
    if (ledger.ready && !pending) {
      authority.tick(now, new Set(positions.keys()), positions)
      const s = authority.state
      if (s.phase === 'result' && s.winner && s.match !== completed) pending = s
    }
    retry += dt
    if (retry >= 3 && !saveBusy) {
      retry = 0; saveBusy = true
      const task = !ledger.ready ? ledger.load() : pending ? ledger.record(pending).then(result => {
        if (result === 'saved' || result === 'duplicate' || result === 'ignored') { completed = pending!.match; pending = null }
        else console.log('[Authority lab] CHECKPOINT_HOLD', result)
      }) : Promise.resolve()
      void task.finally(() => { saveBusy = false })
    }
    beat += dt
    if (beat >= .25) {
      beat = 0
      broadcast()
    }
  })
  console.log('[Authority lab] Initialized; no production deployment or live acceptance implied.')
}
