// Задание вне планшета: «Сделай в тетради», таймер где нужен, кнопка «готово».
// Родитель подтверждает выполнение у себя. Песня может быть с роликом YouTube (поле video).
import { h } from '../util.js';
import { t } from '../i18n.js';
import { listenBtn } from './common.js';

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

// Ролик грузится только по нажатию и с youtube-nocookie.com: до нажатия YouTube ничего не получает.
function videoBlock(v, label, L, ctx) {
  const box = h('div', { class: 'video-box' });
  const btn = h('button', { type: 'button', class: 'btn-big go video-play' }, '▶ ', label);
  btn.onclick = () => {
    if (navigator.onLine === false) return ctx.feedback('info', '📶 ' + t(L, 'needNet'));
    box.replaceChildren(
      h('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${v.youtube}?rel=0&playsinline=1&modestbranding=1&autoplay=1`,
        title: v.title || 'YouTube',
        allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin',
      })
    );
    box.classList.add('playing');
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  box.append(btn);
  return box;
}

export function mount(el, task, ctx) {
  const L = ctx.lang;
  const videos = [task.video].flat().filter((v) => v && YT_ID.test(v.youtube));
  el.append(
    h(
      'div',
      { class: 'offline-card' },
      h('div', { class: 'offline-icon' }, task.icon || '📓'),
      h('div', { class: 'offline-kicker' }, t(L, videos.length ? 'sing' : 'notebook')),
      h('div', { class: 'offline-q' }, task.q, listenBtn(ctx, task.q)),
      task.details ? h('p', { class: 'offline-details' }, task.details) : null
    )
  );
  videos.forEach((v) => el.append(videoBlock(v, videos.length > 1 && v.title ? v.title : t(L, 'playVideo'), L, ctx)));
  if (task.page) el.append(ctx.pageToggle(task.page));

  let words = null;
  if (task.timer) {
    const total = Math.round(task.timer * 60);
    let left = total;
    let tick = null;
    const face = h('div', { class: 'timer-face' });
    const ring = h('div', { class: 'timer-ring' }, face);
    const startBtn = h('button', { type: 'button', class: 'btn-big go' }, '▶ ', t(L, 'timerStart'));
    const resetBtn = h('button', { type: 'button', class: 'btn-soft' }, '↺ ', t(L, 'timerReset'));
    const paint = () => {
      const m = Math.floor(left / 60), s = left % 60;
      face.textContent = `${m}:${String(s).padStart(2, '0')}`;
      ring.style.setProperty('--p', String(1 - left / total));
      ring.classList.toggle('over', left === 0);
    };
    const stop = () => {
      clearInterval(tick);
      tick = null;
      startBtn.replaceChildren('▶ ', t(L, 'timerStart'));
    };
    startBtn.onclick = () => {
      if (tick) return stop();
      if (left === 0) left = total;
      startBtn.replaceChildren('⏸ ', t(L, 'timerPause'));
      tick = setInterval(() => {
        if (!el.isConnected) return stop();
        left = Math.max(0, left - 1);
        paint();
        if (left === 0) {
          stop();
          ctx.sfx.bell();
          ctx.feedback('info', '⏰ ' + t(L, 'timeUp'));
        }
      }, 1000);
    };
    resetBtn.onclick = () => {
      stop();
      left = total;
      paint();
    };
    paint();
    el.append(h('div', { class: 'timer' }, ring, h('div', { class: 'timer-btns' }, startBtn, resetBtn)));
  }
  if (task.count === 'words') {
    words = h('input', { class: 'answer-input num small', inputmode: 'numeric', placeholder: '…', 'aria-label': t(L, 'wordsCount') });
    el.append(h('label', { class: 'field words' }, h('span', { class: 'field-label' }, t(L, 'wordsCount')), words));
  }
  ctx.setAction(t(L, 'notebookDone', ctx.gender) + ' ✓', () => {
    const extra = words && words.value.trim() ? { words: words.value.trim() } : undefined;
    if (task.approve !== false) ctx.feedback('info', '👀 ' + t(L, 'waitParent'));
    setTimeout(() => ctx.finish({ errors: 0, extra }), task.approve !== false ? 1200 : 0);
  });
}
