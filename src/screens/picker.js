// Выбор профиля и PIN-коды.
import { h } from '../util.js';
import { avatar } from '../characters.js';
import { pinHash } from '../crypto.js';
import * as store from '../store.js';
import * as sync from '../sync.js';
import { sfx } from '../sound.js';

export function pickerScreen(app) {
  const cards = app.profiles.map((p) =>
    h(
      'button',
      { class: 'profile-card' + (p.id === 'parent' ? ' parent' : ''), style: { '--c': p.color || '#2A9D8F' }, onclick: () => app.go('#/pin/' + p.id) },
      h('div', { class: 'profile-avatar', html: avatar(p) }),
      h('div', { class: 'profile-name' }, p.name),
      p.companionName ? h('div', { class: 'profile-sub' }, (p.uiLang === 'en' ? 'with ' : 'и ') + p.companionName) : h('div', { class: 'profile-sub' }, 'уроки и прогресс')
    )
  );
  return h('div', { class: 'screen picker' }, h('h1', { class: 'picker-title' }, 'Кто сегодня учится?'), h('div', { class: 'profile-grid' }, cards));
}

function pad(onDigit, onBack) {
  const el = h('div', { class: 'digit-pad pin-pad' });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach((d) =>
    el.append(
      d
        ? h('button', { type: 'button', class: 'pad-key' + (d === '⌫' ? ' back' : ''), onclick: () => (d === '⌫' ? onBack() : onDigit(d)) }, d)
        : h('span')
    )
  );
  return el;
}

export function pinScreen(app, id) {
  const p = app.profiles.find((x) => x.id === id);
  if (!p) {
    app.go('#/pick');
    return h('div');
  }
  let code = '';
  let fails = 0;
  let lockedUntil = 0;
  const dots = h('div', { class: 'pin-dots' });
  const msg = h('p', { class: 'form-msg' });
  const face = h('div', { class: 'pin-avatar', html: avatar(p) });
  const paint = () => {
    dots.replaceChildren(...[0, 1, 2, 3].map((i) => h('span', { class: 'dot' + (i < code.length ? ' on' : '') })));
  };
  const onDigit = async (d) => {
    if (Date.now() < lockedUntil || code.length >= 4) return;
    sfx.tap();
    code += d;
    paint();
    if (code.length === 4) {
      const rec = store.pinRec(p.id);
      const ok = rec && rec.h === (await pinHash(app.keys, p.id, code));
      if (ok) {
        face.innerHTML = avatar(p, 'cheer');
        app.login(p.id);
        setTimeout(() => app.go(p.id === 'parent' ? '#/parent' : '#/kid'), 250);
      } else {
        fails++;
        dots.classList.add('shake');
        face.innerHTML = avatar(p, 'think');
        sfx.soft();
        msg.textContent = p.uiLang === 'en' ? 'Not this one. Try again!' : 'Не тот код. Попробуй ещё!';
        if (fails >= 5) {
          lockedUntil = Date.now() + 30000;
          msg.textContent = p.uiLang === 'en' ? 'Wait 30 seconds…' : 'Подожди 30 секунд…';
        }
        setTimeout(() => {
          code = '';
          dots.classList.remove('shake');
          paint();
        }, 500);
      }
    }
  };
  paint();
  return h(
    'div',
    { class: 'screen center pin-screen', style: { '--c': p.color || '#2A9D8F' } },
    h('button', { class: 'btn-back', onclick: () => app.go('#/pick') }, '←'),
    face,
    h('h2', {}, p.name),
    h('p', { class: 'muted' }, p.uiLang === 'en' ? 'Type your code' : 'Введи свой код'),
    dots,
    msg,
    pad(onDigit, () => {
      code = code.slice(0, -1);
      paint();
    })
  );
}

export function setupPinsScreen(app) {
  const inputs = new Map();
  const msg = h('p', { class: 'form-msg' });
  const rows = app.profiles.map((p) => {
    const inp = h('input', { class: 'pin-input', type: 'password', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', placeholder: '••••', 'aria-label': 'PIN ' + p.name });
    inp.addEventListener('input', () => (inp.value = inp.value.replace(/\D/g, '').slice(0, 4)));
    inputs.set(p.id, inp);
    return h('label', { class: 'pin-row' }, h('span', { class: 'mini-avatar', html: avatar(p) }), h('span', { class: 'pin-name' }, p.name), inp);
  });
  const save = async () => {
    const vals = new Map([...inputs].map(([id, inp]) => [id, inp.value]));
    if ([...vals.values()].some((v) => !/^\d{4}$/.test(v))) {
      msg.textContent = 'У каждого PIN — ровно 4 цифры.';
      return;
    }
    const parentPin = vals.get('parent');
    if ([...vals].some(([id, v]) => id !== 'parent' && v === parentPin)) {
      msg.textContent = 'PIN родителей должен отличаться от детских.';
      return;
    }
    for (const [id, v] of vals) store.setPin(id, await pinHash(app.keys, id, v));
    sync.syncNow();
    app.go('#/pick');
  };
  const pull = async () => {
    msg.textContent = 'Загружаю…';
    const { ok } = await sync.syncNow();
    if (app.pinsReady()) app.go('#/pick');
    else msg.textContent = ok ? 'На сервере PIN-кодов пока нет — задайте их здесь.' : 'Синхронизация не настроена или нет связи.';
  };
  return h(
    'div',
    { class: 'screen center' },
    h(
      'div',
      { class: 'panel wide' },
      h('h1', {}, 'PIN-коды'),
      h('p', {}, 'Придумайте каждому свой код из 4 цифр. Код разделяет профили на планшете (материалы защищает семейный пароль).'),
      h('div', { class: 'pin-rows' }, rows),
      h('button', { class: 'btn-big', onclick: save }, 'Сохранить'),
      sync.status().enabled ? h('button', { class: 'btn-soft', onclick: pull }, '⤓ Уже задавали на другом планшете — загрузить') : null,
      msg
    )
  );
}
