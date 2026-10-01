// Экран родителя: уроки недели целиком (из УРОКИ-файлов), прогресс детей, настройки.
import { h } from '../util.js';
import { subject, TASK_ICONS } from '../i18n.js';
import { avatar } from '../characters.js';
import { renderMarkdown } from '../markdown.js';
import { weekState, flatTasks } from '../content.js';
import { pinHash } from '../crypto.js';
import * as store from '../store.js';
import * as sync from '../sync.js';
import { needsApproval } from '../tasks/index.js';
import { taskTitle, dm, pageSheet } from './common.js';
import { muted, setMuted } from '../sound.js';

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
let unsubStatus = null;

function weekPicker(app, current, onPick) {
  const sel = h('select', { class: 'select', onchange: (e) => onPick(e.target.value) });
  [...app.index.weeks].reverse().forEach((w) => sel.append(h('option', { value: w.id, selected: w.id === current || null }, `Неделя ${w.week} · ${dm(w.from)}–${dm(w.to)}`)));
  return sel;
}

function kidTabs(app, current, onPick) {
  return h(
    'div',
    { class: 'kid-tabs' },
    app.kids.map((k) =>
      h('button', { class: 'kid-tab' + (k.id === current ? ' active' : ''), style: { '--c': k.color }, onclick: () => onPick(k.id) }, h('span', { class: 'mini-avatar', html: avatar(k) }), k.name)
    )
  );
}

function defaultWeek(app) {
  const st = weekState(app.index, app.settings, app.today);
  return (st.current || st.next || app.index.weeks[app.index.weeks.length - 1] || {}).id;
}

export async function parentScreen(app, rest) {
  const [tab = 'lessons', a, b] = rest;
  const kidId = (app.kids.find((k) => k.id === a) || app.kids[0] || {}).id;
  const weekId = app.index.weeks.some((w) => w.id === b) ? b : defaultWeek(app);
  const pending = countPending(app);

  const nav = h(
    'nav',
    { class: 'parent-nav' },
    h('div', { class: 'parent-brand' }, h('span', { class: 'mini-avatar', html: avatar(null) }), 'Родители'),
    [
      ['lessons', '📚 Уроки'],
      ['progress', '📈 Прогресс'],
      ['settings', '⚙️ Настройки'],
    ].map(([k, label]) =>
      h('button', { class: 'nav-btn' + (tab === k ? ' active' : ''), onclick: () => app.go(`#/parent/${k}/${kidId || ''}/${weekId || ''}`) }, label, k === 'progress' && pending ? h('b', { class: 'badge' }, pending) : null)
    ),
    h('span', { class: 'sync-dot', id: 'sync-dot' }),
    h('button', { class: 'icon-btn', title: 'Выйти', onclick: () => app.logout() }, '⏏')
  );
  const screen = h('div', { class: 'screen parent' }, nav);
  if (unsubStatus) unsubStatus();
  unsubStatus = sync.onStatus((s) => {
    const dot = screen.querySelector('#sync-dot');
    if (dot) {
      dot.className = 'sync-dot ' + (!s.enabled ? 'off' : s.error ? 'err' : s.busy ? 'busy' : 'ok');
      dot.title = !s.enabled ? 'Синхронизация не настроена' : s.error ? 'Ошибка синхронизации: ' + s.error : s.last ? 'Синхронизировано ' + new Date(s.last).toLocaleTimeString('ru-RU') : '';
    }
  });

  if (!app.index.weeks.length && tab !== 'settings') {
    screen.append(h('div', { class: 'panel' }, h('p', {}, 'Недель пока нет.')));
    return screen;
  }
  if (tab === 'progress') screen.append(await progressView(app, kidId, weekId));
  else if (tab === 'settings') screen.append(settingsView(app));
  else screen.append(await lessonsView(app, kidId, weekId));
  // Свежий прогресс с детских планшетов: перерисовываем, только если что-то пришло.
  if (tab === 'progress') sync.syncNow().then((r) => r.changed && screen.isConnected && refreshSoon(app));
  return screen;
}

let refreshTimer = null;
function refreshSoon(app) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => app.rerender(), 50);
}

