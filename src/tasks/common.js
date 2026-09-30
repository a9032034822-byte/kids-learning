import { h } from '../util.js';
import { t } from '../i18n.js';

export function listenBtn(ctx, text, lang, label) {
  if (!text) return null;
  return h(
    'button',
    {
      class: 'btn-listen',
      type: 'button',
      title: t(lang || ctx.lang, 'listen'),
      onclick: (e) => {
        e.stopPropagation();
        ctx.speak(text, lang || ctx.lang);
      },
    },
    '🔊',
    label ? h('span', {}, ' ' + label) : null
  );
}

/** Индексы пунктов, которые надо пройти (при повторе — только ошибочные). */
export function indices(list, only) {
  const all = list.map((_, i) => i);
  if (!only || !only.length) return all;
  const set = new Set(only);
  const sub = all.filter((i) => set.has(i));
  return sub.length ? sub : all;
}

export function counter(ctx, pos, total) {
  if (total < 2) return null;
  return h('div', { class: 'task-counter' }, `${pos + 1} ${t(ctx.lang, 'of')} ${total}`);
}

export function prompt(text, ctx, opts = {}) {
  if (!text) return null;
  return h('div', { class: 'task-prompt' }, h('span', {}, text), opts.listen === false ? null : listenBtn(ctx, text));
}

/** Последовательный проход по пунктам: render(i, done) рисует пункт и вызывает done(wrongEntry|null). */
export function sequence(el, ctx, list, render) {
  const order = indices(list, ctx.items);
  const wrong = [];
  let pos = 0;
  const step = () => {
    el.replaceChildren();
    ctx.clearFeedback();
    if (pos >= order.length) {
      ctx.finish({ errors: wrong.length, wrong });
      return;
    }
    const i = order[pos];
    const box = h('div', { class: 'seq-item' }, counter(ctx, pos, order.length));
    el.append(box);
    render(i, box, (w) => {
      if (w) wrong.push({ i, ...w });
      pos++;
      const last = pos >= order.length;
      ctx.setAction(t(ctx.lang, 'next'), step, { big: true, last });
    });
  };
  step();
}
