import { h } from '../util.js';
import { t, ui, subject } from '../i18n.js';
import { avatar } from '../characters.js';
import { muted, setMuted } from '../sound.js';
import * as store from '../store.js';
import { needsApproval } from '../tasks/index.js';
import { renderMarkdown } from '../markdown.js';

export const dm = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : '');

export function taskTitle(task, lang = 'ru') {
  if (task.title) return task.title;
  switch (task.type) {
    case 'rule':
      return task.name;
    case 'poem':
      return t(lang, { read: 'poemRead', part: 'poemPart', hints: 'poemHints', nohints: 'poemNoHints' }[task.stage] || 'poemRead');
    case 'page':
      return task.q || (lang === 'en' ? 'Page ' : 'Страница ') + [task.page].flat().join(', ');
    case 'column':
      return task.q || task.items.map((x) => `${x.a} ${x.op} ${x.b}`).join(' · ');
    default:
      return task.q || task.type;
  }
}

/** Статус задания для ребёнка: todo | done | pending (ждёт подтверждения) | approved */
export function taskStatus(kidId, weekId, task) {
  const rec = store.taskRec(kidId, weekId, task.id);
  if (!rec || !rec.done) return 'todo';
  if (needsApproval(task)) return store.approval(kidId, weekId, task.id) ? 'approved' : 'pending';
  return 'done';
}

export function isDone(st) {
  return st !== 'todo';
}

export function kidHeader(app, prof, opts = {}) {
  const L = prof.uiLang || 'ru';
  const s = app.stats(prof.id);
  const muteBtn = h('button', { class: 'icon-btn', title: 'Звук', onclick: () => (setMuted(!muted()), (muteBtn.textContent = muted() ? '🔇' : '🔈')) }, muted() ? '🔇' : '🔈');
  return h(
    'header',
    { class: 'kid-header', style: { '--c': prof.color || '#FFB703' } },
    opts.back ? h('button', { class: 'btn-back', onclick: () => app.go(opts.back) }, '←') : null,
    h('div', { class: 'kid-avatar', html: avatar(prof, 'happy') }),
    h('div', { class: 'kid-hello' }, h('div', { class: 'kid-hi' }, `${ui(L, 'hello')}, ${prof.name}!`), opts.title ? h('div', { class: 'kid-sub' }, opts.title) : null),
    h(
      'div',
      { class: 'kid-stats' },
      h('div', { class: 'stat star', title: ui(L, 'stars') }, h('span', { class: 'stat-ic' }, '⭐'), h('b', {}, s.stars)),
      h('div', { class: 'stat streak', title: ui(L, 'streak') }, h('span', { class: 'stat-ic' }, '🐾'), h('b', {}, s.streak), h('small', {}, ui(L, 'streak'))),
      h(
        'div',
        { class: 'stat level', title: ui(L, 'level') },
        h('small', {}, `${ui(L, 'level')} ${s.level}`),
        h('div', { class: 'level-bar' }, h('i', { style: { width: Math.round(s.levelPart * 100) + '%' } }))
      )
    ),
    muteBtn,
    h('button', { class: 'icon-btn', title: ui(L, 'logout'), onclick: () => app.logout() }, '⏏')
  );
}

export function subjectChip(code, extra) {
  const s = subject(code);
  return h('span', { class: 'subject-chip', style: { '--sc': s.color } }, s.icon + ' ' + s.label, extra ? ' · ' + extra : '');
}

export function pageSheet(kid, n) {
  const pg = (kid.pages || []).find((p) => p.n === n);
  return h('div', { class: 'paper', html: pg ? renderMarkdown(pg.md) : `<p>Страница ${n} не найдена</p>` });
}

export function confetti(root = document.body, n = 36) {
  const colors = ['#FFB703', '#FB8500', '#EF476F', '#06D6A0', '#118AB2', '#9B5DE5', '#FFD166'];
  const box = h('div', { class: 'confetti' });
  for (let i = 0; i < n; i++) {
    box.append(
      h('i', {
        style: {
          left: Math.random() * 100 + '%',
          background: colors[i % colors.length],
          animationDelay: Math.random() * 0.4 + 's',
          animationDuration: 1.4 + Math.random() * 1.2 + 's',
          transform: `rotate(${Math.random() * 360}deg)`,
        },
      })
    );
  }
  root.append(box);
  setTimeout(() => box.remove(), 3000);
}
