// Синхронизация прогресса через Cloudflare Worker + KV (см. worker/ и README).
// Сервер хранит только зашифрованные семейным ключом блоки и не может их прочитать.
// Адрес воркера — settings.json → syncUrl. Пусто — синхронизация выключена.

import { encryptJSON, decryptJSON, syncToken } from './crypto.js';
import * as store from './store.js';
import { debounce } from './util.js';

let cfg = null; // {url, token, keys, slots: () => [...]}
let state = { enabled: false, last: null, error: null, busy: false };
const watchers = new Set();

function emit() {
  watchers.forEach((fn) => fn({ ...state }));
}

export function onStatus(fn) {
  watchers.add(fn);
  fn({ ...state });
  return () => watchers.delete(fn);
}

export function status() {
  return { ...state };
}

export async function init({ url, keys, slots }) {
  if (!url) {
    state = { ...state, enabled: false };
    emit();
    return;
  }
  cfg = { url: url.replace(/\/+$/, ''), token: await syncToken(keys), keys, slots };
  state = { ...state, enabled: true };
  emit();
  store.onChange(() => later());
  // При сворачивании — обычная синхронизация (сначала читаем сервер, потом пишем),
  // чтобы никогда не затереть записи других устройств.
  document.addEventListener('visibilitychange', () => syncNow());
  window.addEventListener('online', () => syncNow());
}

const later = debounce(() => syncNow(), 3000);

async function syncSlot(name) {
  const url = `${cfg.url}/v1/slot/${encodeURIComponent(name)}`;
  const headers = { 'X-Family-Key': cfg.token };
  let remote = null;
  const r = await fetch(url, { headers, cache: 'no-store' });
  if (r.ok) {
    const body = await r.json();
    if (body && !body.empty) {
      try {
        remote = await decryptJSON(cfg.keys, body, 'sync:' + name);
      } catch {
        remote = null; // повреждённый блок — перезапишем своим
      }
    }
  } else if (r.status !== 404) throw new Error('HTTP ' + r.status);
  const { remoteBehind, changedLocal } = store.merge(name, remote);
  if (remoteBehind) {
    const body = JSON.stringify(await encryptJSON(cfg.keys, store.slot(name), 'sync:' + name));
    const w = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body });
    if (!w.ok) throw new Error('HTTP ' + w.status);
  }
  return changedLocal;
}

let running = null;

/** → {ok, changed}: changed — пришли новые данные с других устройств. */
export function syncNow() {
  if (!cfg) return Promise.resolve({ ok: false, changed: false });
  if (running) return running;
  state = { ...state, busy: true };
  emit();
  running = (async () => {
    try {
      let changed = false;
      for (const name of cfg.slots()) changed = (await syncSlot(name)) || changed;
      state = { ...state, busy: false, last: Date.now(), error: null };
      return { ok: true, changed };
    } catch (e) {
      state = { ...state, busy: false, error: String(e && e.message ? e.message : e) };
      return { ok: false, changed: false };
    } finally {
      running = null;
      emit();
    }
  })();
  return running;
}

let timer = null;
export function every(ms) {
  clearInterval(timer);
  if (cfg) timer = setInterval(() => document.visibilityState === 'visible' && syncNow(), ms);
}
