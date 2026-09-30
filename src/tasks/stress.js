// Поставь ударение: слово по буквам, нажимаешь на ударную гласную.
// После ответа ударная отмечена знаком, безударные подчёркнуты.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { sequence, prompt, listenBtn } from './common.js';

const VOWELS = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ';

export function mount(el, task, ctx) {
  const L = ctx.lang;
  el.append(prompt(task.q, ctx), h('p', { class: 'hint-line' }, '👆 ' + t(L, 'tapStress')));
  const body = h('div');
  el.append(body);
  sequence(body, ctx, task.words, (i, box, done) => {
    const { w, s } = task.words[i];
    const letters = [...w];
    const row = h('div', { class: 'stress-word', lang: L });
    const btns = letters.map((ch, k) => {
      const vowel = VOWELS.includes(ch);
      return h(
        'button',
        {
          type: 'button',
          class: 'letter' + (vowel ? ' vowel' : ''),
          disabled: !vowel || null,
          onclick: () => answer(k),
        },
        ch
      );
    });
    btns.forEach((b) => row.append(b));
    box.append(row);
    ctx.setAction(null);

    function answer(k) {
      const ok = k === s;
      btns.forEach((b, j) => {
        b.disabled = true;
        if (j === s) b.classList.add('stressed');
        else if (VOWELS.includes(letters[j])) b.classList.add('unstressed');
      });
      if (!ok) btns[k].classList.add('wrong');
      box.append(h('div', { class: 'say-row' }, listenBtn(ctx, w, L, t(L, 'listen'))));
      const accented = letters.map((ch, j) => (j === s ? ch + '́' : ch)).join('');
      if (ok) ctx.feedback('ok', ctx.praise(), accented);
      else ctx.feedback('bad', t(L, 'notQuite'), accented);
      done(ok ? null : { given: letters.map((ch, j) => (j === k ? ch + '́' : ch)).join(''), expected: accented, q: w });
    }
  });
}
