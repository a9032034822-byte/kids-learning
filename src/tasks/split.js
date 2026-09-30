// Раздели текст на предложения: нажимаешь на последнее слово предложения — ставится точка,
// следующее слово само становится с заглавной буквы.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { prompt } from './common.js';

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

export function mount(el, task, ctx) {
  const L = ctx.lang;
  const words = task.words;
  const answer = new Set(task.ends);
  const last = words.length - 1;
  const ends = new Set([last]);
  el.append(prompt(task.q, ctx), h('p', { class: 'hint-line' }, '👆 ' + t(L, 'tapLastWord')));
  const para = h('div', { class: 'split-text', lang: L });
  const counter = h('div', { class: 'fix-status' });
  el.append(para, counter);
  let locked = false;
  const marks = new Map();

  function render() {
    para.replaceChildren();
    words.forEach((w, i) => {
      const startOfSentence = i === 0 || ends.has(i - 1);
      const txt = (startOfSentence ? cap(w) : w) + (ends.has(i) ? '.' : '');
      para.append(
        h(
          'button',
          {
            type: 'button',
            class: 'split-word' + (ends.has(i) ? ' end' : '') + (marks.get(i) ? ' ' + marks.get(i) : ''),
            disabled: locked || i === last || null,
            onclick: () => {
              if (ends.has(i)) ends.delete(i);
              else ends.add(i);
              marks.clear();
              ctx.sfx.tap();
              render();
            },
          },
          txt
        ),
        ' '
      );
    });
    counter.textContent = `${t(L, 'sentences')} ${ends.size}`;
  }

  let tries = 0;
  function check() {
    tries++;
    const missing = [...answer].filter((i) => !ends.has(i));
    const extra = [...ends].filter((i) => !answer.has(i));
    marks.clear();
    if (!missing.length && !extra.length) {
      locked = true;
      render();
      ctx.feedback('ok', ctx.praise(), `${t(L, 'sentences')} ${answer.size}`);
      ctx.setAction(t(L, 'next'), () => ctx.finish({ errors: tries > 1 ? 1 : 0, wrong: tries > 1 ? [{ i: 0, given: '', expected: task.answer, q: task.q }] : [] }));
      return;
    }
    if (tries < 2) {
      extra.forEach((i) => marks.set(i, 'extra'));
      render();
      ctx.feedback('bad', t(L, 'almost'), `${t(L, 'sentences')} ${answer.size}`);
      return;
    }
    ends.clear();
    answer.forEach((i) => ends.add(i));
    missing.forEach((i) => marks.set(i, 'shown'));
    locked = true;
    render();
    ctx.feedback('bad', t(L, 'notQuite'), task.answer);
    ctx.setAction(t(L, 'next'), () => ctx.finish({ errors: 1, wrong: [{ i: 0, given: '', expected: task.answer, q: task.q }] }));
  }

  render();
  ctx.setAction(t(L, 'check'), check);
}
