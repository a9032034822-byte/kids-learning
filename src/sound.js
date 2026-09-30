// Озвучка (Web Speech) и звуки успеха (Web Audio, без файлов).

const LANGS = { ru: 'ru-RU', en: 'en-US', fr: 'fr-FR' };
let ctx = null;

export function muted() {
  try {
    return localStorage.getItem('kl.mute') === '1';
  } catch {
    return false;
  }
}

export function setMuted(v) {
  try {
    localStorage.setItem('kl.mute', v ? '1' : '0');
  } catch {}
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(tag) {
  const voices = speechSynthesis.getVoices();
  const base = tag.slice(0, 2);
  return voices.find((v) => v.lang === tag) || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(base)) || null;
}

export function speak(text, lang = 'ru', rate = 0.85) {
  if (!canSpeak() || !text) return false;
  try {
    speechSynthesis.cancel();
    const tag = LANGS[lang] || lang;
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = tag;
    u.rate = rate;
    const v = pickVoice(tag);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

if (canSpeak()) {
  try {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
  } catch {}
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.18) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  ok() {
    if (muted()) return;
    tone(659, 0, 0.18, 'triangle');
    tone(880, 0.1, 0.22, 'triangle');
    tone(1175, 0.2, 0.3, 'triangle', 0.14);
  },
  soft() {
    if (muted()) return;
    tone(330, 0, 0.22, 'sine', 0.12);
    tone(294, 0.14, 0.26, 'sine', 0.1);
  },
  tap() {
    if (muted()) return;
    tone(520, 0, 0.06, 'sine', 0.06);
  },
  fanfare() {
    if (muted()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.16));
    tone(1319, 0.5, 0.6, 'triangle', 0.12);
  },
  bell() {
    if (muted()) return;
    tone(988, 0, 0.8, 'sine', 0.2);
    tone(1319, 0.02, 0.9, 'sine', 0.1);
  },
};
