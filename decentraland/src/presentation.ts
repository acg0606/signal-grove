import { activeVisitors, describeGrove, ROLES, type Role, type Room } from './room'

// Preserve the native grove palette; use dark ink on its light role controls.
export const HUD_COLORS = {
  ink: { r: 0.035, g: 0.08, b: 0.065, a: 1 },
  panel: { r: 0.035, g: 0.08, b: 0.065, a: 0.93 },
  text: { r: 1, g: 1, b: 1, a: 1 },
  secondary: { r: 0.74, g: 0.9, b: 0.81, a: 1 },
  muted: { r: 0.68, g: 0.77, b: 0.72, a: 1 },
  listen: { r: 0.21, g: 0.79, b: 0.73, a: 1 },
  invite: { r: 0.97, g: 0.72, b: 0.39, a: 1 },
  build: { r: 0.66, g: 0.55, b: 0.97, a: 1 }
}

const titles = {
  WAITING_FOR_FRIEND: 'Waiting for company',
  ECHO_LOOP: 'Echo loop',
  SHARED_RHYTHM: 'Shared rhythm',
  FULL_SPECTRUM: 'Full spectrum'
}

export function describeHud(room: Room, now: number, localId: string, choice: Role | null) {
  const state = describeGrove(room, now)
  const local = activeVisitors(room, now).find(visitor => visitor.playerId === localId.toLowerCase())
  // This confirms local presence only, never delivery to a second client.
  const applied = Boolean(local && choice !== null && local.role === choice)
  const missing = ROLES.filter(item => state.counts[item] === 0)
  const title = !local ? 'Joining the grove' : choice === null ? 'Choose your role' : !applied ? 'Applying your choice' : titles[state.status]
  let action: string
  if (!local) action = 'Waiting for your visitor identity.\nYour choice will apply when ready.'
  else if (choice === null) action = 'Choose Listen, Invite or Build.\nYou can change your role any time.'
  else if (!applied) action = 'Your choice is pending.\nWaiting for local presence to update.'
  else if (state.visitors < 2) action = 'Invite a friend to this same scene.\nChoose different roles to grow the bloom.'
  else if (state.contributors < 2) action = 'Company is here! Ask another visitor\nto choose a different role.'
  else if (state.variety === 1) action = 'Try a different role from your friend.\nDifferent roles grow the bloom.'
  else if (state.variety === 2) action = `Missing ${missing[0].toUpperCase()}. Invite a third visitor,\nor switch if your role has company.`
  else action = 'All three roles are present.\nStay together to keep the grove in bloom.'
  return {
    state, title, action,
    presence: `${state.visitors} ${state.visitors === 1 ? 'visitor' : 'visitors'} · ${state.contributors} contributing`,
    contribution: `${state.contributors} ${state.contributors === 1 ? 'visitor' : 'visitors'} contributing`,
    buttons: ROLES.map(item => ({
      role: item,
      selected: choice === item,
      label: `${item.toUpperCase()} (${state.counts[item]})\n${choice === item ? applied ? 'Selected' : 'Pending' : 'Choose'}`
    }))
  }
}
