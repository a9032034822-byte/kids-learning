// Чтение вслух: карточки по одной (кнопки «послушать» и «прочитал») или таблица слогов,
// где каждую клетку можно нажать и послушать.
import { h, shuffle } from '../util.js';
import { t } from '../i18n.js';
import { prompt } from './common.js';

export function mount(el, task, ctx) {
  const L = task.lang || ctx.lang;
  el.append(prompt(task.q, ctx, { listen: false }));
  if (task.grid) return grid(el, task, ctx, L);
  let cards = task.cards.map((c) => (typeof c === 'string' ? { t: c } : c));
  const rounds = task.rounds || 1;
  let deck = [];
  for (let r = 0; r < rounds; r++) deck = deck.concat(task.shuffle || r > 0 ? shuffle(cards) : cards);
  let pos = 0;
  const counter = h('div', { class: 'task-counter' });
  const card = h('div', { class: 'read-card', lang: L });
  const hint = h('div', { class: 'read-hint', hidden: true });
  const tools = h('div', { class: 'read-tools' });
  el.append(counter, card, hint, tools);

  function show() {
    const c = deck[pos];
    card.textContent = c.t;
    card.classList.toggle('long', c.t.length > 14);
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
    counter.textContent = `${pos + 1} ${t(ctx.lang, 'of')} ${deck.length}` + (rounds > 1 ? ` · ${t(ctx.lang, 'round')} ${Math.floor(pos / cards.length) + 1}` : '');
    hint.hidden = true;
    hint.textContent = c.hint || '';
    tools.replaceChildren(
      ...[
        h('button', { class: 'btn-say', type: 'button', onclick: () => ctx.speak(c.say || c.t, c.lang || L) }, '🔊 ', t(ctx.lang, 'listen')),
        c.hint ? h('button', { class: 'btn-soft', type: 'button', onclick: () => (hint.hidden = !hint.hidden) }, '💬 ', t(ctx.lang, 'hint')) : null,
      ].filter(Boolean)
    );
    const last = pos === deck.length - 1;
    ctx.setAction(t(ctx.lang, 'iRead', ctx.gender) + ' ✓', () => {
      ctx.sfx.tap();
      if (last) ctx.finish({ errors: 0 });
      else {
        pos++;
        show();
      }
    });
  }
  show();
}

function grid(el, task, ctx, L) {
  el.append(h('p', { class: 'hint-line' }, '👆 ' + t(ctx.lang, 'tapToHear')));
  const table = h('div', { class: 'read-grid', lang: L, style: { '--cols': String(Math.max(...task.grid.map((r) => r.length))) } });
  const heard = new Set();
  task.grid.forEach((row, ri) =>
    row.forEach((cell, ci) => {
      const empty = !cell || cell === '—';
      table.append(
        h(
          'button',
          {
            type: 'button',
            class: 'grid-cell' + (empty ? ' empty' : ''),
            disabled: empty || null,
            onclick: (e) => {
              heard.add(ri + ':' + ci);
              e.currentTarget.classList.add('heard');
              ctx.speak(String(cell).toLowerCase(), L, 0.75);
            },
          },
          empty ? '' : cell
        )
      );
    })
  );
  el.append(table);
  ctx.setAction(t(ctx.lang, 'iReadAll', ctx.gender) + ' ✓', () => ctx.finish({ errors: 0 }));
}
