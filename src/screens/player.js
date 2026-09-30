// Прохождение урока: задания по одному, ошибки возвращаются на повтор в конце.
import { h, shuffle, weekday } from '../util.js';
import { ui, subject, praise } from '../i18n.js';
import { avatar } from '../characters.js';
import { speak, sfx } from '../sound.js';
import { flatTasks, findLesson } from '../content.js';
import * as store from '../store.js';
import { TASKS, RETRYABLE, needsApproval } from '../tasks/index.js';
import { taskTitle, taskStatus, isDone, subjectChip, pageSheet, confetti } from './common.js';

const POEM_STAGE_BY_WEEKDAY = { 2: 'read', 3: 'part', 4: 'hints', 5: 'nohints' };

async function buildQueue(app, prof, rest) {
  const [mode, a, b, c] = rest;
  const entry = (weekId, week, day, lesson, task, extra = {}) => ({ weekId, week, kid: week.kids[prof.id], day, lesson, task, ...extra });
  if (mode === 'play') {
    const week = await app.week(a);
    const found = findLesson(week, prof.id, b);
    if (!found) return { queue: [] };
    const start = Math.max(0, Math.min(found.lesson.tasks.length - 1, parseInt(c || '0', 10) || 0));
    return {
      title: found.lesson.title,
      lesson: found.lesson,
      back: `#/kid/w/${a}/${found.day.date}`,
      queue: found.lesson.tasks.slice(start).map((task) => entry(a, week, found.day, found.lesson, task)),
    };
  }
  if (mode === 'catchup') {
    const week = await app.week(a);
    const left = flatTasks(week, prof.id).filter((x) => x.day.date < app.today && !isDone(taskStatus(prof.id, a, x.task)));
    return { title: ui(prof.uiLang, 'catchUp'), back: '#/kid', queue: left.map((x) => entry(a, week, x.day, x.lesson, x.task)) };
  }
  if (mode === 'review') {
    const list = store.reviewList(prof.id);
    const queue = [];
    for (const r of list) {
      let week;
      try {
        week = await app.week(r.weekId);
      } catch {
        continue;
      }
      const x = week && flatTasks(week, prof.id).find((y) => y.task.id === r.taskId);
      if (!x) continue;
      const items = [...new Set((r.rec.wrong || []).map((w) => w.i).filter((i) => i != null))];
      queue.push(entry(r.weekId, week, x.day, x.lesson, x.task, { retry: true, items }));
    }
    return { title: ui(prof.uiLang, 'review'), back: '#/kid', queue: queue.slice(0, 12) };
  }
  if (mode === 'practice') {
    const pool = [];
    for (const w of app.index.weeks.filter((w) => w.from <= app.today).slice(-6)) {
      try {
        const week = await app.week(w.id);
        for (const x of flatTasks(week, prof.id)) if (RETRYABLE.has(x.task.type) && x.task.type !== 'fix') pool.push(entry(w.id, week, x.day, x.lesson, x.task, { practice: true }));
      } catch {}
    }
    return { title: ui(prof.uiLang, 'reviewAll'), back: '#/kid', queue: shuffle(pool).slice(0, 8) };
  }
  if (mode === 'poem') {
    const week = await app.week(a);
    const kid = week.kids[prof.id];
    const stage = POEM_STAGE_BY_WEEKDAY[weekday(app.today)] || 'read';
    const lesson = { id: 'poem', title: kid.poem ? kid.poem.title : '', subject: 'lit' };
    return {
      title: ui(prof.uiLang, 'poem'),
      back: `#/kid/w/${a}`,
      queue: [entry(a, week, null, lesson, { id: 'poem-practice', type: 'poem', stage, approve: false }, { practice: true })],
    };
  }
  return { queue: [] };
}

