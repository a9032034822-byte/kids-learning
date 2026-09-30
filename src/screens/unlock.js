// Первый запуск на устройстве: семейный пароль (один раз, потом запоминается).
import { h } from '../util.js';
import { deriveMaster, importMaster, toB64, MIN_PASSWORD_LENGTH } from '../crypto.js';
import { loadIndex, loadManifest } from '../content.js';
import * as store from '../store.js';
import { capybara, bear, bigBear } from '../characters.js';

function trio() {
  return h(
    'div',
    { class: 'trio' },
    h('div', { class: 'trio-a', html: capybara({ mood: 'happy' }) }),
    h('div', { class: 'trio-b', html: bigBear({ mood: 'happy' }) }),
    h('div', { class: 'trio-c', html: bear({ mood: 'happy' }) })
  );
}

export function unlockScreen(app) {
  const input = h('input', {
    class: 'pw-input',
    type: 'password',
    autocomplete: 'current-password',
    placeholder: 'Семейный пароль',
    'aria-label': 'Семейный пароль',
  });
  const msg = h('p', { class: 'form-msg' });
  const btn = h('button', { class: 'btn-big', type: 'submit' }, 'Открыть');
  const show = h('button', { class: 'btn-soft small', type: 'button', onclick: () => (input.type = input.type === 'password' ? 'text' : 'password') }, '👁 Показать');
  const form = h(
    'form',
    {
      class: 'panel unlock',
      onsubmit: async (e) => {
        e.preventDefault();
        const pw = input.value;
        msg.textContent = '';
        if (pw.length < MIN_PASSWORD_LENGTH) {
          msg.textContent = `Пароль не короче ${MIN_PASSWORD_LENGTH} символов.`;
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Открываю…';
        try {
          app.manifest = (await loadManifest()) || app.manifest;
          if (!app.manifest) throw new Error('no-content');
          const master = await deriveMaster(pw, app.manifest.kdf);
          const keys = await importMaster(master);
          let index;
          try {
            index = await loadIndex(keys);
          } catch (err) {
            if (String(err.message).startsWith('missing')) throw err;
            throw new Error('bad-password');
          }
          store.setMaster(toB64(master), app.manifest.kdf.salt);
          await app.unlocked(keys, index);
          app.go(app.pinsReady() ? '#/pick' : '#/setup-pins');
        } catch (err) {
          const m = String(err && err.message);
          msg.textContent =
            m === 'bad-password'
              ? 'Пароль не подошёл. Проверьте раскладку и регистр.'
              : m === 'no-content'
                ? 'На сайте пока нет материалов недели.'
                : m.startsWith('missing')
                  ? 'Не удалось загрузить материалы. Проверьте интернет.'
                  : 'Ошибка: ' + m;
          btn.disabled = false;
          btn.textContent = 'Открыть';
        }
      },
    },
    h('h1', {}, 'Лесная школа'),
    h('p', {}, 'Первый запуск на этом планшете. Родитель вводит семейный пароль один раз — дальше он запомнится здесь.'),
    h('div', { class: 'pw-row' }, input, show),
    btn,
    msg
  );
  setTimeout(() => input.focus(), 100);
  return h('div', { class: 'screen center unlock-screen' }, trio(), form);
}

export function noContentScreen(app) {
  return h(
    'div',
    { class: 'screen center unlock-screen' },
    trio(),
    h(
      'div',
      { class: 'panel' },
      h('h1', {}, 'Лесная школа'),
      h('p', {}, 'Материалы недели ещё не загружены на сайт.'),
      h('p', { class: 'muted' }, 'Они появятся после сборки недели (см. README). Потом откройте приложение снова.'),
      h('button', { class: 'btn-big', onclick: () => location.reload() }, 'Проверить ещё раз')
    )
  );
}
