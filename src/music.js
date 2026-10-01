// Telifsiz, koddan üretilen 120 BPM neşeli müzik + geçiş efektleri.
// Aynı fonksiyon hem canlı önizlemede (AudioContext) hem de MP4 üretiminde
// (OfflineAudioContext) kullanılır; böylece ses her zaman görüntüyle senkron.
import { SCENES, CARD_LEN, DURATION } from './engine.js';
import { mulberry32 } from './presets.js';

const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// I–V–vi–IV (Do majör)
const CHORDS = [
  [48, 52, 55], // C
  [43, 47, 50], // G
  [45, 48, 52], // Am
  [41, 45, 48], // F
];
const ARP = [0, 1, 2, 1, 2, 3, 2, 1];

function noiseBuffer(ac) {
  const len = ac.sampleRate;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  const r = mulberry32(42);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return buf;
}

export function scheduleSoundtrack(ac, dest, when0 = 0, offset = 0) {
  const master = ac.createGain();
  master.gain.value = 0.7;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const trim = ac.createGain();
  trim.gain.value = 0.85;
  master.connect(comp);
  comp.connect(trim);
  trim.connect(dest);
  const noise = noiseBuffer(ac);
  const at = (T) => when0 + T - offset;
  const ok = (T) => T >= offset - 0.001 && T < DURATION;

  const env = (g, T, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, at(T));
    g.gain.exponentialRampToValueAtTime(peak, at(T) + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at(T) + a + d);
  };

  const kick = (T, v = 1) => {
    if (!ok(T)) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(150, at(T));
    o.frequency.exponentialRampToValueAtTime(42, at(T) + 0.14);
    env(g, T, 0.004, 0.9 * v, 0.3);
    o.connect(g).connect(master);
    o.start(at(T));
    o.stop(at(T) + 0.35);
  };
  const noiseHit = (T, type, freq, peak, dur, q = 1) => {
    if (!ok(T)) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    env(g, T, 0.002, peak, dur);
    s.connect(f).connect(g).connect(master);
    s.start(at(T), (T * 7.31) % 0.5);
    s.stop(at(T) + dur + 0.05);
  };
  const tone = (T, freq, type, peak, dur, cutoff = 3000, a = 0.005) => {
    if (!ok(T)) return;
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    env(g, T, a, peak, dur);
    o.connect(f).connect(g).connect(master);
    o.start(at(T));
    o.stop(at(T) + a + dur + 0.05);
  };
  const whoosh = (T) => {
    if (!ok(T)) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise;
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, at(T));
    f.frequency.exponentialRampToValueAtTime(5000, at(T) + 0.45);
    g.gain.setValueAtTime(0.0001, at(T));
    g.gain.exponentialRampToValueAtTime(0.35, at(T) + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at(T) + 0.6);
    s.connect(f).connect(g).connect(master);
    s.start(at(T));
    s.stop(at(T) + 0.65);
  };
  const pop = (T, f0 = 600) => {
    if (!ok(T)) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, at(T));
    o.frequency.exponentialRampToValueAtTime(f0 * 2.2, at(T) + 0.08);
    env(g, T, 0.003, 0.35, 0.12);
    o.connect(g).connect(master);
    o.start(at(T));
    o.stop(at(T) + 0.2);
  };
  const bell = (T) => {
    [1318.5, 1975.5, 2637].forEach((f, i) => tone(T + i * 0.06, f, 'sine', 0.18, 0.9, 8000));
  };

  const sceneAt = (T) => SCENES.find((s) => T >= s.start && T < s.end)?.id;
  const bars = Math.ceil(DURATION / BAR);
  for (let b = 0; b < bars; b++) {
    const chord = CHORDS[b % 4];
    const T0 = b * BAR;
    const sc = sceneAt(T0);
    const intro = T0 < 2;
    const build = T0 >= 2 && T0 < 6;
    const breakdown = sc === 'features';
    // pad
    chord.forEach((n) => tone(T0, midi(n + 12), 'sawtooth', 0.025, BAR - 0.1, 1200, 0.3));
    for (let st = 0; st < 8; st++) {
      const T = T0 + st * BEAT / 2;
      if (T >= DURATION) break;
      // arpej
      const step = ARP[st];
      const note = step < 3 ? chord[step] + 24 : chord[0] + 36;
      tone(T, midi(note), 'square', 0.045, 0.18, 2600);
      if (intro) continue;
      // hi-hat
      if (st % 2 === 1) noiseHit(T, 'highpass', 7500, build ? 0.06 : 0.1, 0.05);
      if (build || breakdown) continue;
      // bas
      const bn = st === 3 || st === 7 ? chord[0] + 12 : chord[0];
      tone(T, midi(bn - 12), 'triangle', 0.3, 0.2, 900);
      // davul
      if (st % 2 === 0) kick(T);
      if (st === 2 || st === 6) noiseHit(T, 'bandpass', 1800, 0.35, 0.16, 0.8);
    }
    // giriş gerilimi: son 1 sn trampet rulosu
    if (build && T0 + BAR >= 6) for (let r = 0; r < 8; r++) noiseHit(5 + r / 8, 'bandpass', 1800, 0.08 + r * 0.03, 0.08, 0.8);
  }
  // efektler
  SCENES.slice(1).forEach((s) => whoosh(s.start - 0.35));
  for (let i = 0; i < 8; i++) {
    const T = 10 + i * CARD_LEN;
    if (i) whoosh(T - 0.4 + 0.05);
    pop(T + 0.4, 520 + i * 40);
  }
  kick(2.4, 1.2); // damga
  noiseHit(2.4, 'lowpass', 900, 0.5, 0.3);
  pop(3.6, 700);
  [42, 45, 48].forEach((T) => pop(T + 0.15, 800));
  [0.8, 1.8].forEach((d) => pop(45 + d, 1000)); // akıllı tahta dokunuşları
  for (let i = 0; i < 4; i++) pop(51.2 + i * 0.18, 600 + i * 120);
  bell(56); // CTA tıklaması
  // final akoru
  [60, 64, 67, 72].forEach((n) => tone(58, midi(n), 'triangle', 0.08, 1.9, 4000, 0.02));
  // sona doğru kısma
  master.gain.setValueAtTime(0.7, Math.max(at(DURATION - 0.6), when0));
  master.gain.linearRampToValueAtTime(0.0001, Math.max(at(DURATION), when0 + 0.01));
  return master;
}

export async function renderSoundtrackWav(sampleRate = 48000) {
  const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DURATION), sampleRate);
  scheduleSoundtrack(ac, ac.destination, 0, 0);
  const buf = await ac.startRendering();
  return encodeWav(buf);
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  out.setUint32(4, 36 + len * ch * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  w(36, 'data');
  out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  return new Uint8Array(out.buffer);
}
