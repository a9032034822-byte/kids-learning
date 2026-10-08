// Точка входа: загрузка, разблокировка семейным паролем, маршруты.
import { h, clear, todayISO } from './util.js';
import * as store from './store.js';
import * as sync from './sync.js';
import * as propisi from './propisi.js';
import { loadSettings, loadManifest, loadIndex, keysFromMaster, loadWeek, precache, scheduledDates } from './content.js';
import { unlockScreen, noContentScreen } from './screens/unlock.js';
import { pickerScreen, pinScreen, setupPinsScreen } from './screens/picker.js';
import { kidHome, archiveScreen, pagesScreen } from './screens/kid.js';
import { playerScreen } from './screens/player.js';
import { parentScreen } from './screens/parent.js';

export const PARENT = { id: 'parent', name: 'Родители', gender: 'f', uiLang: 'ru', companion: 'bigbear' };

export const app = {
  settings: { holidays: [], syncUrl: '' },
  manifest: null,
  keys: null,
  index: null,
  profiles: [],
  today: todayISO(),
  root: null,
  get kids() {
    return (this.index && this.index.family && this.index.family.kids) || [];
  },
  profile() {
    const id = sessionStorage.getItem('kl.profile');
    return this.profiles.find((p) => p.id === id) || null;
  },
  login(id) {
    sessionStorage.setItem('kl.profile', id);
  },
  logout() {
    sessionStorage.removeItem('kl.profile');
    this.go('#/pick');
  },
  go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  },
  week(id) {
    return loadWeek(this.keys, this.index, id).then((w) => propisi.inject(w, id, this.kids, this.settings.holidays, this.today));
  },
  scheduled(kidId) {
    return scheduledDates(this.index, kidId);
  },
  stats(kidId) {
    return store.stats(kidId, this.scheduled(kidId), this.settings.holidays, this.today);
  },
  pinsReady() {
    return this.profiles.every((p) => store.pinRec(p.id));
  },
  async unlocked(keys, index) {
    this.keys = keys;
    this.index = index;
    this.profiles = [...this.kids, PARENT];
    await sync.init({
      url: this.settings.syncUrl,
      keys,
      slots: () => ['settings', 'parent', ...this.kids.map((k) => store.kidSlot(k.id))],
    });
    await Promise.race([sync.syncNow(), new Promise((r) => setTimeout(r, 4000))]);
    sync.every(5 * 60 * 1000);
    precache(this.manifest);
  },
};

function show(node) {
  clear(app.root);
  app.root.append(node);
  window.scrollTo(0, 0);
}

let routeSeq = 0;

async function route() {
  const seq = ++routeSeq;
  app.today = todayISO();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [top, ...rest] = parts;
  if (!app.keys) {
    show(app.manifest ? unlockScreen(app) : noContentScreen(app));
    return;
  }
  if (!app.pinsReady() && top !== 'setup-pins') return app.go('#/setup-pins');
  const prof = app.profile();
  let node;
  try {
    if (top === 'setup-pins') node = setupPinsScreen(app);
    else if (top === 'pin') node = pinScreen(app, rest[0]);
    else if (top === 'kid' && prof && prof.id !== 'parent') {
      if (rest[0] === 'play' || rest[0] === 'review' || rest[0] === 'catchup' || rest[0] === 'practice' || rest[0] === 'poem') node = await playerScreen(app, prof, rest);
      else if (rest[0] === 'archive') node = await archiveScreen(app, prof);
      else if (rest[0] === 'pages') node = await pagesScreen(app, prof, rest[1]);
      else node = await kidHome(app, prof, rest[0] === 'w' ? { weekId: rest[1], date: rest[2] } : {});
    } else if (top === 'parent' && prof && prof.id === 'parent') node = await parentScreen(app, rest);
    else node = pickerScreen(app);
  } catch (e) {
    console.error(e);
    node = h('div', { class: 'screen center' }, h('div', { class: 'panel' }, h('h2', {}, 'Что-то пошло не так'), h('p', {}, String(e && e.message ? e.message : e)), h('button', { class: 'btn-big', onclick: () => app.go('#/pick') }, 'На главный экран')));
  }
  if (seq === routeSeq) show(node);
}

app.rerender = route;

async function boot() {
  app.root = document.getElementById('app');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  app.settings = await loadSettings();
  app.manifest = await loadManifest();
  const master = store.getMaster();
  if (master && app.manifest && store.getSalt() === app.manifest.kdf.salt) {
    try {
      const keys = await keysFromMaster(master);
      const index = await loadIndex(keys);
      await app.unlocked(keys, index);
    } catch (e) {
      console.warn('stored key failed', e);
      app.keys = null;
    }
  }
  window.addEventListener('hashchange', route);
  await route();
}

boot();
