// Generates assets/chime.wav — a soft two-tone bell used when a timer runs out.
// Run once with: node scripts/gen-chime.js
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const DURATION = 1.2;
const N = Math.floor(SAMPLE_RATE * DURATION);

const partials = [
  { freq: 660, amp: 0.45, decay: 3.2 },
  { freq: 990, amp: 0.25, decay: 4.5 },
  { freq: 1320, amp: 0.12, decay: 6.0 },
];

const samples = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SAMPLE_RATE;
  let s = 0;
  for (const p of partials) {
    s += p.amp * Math.sin(2 * Math.PI * p.freq * t) * Math.exp(-p.decay * t);
  }
  // short attack ramp to avoid a click
  const attack = Math.min(1, t / 0.008);
  // gentle fade-out at the very end
  const release = Math.min(1, (DURATION - t) / 0.05);
  samples[i] = s * attack * release;
}

const pcm = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, samples[i]));
  pcm.writeInt16LE(Math.round(v * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // PCM format
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const out = path.join(__dirname, '..', 'assets', 'chime.wav');
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log('wrote', out, (44 + pcm.length) + ' bytes');
