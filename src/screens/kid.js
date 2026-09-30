// Экран ребёнка: «Сегодня» — дорожка заданий по урокам дня.
import { h, weekday } from '../util.js';
import { ui, subject, TASK_ICONS } from '../i18n.js';
import { avatar } from '../characters.js';
import { weekState, flatTasks } from '../content.js';
import * as store from '../store.js';
import { kidHeader, taskTitle, taskStatus, isDone, dm, subjectChip, pageSheet } from './common.js';

const ZIG = [0, 56, 90, 56, 0, -56, -90, -56];

function pickDay(days, today, wanted) {
  if (wanted && days.some((d) => d.date === wanted)) return wanted;
  if (days.some((d) => d.date === today)) return today;
  const next = days.find((d) => d.date > today);
  return next ? next.date : days.length ? days[days.length - 1].date : null;
}

export async function kidHome(app, prof, { weekId, date } = {}) {
  const L = prof.uiLang || 'ru';
  const st = weekState(app.index, app.settings, app.today);
  const meta = weekId ? app.index.weeks.find((w) => w.id === weekId) : st.current;
  const screen = h('div', { class: 'screen kid', style: { '--c': prof.color || '#FFB703' } });
  screen.append(kidHeader(app, prof, meta && meta !== st.current ? { back: '#/kid', title: `${ui(L, 'week')} ${meta.week} · ${dm(meta.from)}–${dm(meta.to)}` } : {}));

  const main = h('div', { class: 'kid-main' });
  const side = h('aside', { class: 'kid-side' });
  screen.append(h('div', { class: 'kid-layout' }, main, side));

  const reviewCount = store.reviewList(prof.id).length;
  const reviewCard = h(
    'button',
    { class: 'side-card review', disabled: reviewCount ? null : true, onclick: () => app.go('#/kid/review') },
    h('span', { class: 'side-ic' }, '🔁'),
    h('span', {}, reviewCount ? ui(L, 'review') : ui(L, 'reviewEmpty')),
    reviewCount ? h('b', { class: 'badge' }, reviewCount) : null
  );

  if (!meta) {
    main.append(
      h(
        'div',
        { class: 'big-note' },
        h('div', { class: 'note-avatar', html: avatar(prof, st.holiday ? 'cheer' : 'happy') }),
        h('h2', {}, st.holiday ? '🎉 ' + ui(L, 'holiday') : ui(L, 'noLessons')),
        h('p', {}, st.holiday ? ui(L, 'holidayText') : ui(L, 'noWeek')),
        app.index.weeks.length ? h('button', { class: 'btn-big', onclick: () => app.go('#/kid/practice') }, '🌟 ' + ui(L, 'reviewAll')) : null
      )
    );
    side.append(reviewCard, archiveCard(app, L));
    return screen;
  }

  const data = await app.week(meta.id);
  const kid = data && data.kids[prof.id];
  if (!kid) {
    main.append(h('div', { class: 'big-note' }, h('p', {}, ui(L, 'noWeek'))));
    side.append(reviewCard, archiveCard(app, L));
    return screen;
  }

  const days = kid.days;
  const sel = pickDay(days, app.today, date);
  const isCurrent = meta === st.current;

  // полоска дней
  const strip = h('div', { class: 'day-strip' });
  days.forEach((d) => {
    const tasks = d.lessons.flatMap((l) => l.tasks);
    const done = tasks.filter((tk) => isDone(taskStatus(prof.id, meta.id, tk))).length;
    strip.append(
      h(
        'button',
        {
          class: 'day-chip' + (d.date === sel ? ' active' : '') + (d.date === app.today ? ' today' : '') + (done === tasks.length && tasks.length ? ' full' : ''),
          onclick: () => app.go(`#/kid/w/${meta.id}/${d.date}`),
        },
        h('span', { class: 'dc-wd' }, ui(L, 'days')[weekday(d.date)]),
        h('span', { class: 'dc-date' }, dm(d.date)),
        h('span', { class: 'dc-prog' }, done === tasks.length && tasks.length ? '✓' : `${done}/${tasks.length}`)
      )
    );
  });
  main.append(strip);

  if (isCurrent && !days.some((d) => d.date === app.today)) {
    main.append(h('div', { class: 'banner' }, st.holiday ? '🎉 ' + ui(L, 'holiday') : '😴 ' + ui(L, 'noLessons'), h('small', {}, ' ' + ui(L, 'noLessonsHint'))));
  }

  const day = days.find((d) => d.date === sel);
  if (day) main.append(trail(app, prof, meta, kid, day, L));

  // боковая колонка
  if (kid.poem) {
    side.append(
      h(
        'button',
        { class: 'side-card poem', onclick: () => app.go(`#/kid/poem/${meta.id}`) },
        h('span', { class: 'side-ic' }, '📜'),
        h('span', {}, h('small', {}, ui(L, 'poem')), h('br'), h('b', {}, kid.poem.title))
      )
    );
  }
  side.append(reviewCard);
  if (isCurrent) {
    const left = flatTasks(data, prof.id).filter((x) => x.day.date < app.today && !isDone(taskStatus(prof.id, meta.id, x.task)));
    if (left.length)
      side.append(
        h('button', { class: 'side-card catch', onclick: () => app.go(`#/kid/catchup/${meta.id}`) }, h('span', { class: 'side-ic' }, '🎒'), h('span', {}, ui(L, 'catchUp')), h('b', { class: 'badge' }, left.length))
      );
  }
  if (kid.pages && kid.pages.length)
    side.append(h('button', { class: 'side-card', onclick: () => app.go(`#/kid/pages/${meta.id}`) }, h('span', { class: 'side-ic' }, '📄'), h('span', {}, ui(L, 'pages'))));
  side.append(archiveCard(app, L));
  return screen;
}