export async function playerScreen(app, prof, rest) {
  const { queue, title, back = '#/kid', lesson } = await buildQueue(app, prof, rest);
  const L = prof.uiLang || 'ru';
  const root = h('div', { class: 'screen player', style: { '--c': prof.color || '#FFB703' } });
  if (!queue.length) {
    root.append(
      h('div', { class: 'big-note' }, h('div', { class: 'note-avatar', html: avatar(prof, 'cheer') }), h('h2', {}, ui(L, 'reviewEmpty')), h('button', { class: 'btn-big', onclick: () => app.go(back) }, ui(L, 'toPath')))
    );
    return root;
  }

  const bar = h('div', { class: 'progress' }, h('i'));
  const buddy = h('div', { class: 'player-buddy', html: avatar(prof, 'happy') });
  const sub = h('div', { class: 'player-sub' });
  const body = h('main', { class: 'player-body' });
  const fb = h('div', { class: 'feedback', hidden: true });
  const main = h('button', { class: 'btn-main', type: 'button' });
  const foot = h('footer', { class: 'player-foot' }, fb, main);
  root.append(
    h('header', { class: 'player-top' }, h('button', { class: 'icon-btn close', title: ui(L, 'close'), onclick: () => (window.speechSynthesis && window.speechSynthesis.cancel(), app.go(back)) }, '✕'), bar, buddy),
    sub,
    body,
    foot
  );

  let idx = 0;
  let earned = 0;
  let moodTimer = null;
  const setMood = (m) => {
    buddy.innerHTML = avatar(prof, m);
    buddy.classList.remove('bounce');
    void buddy.offsetWidth;
    if (m === 'cheer') buddy.classList.add('bounce');
    clearTimeout(moodTimer);
    if (m !== 'happy') moodTimer = setTimeout(() => (buddy.innerHTML = avatar(prof, 'happy')), 1800);
  };

  function run() {
    const e = queue[idx];
    const sj = subject(e.lesson.subject);
    const lang = e.task.lang || sj.lang;
    bar.firstChild.style.width = Math.round((idx / queue.length) * 100) + '%';
    sub.replaceChildren(...[subjectChip(e.lesson.subject), h('span', { class: 'player-title' }, e.lesson.title), e.retry ? h('span', { class: 'tag-chip retry' }, '🔁 ' + ui(L, 'again')) : null].filter(Boolean));
    body.replaceChildren();
    body.setAttribute('lang', lang);
    fb.hidden = true;
    main.hidden = true;
    root.style.setProperty('--sc', sj.color);
    let finished = false;
    const view = h('div', { class: 'task task-' + e.task.type });
    body.append(view);
    const ctx = {
      lang,
      gender: prof.gender,
      items: e.items,
      poem: e.kid && e.kid.poem,
      sfx,
      speak: (text, l) => speak(text, l || lang),
      praise: () => praise(lang, prof.gender),
      setAction(label, fn, opts = {}) {
        if (!label) {
          main.hidden = true;
          return;
        }
        main.hidden = false;
        main.textContent = label;
        main.disabled = !!opts.disabled;
        main.onclick = () => fn && fn();
      },
      feedback(kind, title, detail) {
        if (!kind) return ctx.clearFeedback();
        fb.hidden = false;
        fb.className = 'feedback ' + kind;
        fb.replaceChildren(...[h('b', {}, title), detail ? h('div', { class: 'fb-detail' }, detail) : null].filter(Boolean));
        if (kind === 'ok') {
          sfx.ok();
          setMood('cheer');
          confetti(root, 18);
        } else if (kind === 'bad') {
          root.querySelectorAll('.confetti').forEach((c) => c.remove());
          sfx.soft();
          setMood('think');
        }
      },
      clearFeedback() {
        fb.hidden = true;
      },
      finish(result) {
        if (finished) return;
        finished = true;
        done(e, result || { errors: 0 });
      },
      pageSheet: (n) => pageSheet(e.kid, n),
      pageToggle(n) {
        const sheet = h('div', { class: 'page-toggle-body', hidden: true }, [n].flat().map((x) => pageSheet(e.kid, x)));
        const btn = h('button', { class: 'btn-soft', type: 'button' }, '📄 ', ui(L, 'pages'));
        btn.onclick = () => {
          sheet.hidden = !sheet.hidden;
        };
        return h('div', { class: 'page-toggle' }, btn, sheet);
      },
    };
    try {
      TASKS[e.task.type].mount(view, e.task, ctx);
    } catch (err) {
      console.error(err);
      view.append(h('p', {}, 'Не получилось показать это задание.'), pageFallback(e));
      ctx.setAction(ui(L, 'toPath'), () => ctx.finish({ errors: 0 }));
    }
  }

  function pageFallback(e) {
    return e.task.page ? pageSheet(e.kid, [e.task.page].flat()[0]) : null;
  }

  function done(e, result) {
    const before = store.taskRec(prof.id, e.weekId, e.task.id);
    if (e.practice) {
      if (e.task.id !== 'poem-practice' && !(result.errors > 0)) store.saveReview(prof.id, app.today, 1);
      else store.markActive(prof.id, app.today);
      if (!(result.errors > 0) && e.task.id !== 'poem-practice') earned++;
    } else {
      store.saveTask(prof.id, e.weekId, e.task.id, result, { retry: !!e.retry, pending: needsApproval(e.task), date: app.today });
      const after = store.taskRec(prof.id, e.weekId, e.task.id);
      if (!before || !before.done) earned++;
      if (after && after.fixed && !(before && before.fixed)) earned++;
    }
    const wrongIdx = [...new Set((result.wrong || []).map((w) => w.i).filter((i) => i != null))];
    if (!e.retry && !e.practice && wrongIdx.length && RETRYABLE.has(e.task.type)) queue.push({ ...e, retry: true, items: wrongIdx });
    idx++;
    if (idx < queue.length) run();
    else celebrate();
  }

  function celebrate() {
    bar.firstChild.style.width = '100%';
    sub.replaceChildren();
    fb.hidden = true;
    body.replaceChildren(
      h(
        'div',
        { class: 'celebrate' },
        h('div', { class: 'celebrate-avatar bounce', html: avatar(prof, 'cheer') }),
        h('h1', {}, ui(L, 'lessonDone')),
        h('div', { class: 'celebrate-stars' }, '⭐'.repeat(Math.min(earned, 10)) || '⭐'),
        h('p', {}, `${ui(L, 'starsEarned')}: ${earned}`)
      )
    );
    sfx.fanfare();
    confetti(root, 60);
    main.hidden = false;
    main.disabled = false;
    main.textContent = ui(L, 'toPath');
    main.onclick = () => app.go(back);
  }

  run();
  return root;
}
