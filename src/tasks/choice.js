// Выбор из вариантов (один или несколько вопросов подряд).
import { h } from '../util.js';
import { t } from '../i18n.js';
import { sequence, prompt, listenBtn } from './common.js';

export function mount(el, task, ctx) {
  const L = ctx.lang;
  const items = task.items || [{ q: task.q, options: task.options, answer: task.answer, why: task.why, say: task.say }];
  const head = h('div', {}, task.items ? prompt(task.q, ctx) : null);
  const body = h('div');
  el.append(head, body);
  sequence(body, ctx, items, (i, box, done) => {
    const it = items[i];
    if (it.q) box.append(prompt(it.q, ctx));
    if (it.say) box.append(h('div', { class: 'say-row' }, listenBtn(ctx, it.say, it.sayLang, t(L, 'listen'))));
    const opts = h('div', { class: 'options' + (it.options.length === 2 ? ' two' : '') });
    const btns = it.options.map((o, j) =>
      h(
        'button',
        {
          class: 'opt',
          type: 'button',
          onclick: () => {
            btns.forEach((b) => (b.disabled = true));
            const ok = j === it.answer;
            btns[it.answer].classList.add('right');
            if (!ok) btns[j].classList.add('wrong');
            const why = it.why ? h('p', { class: 'why-note' }, it.why) : null;
            if (why) box.append(why);
            if (ok) ctx.feedback('ok', ctx.praise());
            else ctx.feedback('bad', t(L, 'notQuite'), it.options[it.answer]);
            done(ok ? null : { given: o, expected: it.options[it.answer], q: it.q || task.q });
          },
        },
        o
      )
    );
    btns.forEach((b) => opts.append(b));
    box.append(opts);
    ctx.setAction(null);
  });
}