function archiveCard(app, L) {
  return h('button', { class: 'side-card', onclick: () => app.go('#/kid/archive') }, h('span', { class: 'side-ic' }, '🗂️'), h('span', {}, ui(L, 'archive')));
}

function trail(app, prof, meta, kid, day, L) {
  const wrap = h('div', { class: 'trail' });
  let companionPlaced = false;
  day.lessons.forEach((lesson) => {
    const sub = subject(lesson.subject);
    const sts = lesson.tasks.map((tk) => taskStatus(prof.id, meta.id, tk));
    const doneN = sts.filter(isDone).length;
    const firstTodo = sts.findIndex((s) => s === 'todo');
    const complete = doneN === lesson.tasks.length;
    const head = h(
      'div',
      { class: 'lesson-head', style: { '--sc': sub.color } },
      h('div', { class: 'lesson-meta' }, lesson.time ? h('span', { class: 'time-chip' }, '🕘 ' + lesson.time) : null, subjectChip(lesson.subject), lesson.tag ? h('span', { class: 'tag-chip' }, lesson.tag) : null),
      h('div', { class: 'lesson-title' }, lesson.title),
      h(
        'div',
        { class: 'lesson-actions' },
        h('span', { class: 'lesson-prog' }, complete ? '🏅 ' + ui(L, 'done') : `${doneN} / ${lesson.tasks.length}`),
        h(
          'button',
          { class: 'btn-start', onclick: () => app.go(`#/kid/play/${meta.id}/${lesson.id}/${complete ? 0 : Math.max(0, firstTodo)}`) },
          complete ? '↺ ' + ui(L, 'again') : doneN ? '▶ ' + ui(L, 'continue') : '▶ ' + ui(L, 'start')
        )
      )
    );
    const path = h('div', { class: 'path' });
    lesson.tasks.forEach((tk, i) => {
      const s = sts[i];
      const here = !companionPlaced && s === 'todo';
      if (here) companionPlaced = true;
      const lang = tk.lang || sub.lang;
      path.append(
        h(
          'div',
          { class: 'node-row', style: { '--x': ZIG[i % ZIG.length] + 'px' } },
          h(
            'button',
            {
              class: `node ${s}` + (here ? ' current' : ''),
              style: { '--sc': sub.color },
              title: taskTitle(tk, lang),
              onclick: () => app.go(`#/kid/play/${meta.id}/${lesson.id}/${i}`),
            },
            h('span', { class: 'node-ic' }, s === 'done' || s === 'approved' ? '✓' : s === 'pending' ? '⏳' : TASK_ICONS[tk.type] || '⭐')
          ),
          h('span', { class: 'node-label', lang }, taskTitle(tk, lang), s === 'pending' ? h('small', {}, ' · ' + ui(L, 'wait')) : null),
          here ? h('span', { class: 'node-buddy', html: avatar(prof, 'happy') }) : null
        )
      );
    });
    wrap.append(h('section', { class: 'lesson' + (complete ? ' complete' : ''), style: { '--sc': sub.color } }, head, path));
  });
  return wrap;
}

export async function archiveScreen(app, prof) {
  const L = prof.uiLang || 'ru';
  const screen = h('div', { class: 'screen kid', style: { '--c': prof.color || '#FFB703' } }, kidHeader(app, prof, { back: '#/kid', title: ui(L, 'archive') }));
  const list = h('div', { class: 'week-list' });
  for (const w of [...app.index.weeks].reverse()) {
    let done = 0, total = 0;
    try {
      const data = await app.week(w.id);
      const flat = flatTasks(data, prof.id);
      total = flat.length;
      done = flat.filter((x) => isDone(taskStatus(prof.id, w.id, x.task))).length;
    } catch {}
    list.append(
      h(
        'button',
        { class: 'week-card', onclick: () => app.go(`#/kid/w/${w.id}`) },
        h('b', {}, `${ui(L, 'week')} ${w.week}`),
        h('span', {}, `${dm(w.from)} – ${dm(w.to)}`),
        h('span', { class: 'wk-prog' }, total ? `${done} / ${total}` : '—')
      )
    );
  }
  screen.append(h('div', { class: 'kid-main single' }, list));
  return screen;
}

export async function pagesScreen(app, prof, weekId) {
  const L = prof.uiLang || 'ru';
  const data = await app.week(weekId);
  const kid = data && data.kids[prof.id];
  const screen = h('div', { class: 'screen kid', style: { '--c': prof.color || '#FFB703' } }, kidHeader(app, prof, { back: `#/kid/w/${weekId}`, title: ui(L, 'pages') }));
  const box = h('div', { class: 'kid-main single pages' });
  for (const pg of (kid && kid.pages) || []) box.append(h('div', { class: 'page-num' }, `— ${pg.n} —`), pageSheet(kid, pg.n));
  screen.append(box);
  return screen;
}
