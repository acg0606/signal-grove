import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('six bundled originals are finite, bounded, non-silent PCM with seven-second duration', () => {
  for (let track = 0; track < 6; track++) {
    const wav = readFileSync(new URL(`../assets/sounds/arena-${track}.wav`, import.meta.url))
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
    assert.equal(wav.readUInt32LE(24), 22050); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt16LE(34), 16)
    assert.equal(wav.readUInt32LE(40), 22050 * 7 * 2)
    let peak = 0, energy = 0
    for (let i = 44; i < wav.length; i += 2) { const v = wav.readInt16LE(i) / 32768; peak = Math.max(peak, Math.abs(v)); energy += v * v }
    assert.ok(peak < .85 && peak > .1); assert.ok(energy > 1)
    assert.equal(wav.readInt16LE(44), 0); assert.equal(wav.readInt16LE(wav.length - 2), 0)
  }
})
