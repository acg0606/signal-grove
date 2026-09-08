// Reproducible original synthesis. No downloaded recordings, samples or melodies.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const folder = fileURLToPath(new URL('../assets/sounds/', import.meta.url))
mkdirSync(folder, { recursive: true })
const sr = 22050, seconds = 7
const tempos = [80, 90, 100, 110, 120, 130]
const kicks = [[0, 4, 8, 12], [0, 3, 6, 10], [0, 6, 8, 14], [0, 3, 8, 11], [0, 7, 8, 14], [0, 4, 8, 12]]
const notes = [130.8128, 164.8138, 195.9977, 146.8324, 174.6141, 220]
for (let track = 0; track < 6; track++) {
  const samples = new Float64Array(sr * seconds), beat = 60 / tempos[track]
  let rng = 600 + track
  const noise = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 2147483648 - 1 }
  function tone(at, duration, kind, freq = 0, gain = 0.15) {
    const start = Math.round(at * sr)
    for (let n = 0; n < duration * sr && start + n < samples.length; n++) {
      const t = n / sr, env = Math.min(1, t / .004) * Math.exp(-t * (kind === 'hat' ? 65 : 12))
      const wave = kind === 'kick' ? Math.sin(2 * Math.PI * (48 * t + 6 * (1 - Math.exp(-t * 35)))) : kind === 'hat' || kind === 'snare' ? noise() : Math.sin(2 * Math.PI * freq * t) + .25 * Math.sin(2 * Math.PI * freq * 2 * t)
      samples[start + n] += wave * env * gain
    }
  }
  for (let tick = 0; tick * beat / 4 < seconds; tick++) {
    const at = tick * beat / 4, step = tick % 16
    if (kicks[track].includes(step)) tone(at, .35, 'kick', 0, .32)
    if (step === 4 || step === 12) tone(at, .16, 'snare', 0, .10)
    if (tick % (track === 4 ? 4 : 2) === 0) tone(at, .055, 'hat', 0, .05)
    if (tick % 4 === 0) tone(at, .35, 'note', notes[(Math.floor(tick / 4) * 2 + track) % notes.length], .15)
  }
  // Four clear lead accents exactly on the exercise targets, after count-in.
  for (let i = 0; i < 4; i++) tone(2 + i * beat, .28, 'note', [523.251, 659.255, 783.991][(track + i) % 3], .18)
  const data = Buffer.alloc(44 + samples.length * 2)
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(sr, 24); data.writeUInt32LE(sr * 2, 28)
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40)
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const fade = Math.min(1, i / (sr * .01), (samples.length - 1 - i) / (sr * .04))
    const sample = Math.max(-.85, Math.min(.85, samples[i] * fade)); peak = Math.max(peak, Math.abs(sample))
    data.writeInt16LE(Math.round(sample * 32767), 44 + i * 2)
  }
  writeFileSync(`${folder}arena-${track}.wav`, data)
  console.log(`arena-${track}.wav: ${tempos[track]} BPM, 7s, mono ${sr}Hz, peak ${peak.toFixed(3)}, ${data.length} bytes`)
}
// Original result chord; no external sample.
const count = Math.round(sr * .65), chime = Buffer.alloc(44 + count * 2)
chime.write('RIFF'); chime.writeUInt32LE(chime.length - 8, 4); chime.write('WAVEfmt ', 8); chime.writeUInt32LE(16, 16)
chime.writeUInt16LE(1, 20); chime.writeUInt16LE(1, 22); chime.writeUInt32LE(sr, 24); chime.writeUInt32LE(sr * 2, 28)
chime.writeUInt16LE(2, 32); chime.writeUInt16LE(16, 34); chime.write('data', 36); chime.writeUInt32LE(count * 2, 40)
for (let i = 0; i < count; i++) {
  const t = i / sr, env = Math.min(1, t / .01, (count - 1 - i) / (sr * .04)) * Math.exp(-7 * t)
  const wave = [261.626, 329.628, 391.995].reduce((a, f) => a + Math.sin(2 * Math.PI * f * t), 0) / 3
  chime.writeInt16LE(Math.round(wave * env * .35 * 32767), 44 + i * 2)
}
writeFileSync(`${folder}resolve.wav`, chime)
console.log(`resolve.wav: 0.65s original result chord, ${chime.length} bytes`)
