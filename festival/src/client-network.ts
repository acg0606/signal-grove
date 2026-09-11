import { room } from './messages'
import { AuthorityClient } from './client'
import { ServerNotebook } from './notebook'
export function connectClient(client: AuthorityClient, notebook: ServerNotebook) {
  const unsubscribe = [
    room.onMessage('snapshot', data => { try { client.receiveState(JSON.parse(data.json), Number(data.now), data.ready, Date.now()) } catch { /* preserve last confirmed state */ } }),
    room.onMessage('reply', data => client.ack(data.request, data.accepted)),
    room.onMessage('pong', data => client.pong(Number(data.at), Number(data.now), Date.now())),
    room.onMessage('enrollment', data => { try { if(data.json.length < 512)client.receiveEnrollment(JSON.parse(data.json), Number(data.now)) } catch { /* preserve confirmed queue */ } }),
    room.onMessage('memories', data => { try { if (data.json.length <= 10000) notebook.receive(JSON.parse(data.json)) } catch { notebook.status = 'Could not read saved covers. Try Refresh.' } })
  ]
  return () => unsubscribe.forEach(stop => stop())
}
export function flushClient(client: AuthorityClient) {
  if (!room.isReady()) return
  for (const packet of client.drain()) void room.send('intent', packet)
}
export function refreshNotebook() {
  if (room.isReady()) void room.send('notebook', { request: 1 })
}
export function syncClock(client: AuthorityClient, now: number) {
  if (room.isReady()) void room.send('clock', client.ping(now))
}
