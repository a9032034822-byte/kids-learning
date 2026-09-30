// Задание вне планшета: «Сделай в тетради», таймер где нужен, кнопка «готово».
// Родитель подтверждает выполнение у себя.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { listenBtn } from './common.js';

export function mount(el, task, ctx) {
  const L = ctx.lang;
  el.append(
    h(
      'div',
      { class: 'offline-card' },
      h('div', { class: 'offline-icon' }, task.icon || '📓'),
      h('div', { class: 'offline-kicker' }, t(L, 'notebook')),
      h('div', { class: 'offline-q' }, task.q, listenBtn(ctx, task.q)),
      task.details ? h('p', { class: 'offline-details' }, task.details) : null
    )
  );
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
