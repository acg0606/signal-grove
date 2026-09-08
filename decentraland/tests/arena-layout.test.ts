import test from 'node:test'
import assert from 'node:assert/strict'
import { arenaLayout, ARENA_TEXT_RGB } from '../src/arena-layout'
test('phone and desktop controls use real safe-area width, not half a phone', () => {
  assert.equal(arenaLayout(390, 844).width, 374)
  assert.equal(arenaLayout(1440, 900).width, 450)
  assert.equal(arenaLayout(844, 390, 44, 44, 12, 20).width, 450)
  assert.equal(arenaLayout(667, 320, 0, 0, 0, 20).compact, true)
  assert.equal(arenaLayout(300, 200, 40, 40).width, 204)
})
test('arena text contrast clears WCAG AA in the actual opaque tokens', () => {
  const lum = (v: readonly number[]) => v.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
  const a = lum(ARENA_TEXT_RGB.ink)
  for (const color of [ARENA_TEXT_RGB.white, ARENA_TEXT_RGB.muted, ARENA_TEXT_RGB.accent]) assert.ok((lum(color) + 0.05) / (a + 0.05) >= 4.5)
})
