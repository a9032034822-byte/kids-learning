// Правило «Видишь / Пишешь / Почему»: выбор из двух вариантов, потом объяснение.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { listenBtn } from './common.js';

export function mount(el, task, ctx) {
  const L = ctx.lang;
  el.append(
    h(
      'div',
      { class: 'rule-card' },
      h('div', { class: 'rule-name' }, h('span', { class: 'rule-bulb' }, '💡'), h('span', {}, task.name), listenBtn(ctx, `${task.name}. ${task.text}`)),
      task.text ? h('p', { class: 'rule-text' }, task.text) : null
    )
  );

  const slot = h('span', { class: 'blank' }, ' ? ');
  const hasOptions = Array.isArray(task.options) && task.options.length >= 2;
  const seeLine = hasOptions
    ? h('p', { class: 'see-line' }, task.seeBefore || '', slot, task.seeAfter || '')
    : h('p', { class: 'see-line' }, task.see);
  el.append(h('div', { class: 'rule-box see' }, h('div', { class: 'lbl' }, t(L, 'youSee')), seeLine));

  const reveal = h(
    'div',
    { class: 'rule-reveal', hidden: true },
    h('div', { class: 'rule-box write' }, h('div', { class: 'lbl' }, t(L, 'youWrite')), h('p', {}, task.write)),
    task.why ? h('div', { class: 'rule-box why' }, h('div', { class: 'lbl' }, t(L, 'why')), h('p', {}, task.why)) : null
  );

  if (hasOptions) {
    const opts = h('div', { class: 'options two' });
    const btns = task.options.map((o, i) =>
      h(
        'button',
        {
          class: 'opt',
          type: 'button',
          onclick: () => {
            btns.forEach((b) => (b.disabled = true));
            const ok = i === task.answer;
            btns[task.answer].classList.add('right');
            slot.textContent = task.options[task.answer];
            slot.classList.add(ok ? 'ok' : 'shown');
            if (!ok) btns[i].classList.add('wrong');
            reveal.hidden = false;
            if (ok) ctx.feedback('ok', ctx.praise());
            else ctx.feedback('bad', t(L, 'notQuite'), task.options[task.answer]);
            ctx.setAction(t(L, 'next'), () =>
              ctx.finish({ errors: ok ? 0 : 1, wrong: ok ? [] : [{ i: 0, given: o, expected: task.options[task.answer], q: task.name }] })
            );
            reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          },
        },
        o
      )
    );
    btns.forEach((b) => opts.append(b));
    el.append(opts);
    ctx.setAction(null);
  } else {
    ctx.setAction(t(L, 'howRight'), () => {
      reveal.hidden = false;
      reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      ctx.setAction(t(L, 'gotIt'), () => ctx.finish({ errors: 0 }));
    });
  }
  el.append(reveal);
}
