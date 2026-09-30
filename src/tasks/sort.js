// Разложи по группам: слово/буква появляется по одной, нажимаешь нужную «корзинку».
// context: true — показывает всё предложение и подсвечивает текущее слово (разбор по частям речи).
import { h } from '../util.js';
import { t } from '../i18n.js';
import { prompt, indices } from './common.js';

const COLORS = ['#EF476F', '#118AB2', '#06D6A0', '#FFB703', '#9B5DE5', '#F77F00', '#3A86FF', '#8AC926', '#FF595E', '#6A4C93'];

export function mount(el, task, ctx) {
  const L = ctx.lang;
  const items = task.items; // [{t, g}]
  const groups = task.groups;
  const order = indices(items, ctx.items);
  const placed = new Map();
  const wrong = [];
  let pos = 0;
  el.append(prompt(task.q, ctx));
  const ctxLine = task.context ? h('div', { class: 'sort-context', lang: L }) : null;
  const card = h('div', { class: 'sort-card', lang: L });
  const counter = h('div', { class: 'task-counter' });
  const btnRow = h('div', { class: 'sort-groups' + (groups.length > 4 ? ' many' : '') });
  const bins = h('div', { class: 'sort-bins' });
  el.append(counter, ctxLine, card, btnRow, bins);
  const binEls = groups.map((g, gi) => {
    const list = h('div', { class: 'bin-items' });
    bins.append(h('div', { class: 'bin', style: { borderColor: COLORS[gi % COLORS.length] } }, h('div', { class: 'bin-name', style: { color: COLORS[gi % COLORS.length] } }, g), list));
    return list;
  });
  const btns = groups.map((g, gi) =>
    h('button', { type: 'button', class: 'sort-btn', style: { background: COLORS[gi % COLORS.length] }, onclick: () => choose(gi) }, g)
  );
  btns.forEach((b) => btnRow.append(b));

  function paint() {
    if (ctxLine) {
      ctxLine.replaceChildren();
      items.forEach((it, i) => {
        const gi = placed.get(i);
        ctxLine.append(
          h('span', { class: 'ctx-word' + (i === order[pos] ? ' current' : ''), style: gi != null ? { color: COLORS[gi % COLORS.length] } : null }, it.t),
          it.br ? h('br') : ' '
        );
      });
    }
    if (pos < order.length) {
      card.textContent = items[order[pos]].t;
      counter.textContent = `${pos + 1} ${t(L, 'of')} ${order.length}`;
    }
  }

  let busy = false;
  function choose(gi) {
    if (busy || pos >= order.length) return;
    const i = order[pos];
    const it = items[i];
    const right = groups.indexOf(it.g);
    const ok = gi === right;
    busy = true;
    placed.set(i, right);
    binEls[right].append(h('span', { class: 'bin-item' + (ok ? '' : ' fixed') }, it.t));
    if (ok) {
      ctx.sfx.ok();
      card.classList.add('pop');
    } else {
      wrong.push({ i, given: groups[gi], expected: it.g, q: it.t });
      ctx.feedback('bad', t(L, 'notQuite'), `${it.t} → ${it.g}`);
      btns[right].classList.add('hint');
    }
    setTimeout(
      () => {
        busy = false;
        card.classList.remove('pop');
        btns.forEach((b) => b.classList.remove('hint'));
        if (ok) ctx.clearFeedback();
        pos++;
        if (pos >= order.length) {
          card.textContent = '✓';
          card.classList.add('done');
          btnRow.hidden = true;
          paint();
          if (!wrong.length) ctx.feedback('ok', ctx.praise());
          ctx.setAction(t(L, 'next'), () => ctx.finish({ errors: wrong.length, wrong }));
        } else paint();
      },
      ok ? 450 : 1500
    );
  }
  paint();
  ctx.setAction(null);
}
