// Локальное хранилище + прогресс.
// Все данные лежат «слотами»: settings (PIN-коды), parent (подтверждения родителя),
// p-<id ребёнка> (прогресс ребёнка). Слот — словарь записей {…, ts}; при слиянии
// двух копий по каждому ключу побеждает запись с большим ts (last-writer-wins).

import { addDays, inHolidays } from './util.js';

const P = 'kl.';
const listeners = new Set();

function lsGet(k) {
  try {
    return localStorage.getItem(P + k);
  } catch {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(P + k, v);
  } catch {}
}

export function getMaster() {
  return lsGet('master');
}
export function setMaster(b64, salt) {
  lsSet('master', b64);
  lsSet('salt', salt);
}
export function getSalt() {
  return lsGet('salt');
}
export function forgetDevice() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(P))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {}
}

const cache = new Map();

export function slot(name) {
  if (!cache.has(name)) {
    let doc = null;
    try {
      doc = JSON.parse(lsGet('slot.' + name) || 'null');
    } catch {}
    cache.set(name, doc && doc.entries ? doc : { entries: {} });
  }
  return cache.get(name);
}

function save(name) {
  lsSet('slot.' + name, JSON.stringify(slot(name)));
}

export function get(name, key) {
  return slot(name).entries[key];
}

export function put(name, key, value) {
  const prev = get(name, key);
  const ts = Math.max(Date.now(), prev && prev.ts ? prev.ts + 1 : 0);
  slot(name).entries[key] = { ...value, ts };
  save(name);
  listeners.forEach((fn) => fn(name, key));
}

/** Слияние с копией с сервера. Возвращает {changedLocal, remoteBehind}. */
export function merge(name, remote) {
  const local = slot(name);
  let changedLocal = false;
  let remoteBehind = false;
  const re = (remote && remote.entries) || {};
  for (const [k, v] of Object.entries(re)) {
    const l = local.entries[k];
    if (!l || (v.ts || 0) > (l.ts || 0)) {
      local.entries[k] = v;
      changedLocal = true;
    }
  }
  for (const [k, v] of Object.entries(local.entries)) {
    const r = re[k];
    if (!r || (v.ts || 0) > (r.ts || 0)) remoteBehind = true;
  }
  if (changedLocal) save(name);
  return { changedLocal, remoteBehind };
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- прогресс ----------

export const kidSlot = (kidId) => 'p-' + kidId;
const tKey = (weekId, taskId) => `t:${weekId}:${taskId}`;

export function taskRec(kidId, weekId, taskId) {
  return get(kidSlot(kidId), tKey(weekId, taskId));
}

/**
 * Итог задания. result: {errors, wrong:[{i, given, expected, q}], count?}
 * opts: {retry: повтор ошибок, pending: ждёт подтверждения родителя, date}
 */
export function saveTask(kidId, weekId, taskId, result, opts = {}) {
  const prev = taskRec(kidId, weekId, taskId);
  const errors = result.errors || 0;
  let rec;
  if (opts.retry) {
    if (!prev) return;
    rec = { ...prev, fixed: prev.fixed || errors === 0, retries: (prev.retries || 0) + 1 };
  } else if (!prev || !prev.done) {
    rec = {
      done: true,
      errors,
      wrong: (result.wrong || []).slice(0, 40),
      doneAt: opts.date,
      pending: !!opts.pending,
      extra: result.extra || undefined,
    };
  } else {
    rec = {
      ...prev,
      replays: (prev.replays || 0) + 1,
      fixed: prev.fixed || (prev.errors > 0 && errors === 0),
      pending: prev.pending || !!opts.pending,
      extra: result.extra || prev.extra,
    };
  }
  put(kidSlot(kidId), tKey(weekId, taskId), rec);
  if (opts.date) markActive(kidId, opts.date);
}

export function markActive(kidId, date) {
  const k = 'd:' + date;
  const prev = get(kidSlot(kidId), k);
  put(kidSlot(kidId), k, { n: ((prev && prev.n) || 0) + 1 });
}

export function saveReview(kidId, date, n) {
  const k = 'rv:' + date;
  const prev = get(kidSlot(kidId), k);
  put(kidSlot(kidId), k, { n: ((prev && prev.n) || 0) + n });
  markActive(kidId, date);
}

const aKey = (kidId, weekId, taskId) => `a:${kidId}:${weekId}:${taskId}`;

export function approval(kidId, weekId, taskId) {
  const a = get('parent', aKey(kidId, weekId, taskId));
  return a && a.ok;
}

export function setApproval(kidId, weekId, taskId, ok) {
  put('parent', aKey(kidId, weekId, taskId), { ok: !!ok });
}

export function stats(kidId, scheduled, holidays, today) {
  const e = slot(kidSlot(kidId)).entries;
  let stars = 0;
  const active = new Set();
  for (const [k, v] of Object.entries(e)) {
    if (k.startsWith('t:') && v.done) stars += 1 + (v.errors > 0 && v.fixed ? 1 : 0);
    else if (k.startsWith('rv:')) stars += v.n || 0;
    if (k.startsWith('d:')) active.add(k.slice(2));
  }
  // Серия: считаем назад от сегодня. Пропуск ломает серию, только если в этот день
  // были уроки по расписанию (выходные, каникулы и дни без уроков не считаются).
  let streak = 0;
  let d = today;
  if (!active.has(d)) d = addDays(d, -1);
  const minDate = [...active, ...scheduled].sort()[0] || today;
  for (let guard = 0; guard < 800 && d >= minDate; guard++) {
    if (active.has(d)) streak++;
    else if (scheduled.has(d) && !inHolidays(d, holidays)) break;
    d = addDays(d, -1);
  }
  const PER = 20;
  return { stars, level: Math.floor(stars / PER) + 1, levelPart: (stars % PER) / PER, toNext: PER - (stars % PER), streak, active };
}

export function reviewList(kidId) {
  const e = slot(kidSlot(kidId)).entries;
  const out = [];
  for (const [k, v] of Object.entries(e)) {
    if (!k.startsWith('t:') || !v.done || !(v.errors > 0) || v.fixed) continue;
    const [, weekId, ...rest] = k.split(':');
    out.push({ weekId, taskId: rest.join(':'), rec: v });
  }
  return out;
}

// ---------- PIN ----------

export function pinRec(profileId) {
  return get('settings', 'pin:' + profileId);
}
export function setPin(profileId, hash) {
  put('settings', 'pin:' + profileId, { h: hash });
}

// ---------- мелочи этого устройства (не синхронизируются) ----------

export function local(key, value) {
  if (value === undefined) {
    try {
      return JSON.parse(lsGet('local.' + key) || 'null');
    } catch {
      return null;
    }
  }
  lsSet('local.' + key, JSON.stringify(value));
}