function countPending(app) {
  let n = 0;
  for (const k of app.kids) {
    const e = store.slot(store.kidSlot(k.id)).entries;
    for (const [key, v] of Object.entries(e)) {
      if (!key.startsWith('t:') || !v.pending) continue;
      const [, weekId, ...rest] = key.split(':');
      if (!store.approval(k.id, weekId, rest.join(':'))) n++;
    }
  }
  return n;
}

async function lessonsView(app, kidId, weekId) {
  const data = await app.week(weekId);
  const kid = data && data.kids[kidId];
  const wrap = h('div', { class: 'parent-body' });
  wrap.append(
    h(
      'div',
      { class: 'parent-toolbar' },
      kidTabs(app, kidId, (id) => app.go(`#/parent/lessons/${id}/${weekId}`)),
      weekPicker(app, weekId, (id) => app.go(`#/parent/lessons/${kidId}/${id}`))
    )
  );
  if (!kid) {
    wrap.append(h('div', { class: 'panel' }, 'Для этого ребёнка на этой неделе уроков нет.'));
    return wrap;
  }
  // расписание недели коротко
  const sched = h('div', { class: 'sched' });
  kid.days.forEach((d) =>
    sched.append(
      h(
        'div',
        { class: 'sched-day' },
        h('div', { class: 'sched-date' }, `${WD[new Date(d.date + 'T12:00').getDay()]} ${dm(d.date)}`),
        d.lessons.map((l) => h('div', { class: 'sched-row', style: { '--sc': subject(l.subject).color } }, h('span', { class: 'sched-time' }, l.time || '—'), h('span', {}, subject(l.subject).icon + ' ' + l.title), l.tag ? h('small', {}, ' · ' + l.tag) : null))
      )
    )
  );
  wrap.append(h('details', { class: 'panel', open: true }, h('summary', {}, '🗓️ Расписание недели'), sched));
  // ролики недели — ссылками, чтобы родитель мог посмотреть заранее
  const videos = new Map();
  kid.days.forEach((d) => d.lessons.forEach((l) => l.tasks.forEach((tk) => [tk.video].flat().forEach((v) => v && /^[A-Za-z0-9_-]{11}$/.test(v.youtube) && !videos.has(v.youtube) && videos.set(v.youtube, v.title || tk.q)))));
  if (videos.size)
    wrap.append(
      h(
        'details',
        { class: 'panel' },
        h('summary', {}, `🎵 Ролики недели (${videos.size})`),
        h('ul', { class: 'parent-videos' }, [...videos].map(([id, title]) => h('li', {}, h('a', { href: `https://www.youtube.com/watch?v=${id}`, target: '_blank', rel: 'noopener noreferrer' }, title))))
      )
    );
  wrap.append(h('article', { class: 'panel lesson-doc', html: kid.lessonsMd ? renderMarkdown(kid.lessonsMd) : '<p>Файл уроков не загружен.</p>' }));
  if (kid.pages && kid.pages.length) {
    const pages = h('div', { class: 'pages' });
    kid.pages.forEach((p) => pages.append(h('div', { class: 'page-num' }, `— стр. ${p.n} —`), pageSheet(kid, p.n)));
    wrap.append(h('details', { class: 'panel' }, h('summary', {}, `📄 Распечатка ребёнка (${kid.pages.length} стр.)`), pages));
  }
  return wrap;
}

function statusOf(kidId, weekId, task) {
  const rec = store.taskRec(kidId, weekId, task.id);
  if (!rec || !rec.done) return { s: 'todo', rec };
  if (needsApproval(task)) return { s: store.approval(kidId, weekId, task.id) ? 'approved' : 'pending', rec };
  return { s: rec.errors > 0 ? (rec.fixed ? 'fixed' : 'errors') : 'done', rec };
}

const S_LABEL = { todo: '○ не начато', done: '✓ без ошибок', errors: '✎ с ошибками', fixed: '✓ ошибки исправлены', pending: '⏳ ждёт подтверждения', approved: '✓ подтверждено' };

