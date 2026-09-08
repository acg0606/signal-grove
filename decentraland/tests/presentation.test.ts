import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeHud, HUD_COLORS } from '../src/presentation'
import { mergeSignal, PRESENCE_TTL_MS, ROLES, type Role, type Room } from '../src/room'

const roomWith = (...roles: (Role | null)[]) => roles.reduce<Room>((room, role, index) => mergeSignal(room, {
  schema: 'signal-grove/1', playerId: `visitor_${index}`, revision: 1, role
}, 10), {})

test('a choice without local presence stays pending, not selected or a fake visitor', () => {
  const hud = describeHud({}, 11, '', 'listen')
  assert.equal(hud.title, 'Joining the grove')
  assert.equal(hud.presence, '0 visitors · 0 contributing')
  assert.equal(hud.buttons[0].label, 'LISTEN (0)\nPending')
  assert.equal(hud.state.bloom, 0)
})

test('arrival explains how to join without requiring another visitor first', () => {
  const hud = describeHud(roomWith(null), 11, 'VISITOR_0', null)
  assert.equal(hud.title, 'Choose your role')
  assert.equal(hud.presence, '1 visitor · 0 contributing')
  assert.ok(hud.buttons.every(button => button.label.endsWith('Choose')))
})

test('selection follows the current role; labels do not depend on color', () => {
  for (const role of ROLES) {
    const hud = describeHud(roomWith(role), 11, 'visitor_0', role)
    assert.deepEqual(hud.buttons.filter(button => button.selected).map(button => button.role), [role])
    assert.match(hud.buttons.find(button => button.role === role)!.label, /Selected$/)
    assert.equal(hud.contribution, '1 visitor contributing')
    assert.match(hud.action, /Invite a friend/)
  }
})

test('waiting visitors are asked to choose, not incorrectly told to invite more', () => {
  const hud = describeHud(roomWith('listen', null), 11, 'visitor_0', 'listen')
  assert.match(hud.action, /Company is here/)
  assert.equal(hud.state.status, 'WAITING_FOR_FRIEND')
})

test('echo, missing role, and full spectrum have distinct next steps', () => {
  assert.match(describeHud(roomWith('listen', 'listen'), 11, 'visitor_0', 'listen').action, /Try a different role/)
  for (const missing of ROLES) {
    const roles = ROLES.filter(role => role !== missing)
    const hud = describeHud(roomWith(...roles), 11, 'visitor_0', roles[0])
    assert.equal(hud.title, 'Shared rhythm')
    assert.ok(hud.action.startsWith(`Missing ${missing.toUpperCase()}.`))
    assert.match(hud.action, /third visitor/)
  }
  assert.equal(describeHud(roomWith(...ROLES), 11, 'visitor_0', 'listen').title, 'Full spectrum')
})

test('expired local presence cannot retain Selected or full bloom', () => {
  const hud = describeHud(roomWith(...ROLES), 10 + PRESENCE_TTL_MS, 'visitor_0', 'listen')
  assert.equal(hud.title, 'Joining the grove')
  assert.match(hud.buttons[0].label, /Pending$/)
  assert.equal(hud.state.visitors, 0)
  assert.equal(hud.state.bloom, 0)
})

test('a queued role change never claims it has already applied', () => {
  const hud = describeHud(roomWith('listen'), 11, 'visitor_0', 'build')
  assert.equal(hud.title, 'Applying your choice')
  assert.match(hud.buttons[2].label, /Pending$/)
  assert.equal(hud.state.counts.build, 0)
})

function luminance(color: { r: number; g: number; b: number }) {
  const linear = [color.r, color.g, color.b].map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}
function contrast(a: Parameters<typeof luminance>[0], b: Parameters<typeof luminance>[0]) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('all actual HUD text colors clear 4.5:1, including panel over a white scene', () => {
  for (const role of ROLES) assert.ok(contrast(HUD_COLORS.ink, HUD_COLORS[role]) >= 4.5, role)
  const panel = HUD_COLORS.panel
  const brightestPanel = { r: panel.r * panel.a + 1 - panel.a, g: panel.g * panel.a + 1 - panel.a, b: panel.b * panel.a + 1 - panel.a }
  for (const color of [HUD_COLORS.text, HUD_COLORS.secondary, HUD_COLORS.muted]) assert.ok(contrast(color, brightestPanel) >= 4.5)
})
