// All sound is synthesized live with WebAudio: SFX + an original pentatonic night tune (no external/copyrighted audio).
let ctx = null, master = null, musicOn = true, volume = 0.8;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.45 * volume; master.connect(ctx.destination);
  startMusic();
}
function tone(freq, t0, dur, { type = 'triangle', vol = 0.3, slide = 0 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
const N = (semi) => 440 * 2 ** ((semi - 9) / 12);   // semitone offset from C4
const at = (fn) => () => { if (ctx) fn(ctx.currentTime); };
export const sfx = {
  pickup: at(t => { tone(N(19), t, 0.08, { vol: 0.15 }); tone(N(24), t + 0.05, 0.1, { vol: 0.12 }); }),
  deposit: at(t => { tone(N(12), t, 0.15, { type: 'sine', vol: 0.2 }); tone(N(16), t + 0.08, 0.2, { type: 'sine', vol: 0.18 }); }),
  lit: at(t => [12, 16, 19, 24, 28].forEach((s, i) => tone(N(s), t + i * 0.08, 0.4, { type: 'sine', vol: 0.2 }))),
  jump: at(t => tone(N(7), t, 0.18, { type: 'square', vol: 0.06, slide: 2 })),
  pulse: at(t => { tone(N(0), t, 0.5, { type: 'sine', vol: 0.25, slide: 3 }); tone(N(12), t, 0.5, { vol: 0.12, slide: 2 }); }),
  fail: at(t => tone(N(-5), t, 0.12, { type: 'square', vol: 0.05 })),
  hit: at(t => tone(N(4), t, 0.3, { type: 'sine', vol: 0.25, slide: 0.4 })),
  win: at(t => [0, 4, 7, 12, 7, 12, 16, 24].forEach((s, i) => tone(N(s + 12), t + i * 0.13, 0.35, { vol: 0.2 }))),
  dash: at(t => tone(N(12), t, 0.15, { type: 'sawtooth', vol: 0.05, slide: 0.5 })),
  shade: at(t => { tone(N(-12), t, 0.5, { type: 'sine', vol: 0.18, slide: 0.7 }); tone(N(-11), t + 0.05, 0.5, { type: 'sine', vol: 0.1, slide: 0.7 }); }),
  tick: at(t => tone(N(24), t, 0.06, { type: 'square', vol: 0.05 })),
  charm: at(t => [19, 24, 31].forEach((s, i) => tone(N(s), t + i * 0.05, 0.25, { vol: 0.15 }))),
  steal: at(t => tone(N(16), t, 0.35, { type: 'triangle', vol: 0.15, slide: 0.5 })),
  wind: at(t => { for (let i = 0; i < 6; i++) tone(N(-5 + i), t + i * 0.12, 0.5, { type: 'sine', vol: 0.04, slide: 1.3 }); }),
  out: at(t => { tone(N(7), t, 0.4, { type: 'sine', vol: 0.15, slide: 0.5 }); tone(N(3), t + 0.15, 0.5, { type: 'sine', vol: 0.12, slide: 0.5 }); }),
  lose: at(t => [7, 4, 2, 0].forEach((s, i) => tone(N(s), t + i * 0.25, 0.4, { type: 'sine', vol: 0.2 }))),
};

// "Đêm Đèn Lồng" — original background music composed for this game (no existing song used).
// 16-bar form A-A'-B-A'' in C major pentatonic at 84 BPM: warm pad chords, a soft bell arpeggio,
// a bamboo-flute-like melody (triangle + slow vibrato) and a gentle bass. Everything is synthesized live.
const BEAT = 60 / 84 / 2;   // eighth note
const CHORDS = [   // one chord per bar (semitones from C4)
  [0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7],      // Cmaj7  Am7  Fmaj7  G(add)
  [0, 4, 7, 11], [-3, 0, 4, 9], [-8, -5, 0, 4], [-5, -1, 2, 5],      // Cmaj7  Am(6) Ab-ish colour  G7
  [-3, 0, 4, 7], [-7, -3, 0, 4], [0, 4, 7, 11], [-5, -1, 2, 7],      // B section
  [-7, -3, 0, 4], [-5, -1, 2, 7], [-3, 0, 4, 7], [0, 4, 7, 12],
];
// melody: [semitone or null, length in eighths] — 8 eighths per bar
const MEL = [
  [16, 3], [14, 1], [12, 2], [9, 2],   [12, 4], [null, 2], [7, 2],
  [9, 3], [12, 1], [14, 2], [16, 2],   [14, 6], [null, 2],
  [16, 3], [19, 1], [21, 2], [19, 2],  [16, 3], [14, 1], [12, 4],
  [9, 2], [12, 2], [14, 2], [12, 2],   [7, 6], [null, 2],
  [21, 3], [19, 1], [16, 4],           [19, 3], [16, 1], [14, 4],
  [12, 2], [14, 2], [16, 2], [19, 2],  [21, 6], [null, 2],
  [24, 3], [21, 1], [19, 2], [16, 2],  [14, 3], [16, 1], [12, 4],
  [9, 2], [7, 2], [9, 2], [12, 2],     [12, 8],
];
function flute(freq, t0, dur, vol = 0.06) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  lfo.frequency.value = 5.2; lg.gain.value = freq * 0.006; lfo.connect(lg); lg.connect(o.frequency);   // gentle vibrato
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.08);
  g.gain.setValueAtTime(vol, t0 + Math.max(0.1, dur - 0.15)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
}
function pad(semis, t0, dur) {
  if (!ctx) return;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(master);
  for (const sm of semis) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = N(sm - 12); o.detune.value = (sm % 2 ? 6 : -6);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.012, t0 + 0.6);
    g.gain.setValueAtTime(0.012, t0 + dur - 0.5); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(f); o.start(t0); o.stop(t0 + dur + 0.05);
  }
}
function startMusic() {
  let bar = 0, next = ctx.currentTime + 0.2, melIdx = 0, melT = next;
  const barLen = BEAT * 8;
  setInterval(() => {
    while (next < ctx.currentTime + 1.0) {
      if (musicOn) {
        const ch = CHORDS[bar % CHORDS.length];
        pad(ch, next, barLen + 0.3);
        tone(N(ch[0] - 24), next, barLen * 0.9, { type: 'sine', vol: 0.07 });              // bass
        for (let i = 0; i < 8; i++) {                                                       // bell arpeggio
          const n = ch[[0, 2, 1, 3, 2, 1, 3, 2][i]] + 12;
          tone(N(n), next + i * BEAT, BEAT * 1.8, { type: 'sine', vol: i % 2 ? 0.018 : 0.028 });
        }
        if (bar % CHORDS.length === 0) { melIdx = 0; melT = next; }
        while (melIdx < MEL.length && melT < next + barLen - 1e-6) {                       // flute melody
          const [sm, len] = MEL[melIdx++]; if (sm != null) flute(N(sm), melT, len * BEAT * 0.95);
          melT += len * BEAT;
        }
      }
      bar++; next += barLen;
    }
  }, 200);
}
export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = 0.45 * v;
}
export function toggleMusic() {
  musicOn = !musicOn;
  return musicOn;
}
