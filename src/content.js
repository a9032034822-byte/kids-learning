// Загрузка настроек и зашифрованного контента из content/.
//   content/manifest.json — открытый: параметры KDF и список файлов (без дат и имён);
//   content/index.enc     — профили семьи и список недель;
//   content/w-*.enc       — по файлу на неделю.

import { decryptJSON, importMaster, fromB64 } from './crypto.js';
import { mondayOf, addDays, inHolidays } from './util.js';

export async function loadSettings() {
  try {
    const r = await fetch('settings.json', { cache: 'no-cache' });
    if (r.ok) return await r.json();
  } catch {}
  return { holidays: [], syncUrl: '' };
}

export async function loadManifest() {
  try {
    const r = await fetch('content/manifest.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const m = await r.json();
    return m && m.kdf ? m : null;
  } catch {
    return null;
  }
}

export async function keysFromMaster(b64) {
  return importMaster(fromB64(b64));
}

async function fetchEnc(file) {
  const r = await fetch('content/' + file, { cache: 'no-cache' });
  if (!r.ok) throw new Error('missing:' + file);
  return r.json();
}

export async function loadIndex(keys) {
  return decryptJSON(keys, await fetchEnc('index.enc'), 'index');
}

const weekCache = new Map();

export async function loadWeek(keys, index, weekId) {
  if (weekCache.has(weekId)) return weekCache.get(weekId);
  const meta = index.weeks.find((w) => w.id === weekId);
  if (!meta) return null;
  const p = fetchEnc(meta.file).then((env) => decryptJSON(keys, env, 'week'));
  weekCache.set(weekId, p);
  try {
    return await p;
  } catch (e) {
    weekCache.delete(weekId);
    throw e;
  }
}

/** Попросить service worker заранее сохранить все файлы контента для работы без сети. */
export function precache(manifest) {
  if (!manifest || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const urls = ['content/manifest.json', ...manifest.files.map((f) => 'content/' + f)];
  navigator.serviceWorker.controller.postMessage({ type: 'precache', urls });
}

/** Неделя, которую показывать «сейчас»: та, в чей пн–вс попадает сегодня. */
export function currentWeek(index, today) {
  const mon = mondayOf(today);
  return index.weeks.find((w) => mondayOf(w.from) === mon) || null;
}

export function scheduledDates(index, kidId) {
  const s = new Set();
  for (const w of index.weeks) for (const d of (w.dates && w.dates[kidId]) || []) s.add(d);
  return s;
}

export function weekState(index, settings, today) {
  const cw = currentWeek(index, today);
  const holiday = inHolidays(today, settings.holidays);
  const past = index.weeks.filter((w) => w.to < today && (!cw || w.id !== cw.id));
  const next = index.weeks.find((w) => w.from > today && mondayOf(w.from) === mondayOf(addDays(today, 7)));
  return { current: cw, holiday, past, next };
}

/** Все задания ребёнка в неделе плоским списком, с привязкой к дню и уроку. */
export function flatTasks(week, kidId) {
  const kid = week && week.kids && week.kids[kidId];
  const out = [];
  if (!kid) return out;
  for (const day of kid.days) for (const lesson of day.lessons) for (const task of lesson.tasks) out.push({ day, lesson, task });
  return out;
}

export function findLesson(week, kidId, lessonId) {
  const kid = week && week.kids && week.kids[kidId];
  if (!kid) return null;
  for (const day of kid.days) for (const lesson of day.lessons) if (lesson.id === lessonId) return { day, lesson, kid };
  return null;
}
