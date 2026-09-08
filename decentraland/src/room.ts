export const ROLES = ['listen', 'invite', 'build'] as const
export type Role = typeof ROLES[number]
export type GroveStatus = 'WAITING_FOR_FRIEND' | 'ECHO_LOOP' | 'SHARED_RHYTHM' | 'FULL_SPECTRUM'
export const PRESENCE_TTL_MS = 30_000
export const MAX_VISITORS = 32
export interface Signal { schema: 'signal-grove/1'; playerId: string; revision: number; role: Role | null }
export interface Visitor extends Signal { receivedAt: number }
export type Room = Record<string, Visitor>
export function isSignal(value: unknown): value is Signal {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Signal
  return candidate.schema === 'signal-grove/1' && typeof candidate.playerId === 'string'
    && /^[a-zA-Z0-9:_-]{1,80}$/.test(candidate.playerId)
    && !['__proto__', 'prototype', 'constructor'].includes(candidate.playerId)
    && Number.isSafeInteger(candidate.revision) && candidate.revision >= 0
    && (candidate.role === null || (ROLES as readonly string[]).includes(candidate.role))
}
export function mergeSignal(room: Room, value: unknown, now: number): Room {
  if (!isSignal(value) || !Number.isFinite(now)) return room
  const live = Object.fromEntries(Object.entries(room).filter(([, visitor]) => now - visitor.receivedAt < PRESENCE_TTL_MS))
  const previous = live[value.playerId]
  if (previous && value.revision <= previous.revision) return room
  if (!previous && Object.keys(live).length >= MAX_VISITORS) return room
  const visitor: Visitor = { schema: value.schema, playerId: value.playerId, revision: value.revision, role: value.role, receivedAt: now }
  return { ...live, [value.playerId]: visitor }
}
export function mergeRemoteSignal(room: Room, value: unknown, sender: string, now: number): Room {
  if (!isSignal(value) || !sender || sender === 'self' || value.playerId !== sender.toLowerCase()) return room
  return mergeSignal(room, value, now)
}
export function activeVisitors(room: Room, now: number): Visitor[] {
  return Object.values(room).filter(visitor => now - visitor.receivedAt < PRESENCE_TTL_MS)
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
}
export function describeGrove(room: Room, now: number) {
  const visitors = activeVisitors(room, now)
  const contributors = visitors.filter(visitor => visitor.role !== null)
  const counts = { listen: 0, invite: 0, build: 0 }
  for (const visitor of contributors) counts[visitor.role as Role]++
  const variety = ROLES.filter(role => counts[role] > 0).length
  const status: GroveStatus = contributors.length < 2 ? 'WAITING_FOR_FRIEND'
    : variety === 1 ? 'ECHO_LOOP' : variety === 2 ? 'SHARED_RHYTHM' : 'FULL_SPECTRUM'
  const messages = {
    WAITING_FOR_FRIEND: 'The grove needs two real visitors. Invite a friend and choose different roles.',
    ECHO_LOOP: 'You found each other. Try a different role to make room for another signal.',
    SHARED_RHYTHM: 'Two different roles are working together. A third role completes the spectrum.',
    FULL_SPECTRUM: 'Listen, Invite and Build are all present. Your grove is in full bloom.'
  }
  return { visitors: visitors.length, contributors: contributors.length, counts, variety, status, message: messages[status], bloom: contributors.length < 2 ? 0 : variety / 3 }
}