async function progressView(app, kidId, weekId) {
  const data = await app.week(weekId);
  const wrap = h('div', { class: 'parent-body' });
  wrap.append(
    h(
      'div',
      { class: 'parent-toolbar' },
      kidTabs(app, kidId, (id) => app.go(`#/parent/progress/${id}/${weekId}`)),
      weekPicker(app, weekId, (id) => app.go(`#/parent/progress/${kidId}/${id}`))
    )
  );
  // сводка по обоим детям
  const cards = h('div', { class: 'summary-cards' });
  for (const k of app.kids) {
    const s = app.stats(k.id);
    const flat = flatTasks(data, k.id);
    const done = flat.filter((x) => statusOf(k.id, weekId, x.task).s !== 'todo').length;
    const pend = flat.filter((x) => statusOf(k.id, weekId, x.task).s === 'pending').length;
    const errs = flat.filter((x) => statusOf(k.id, weekId, x.task).s === 'errors').length;
    cards.append(
      h(
        'button',
        { class: 'summary-card' + (k.id === kidId ? ' active' : ''), style: { '--c': k.color }, onclick: () => app.go(`#/parent/progress/${k.id}/${weekId}`) },
        h('span', { class: 'mini-avatar big', html: avatar(k) }),
        h(
          'div',
          {},
          h('b', {}, k.name),
          h('div', {}, `Неделя: ${done} / ${flat.length} заданий`),
          h('div', {}, `⭐ ${s.stars} · 🐾 ${s.streak} дн. подряд · уровень ${s.level}`),
          h('div', {}, pend ? `⏳ ждут подтверждения: ${pend}` : '', pend && errs ? ' · ' : '', errs ? `✎ с ошибками: ${errs}` : '')
        )
      )
    );
  }
  wrap.append(cards);

  const kid = data && data.kids[kidId];
  if (!kid) return wrap;

  // ждут подтверждения
  const pend = flatTasks(data, kidId).filter((x) => statusOf(kidId, weekId, x.task).s === 'pending');
  if (pend.length) {
    const list = h('div', { class: 'approve-list' });
    pend.forEach((x) => {
      const rec = store.taskRec(kidId, weekId, x.task.id);
      list.append(
        h(
          'div',
          { class: 'approve-row' },
          h('span', {}, TASK_ICONS[x.task.type] + ' ', h('b', {}, taskTitle(x.task, subject(x.lesson.subject).lang)), h('small', {}, ` · ${dm(x.day.date)} · ${x.lesson.title}`), rec && rec.extra && rec.extra.words ? h('small', {}, ` · слов: ${rec.extra.words}`) : null, rec && rec.extra && rec.extra.peeks != null ? h('small', {}, ` · подсмотрел(а) строк: ${rec.extra.peeks}`) : null),
          h('button', { class: 'btn-ok', onclick: () => (store.setApproval(kidId, weekId, x.task.id, true), app.rerender()) }, '✓ Подтвердить')
        )
      );
    });
    wrap.append(h('div', { class: 'panel attention' }, h('h3', {}, `⏳ «В тетради» — ждут подтверждения (${pend.length})`), list));
  }

  // по дням
  for (const d of kid.days) {
    const box = h('div', { class: 'panel' }, h('h3', {}, `${WD[new Date(d.date + 'T12:00').getDay()]} ${dm(d.date)}`));
    for (const l of d.lessons) {
      const rows = h('div', { class: 'prog-rows' });
      l.tasks.forEach((tk) => {
        const { s, rec } = statusOf(kidId, weekId, tk);
        const row = h(
          'div',
          { class: 'prog-row ' + s },
          h('span', { class: 'prog-ic' }, TASK_ICONS[tk.type] || '•'),
          h('span', { class: 'prog-title' }, taskTitle(tk, subject(l.subject).lang)),
          h('span', { class: 'prog-status' }, S_LABEL[s]),
          s === 'approved' ? h('button', { class: 'btn-soft small', onclick: () => (store.setApproval(kidId, weekId, tk.id, false), app.rerender()) }, 'отменить') : null,
          s === 'pending' ? h('button', { class: 'btn-ok small', onclick: () => (store.setApproval(kidId, weekId, tk.id, true), app.rerender()) }, '✓') : null
        );
        rows.append(row);
        if (rec && rec.wrong && rec.wrong.length) {
          rows.append(
            h(
              'div',
              { class: 'prog-errors' },
              rec.wrong.map((w) => h('div', {}, w.q ? h('span', { class: 'muted' }, w.q + ': ') : null, w.given ? h('span', { class: 'bad' }, w.given) : null, ' → ', h('span', { class: 'good' }, w.expected)))
            )
          );
        }
      });
      box.append(h('div', { class: 'prog-lesson' }, h('div', { class: 'prog-lesson-title', style: { '--sc': subject(l.subject).color } }, (l.time ? l.time + ' · ' : '') + subject(l.subject).icon + ' ' + l.title), rows));
    }
    wrap.append(box);
  }
  return wrap;
}

