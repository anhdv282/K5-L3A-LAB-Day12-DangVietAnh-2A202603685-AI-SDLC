// SFX are synthesized live with WebAudio.
// Background music: if a local file BGM_URL exists (user-provided, gitignored, not shipped), loop it;
// otherwise fall back to the original synthesized pentatonic tune below.
const BGM_URL = '/doraemon_song.mp3';
let ctx = null, master = null, musicOn = true, bgm = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  const a = new Audio(BGM_URL);
  a.loop = true; a.volume = 0.45;
  a.addEventListener('canplaythrough', () => { if (!bgm) { bgm = a; if (musicOn) a.play().catch(() => {}); } }, { once: true });
  a.addEventListener('error', () => {}, { once: true });   // file missing -> keep synth music
  a.load();
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
  lose: at(t => [7, 4, 2, 0].forEach((s, i) => tone(N(s), t + i * 0.25, 0.4, { type: 'sine', vol: 0.2 }))),
};

// Original lullaby-style loop in C major pentatonic: melody + bass.
const MELODY = [12, 14, 16, 19, 16, 14, 12, null, 9, 12, 14, 16, 14, null, 12, null,
                16, 19, 21, 19, 16, 14, 16, null, 14, 12, 9, 12, 14, null, 12, null];
const BASS = [0, 0, -5, -5, -3, -3, -5, -5];
function startMusic() {
  const beat = 0.28; let i = 0, next = ctx.currentTime + 0.1;
  setInterval(() => {
    while (next < ctx.currentTime + 0.5) {
      if (musicOn && !bgm) {
        const m = MELODY[i % MELODY.length];
        if (m != null) tone(N(m), next, beat * 0.9, { type: 'triangle', vol: 0.07 });
        if (i % 4 === 0) tone(N(BASS[(i / 4) % BASS.length] - 12), next, beat * 3.5, { type: 'sine', vol: 0.08 });
      }
      i++; next += beat;
    }
  }, 120);
}
export function toggleMusic() {
  musicOn = !musicOn;
  if (bgm) musicOn ? bgm.play().catch(() => {}) : bgm.pause();
  return musicOn;
}