function settingsView(app) {
  const wrap = h('div', { class: 'parent-body' });
  // PIN
  const msg = h('p', { class: 'form-msg' });
  const pinRows = app.profiles.map((p) => {
    const inp = h('input', { class: 'pin-input', type: 'password', inputmode: 'numeric', maxlength: '4', placeholder: 'новый', autocomplete: 'off' });
    inp.addEventListener('input', () => (inp.value = inp.value.replace(/\D/g, '').slice(0, 4)));
    const btn = h('button', {
      class: 'btn-soft small',
      onclick: async () => {
        if (!/^\d{4}$/.test(inp.value)) return (msg.textContent = 'PIN — 4 цифры.');
        store.setPin(p.id, await pinHash(app.keys, p.id, inp.value));
        inp.value = '';
        msg.textContent = `PIN для «${p.name}» обновлён.`;
        sync.syncNow();
      },
    }, 'Сменить');
    return h('div', { class: 'pin-row' }, h('span', { class: 'mini-avatar', html: avatar(p) }), h('span', { class: 'pin-name' }, p.name), inp, btn);
  });
  wrap.append(h('div', { class: 'panel' }, h('h3', {}, '🔢 PIN-коды'), h('div', { class: 'pin-rows' }, pinRows), msg));

  // синхронизация
  const st = sync.status();
  const syncBox = h('div', { class: 'panel' }, h('h3', {}, '🔄 Синхронизация'));
  if (!st.enabled) syncBox.append(h('p', {}, 'Не настроена: прогресс хранится только на этом устройстве. Как включить — README, раздел «Синхронизация прогресса».'));
  else {
    const line = h('p', {}, st.error ? 'Ошибка: ' + st.error : st.last ? 'Последняя синхронизация: ' + new Date(st.last).toLocaleString('ru-RU') : 'Ещё не синхронизировалось.');
    syncBox.append(line, h('button', { class: 'btn-soft', onclick: async () => ((line.textContent = 'Синхронизирую…'), await sync.syncNow(), app.rerender()) }, 'Синхронизировать сейчас'));
  }
  wrap.append(syncBox);

  // каникулы
  const hol = (app.settings.holidays || []).map((x) => `${x.title || 'Каникулы'}: с ${dm(x.from)}.${x.from.slice(0, 4)}${x.to ? ' по ' + dm(x.to) + '.' + x.to.slice(0, 4) : ' (конец не задан)'}`);
  wrap.append(h('div', { class: 'panel' }, h('h3', {}, '🏖️ Каникулы'), hol.length ? hol.map((x) => h('p', {}, x)) : h('p', {}, 'Не заданы.'), h('p', { class: 'muted' }, 'Даты меняются в файле settings.json в репозитории.')));

  // устройство
  const soundBtn = h('button', { class: 'btn-soft', onclick: () => (setMuted(!muted()), (soundBtn.textContent = muted() ? '🔇 Звук выключен' : '🔈 Звук включён')) }, muted() ? '🔇 Звук выключен' : '🔈 Звук включён');
  wrap.append(
    h(
      'div',
      { class: 'panel' },
      h('h3', {}, '📱 Это устройство'),
      h('div', { class: 'row-btns' },
        soundBtn,
        h('button', { class: 'btn-soft', onclick: () => location.reload() }, '⟳ Обновить материалы'),
        h('button', {
          class: 'btn-soft danger',
          onclick: () => {
            if (confirm('Забыть семейный пароль и весь несинхронизированный прогресс на этом устройстве?')) {
              store.forgetDevice();
              location.hash = '';
              location.reload();
            }
          },
        }, 'Забыть пароль на этом устройстве')
      ),
      h('p', { class: 'muted' }, `Материалы обновлены: ${app.manifest && app.manifest.updated ? new Date(app.manifest.updated).toLocaleString('ru-RU') : '—'}`)
    )
  );
  return wrap;
}
