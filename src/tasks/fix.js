// Найди и исправь ошибки: нажимаешь на слово, исправляешь его, потом «Проверить».
import { h } from '../util.js';
import { t } from '../i18n.js';
import { prompt } from './common.js';

const core = (s) => String(s).trim().replace(/^[«"“(]+/, '').replace(/[.,!?;:»"”)]+$/, '');

function accepted(m, value) {
  const rights = [m.right].flat();
  return m.full ? rights.some((r) => r.trim() === String(value).trim()) : rights.some((r) => core(r) === core(value));
}

export function mount(el, task, ctx) {
  const L = ctx.lang;
  el.append(prompt(task.q, ctx), h('p', { class: 'hint-line' }, '👆 ' + t(L, 'tapWrongWord')));
  const tokens = task.tokens || task.text.split(/\s+/);
  const values = tokens.slice();
  const state = tokens.map(() => 'idle'); // idle | edited | right | falsefix | shown
  const byPos = new Map(task.mistakes.map((m) => [m.pos, m]));
  const para = h('div', { class: 'fix-text', lang: L });
  const status = h('div', { class: 'fix-status' });
  el.append(para, status);
  let editing = -1;

  function render() {
    para.replaceChildren();
    tokens.forEach((tok, p) => {
      if (p === editing) {
        const inp = h('input', {
          class: 'fix-input',
          value: values[p],
          autocapitalize: 'off',
          autocomplete: 'off',
          spellcheck: 'false',
          lang: L,
          size: Math.max(4, values[p].length + 2),
        });
        const commit = () => {
          if (editing !== p) return;
          values[p] = inp.value.trim() || tokens[p];
          state[p] = values[p] !== tokens[p] ? 'edited' : 'idle';
          editing = -1;
          render();
          update();
        };
        inp.addEventListener('keydown', (e) => e.key === 'Enter' && commit());
        inp.addEventListener('blur', commit);
        para.append(inp, ' ');
        setTimeout(() => {
          inp.focus();
          const w = core(inp.value);
          const start = inp.value.indexOf(w);
          try {
            inp.setSelectionRange(start, start + w.length);
          } catch {}
        }, 20);
      } else {
        const locked = state[p] === 'right' || state[p] === 'shown';
        para.append(
          h(
            'button',
            {
              type: 'button',
              class: 'fix-word ' + state[p],
              disabled: locked || null,
              onclick: () => {
                editing = p;
                render();
              },
            },
            values[p]
          ),
          ' '
        );
      }
    });
  }

  function update() {
    const edited = state.filter((s) => s === 'edited' || s === 'right').length;
    status.textContent = `${t(L, 'fixed')}: ${edited}`;
    ctx.setAction(t(L, 'check'), check, { disabled: !state.some((s) => s === 'edited') && tries === 0 });
  }

  let tries = 0;
  const wrongLog = [];
  function check() {
    if (editing >= 0) {
      editing = -1;
    }
    tries++;
    let missing = 0;
    tokens.forEach((tok, p) => {
      const m = byPos.get(p);
      if (m) {
        if (state[p] === 'right') return;
        if (accepted(m, values[p])) state[p] = 'right';
        else {
          missing++;
          if (state[p] === 'edited') state[p] = 'falsefix';
        }
      } else if (values[p] !== tok) state[p] = 'falsefix';
    });
    const falseFixes = tokens.filter((tok, p) => !byPos.has(p) && values[p] !== tok).length;
    render();
    if (!missing && !falseFixes) {
      ctx.feedback('ok', ctx.praise(), task.answer || null);
      status.textContent = `${t(L, 'fixed')}: ${task.mistakes.length} ${t(L, 'of')} ${task.mistakes.length}`;
      finishBtn();
      return;
    }
    if (tries < 2) {
      const parts = [];
      if (missing) parts.push(`${t(L, 'leftToFind')} ${missing}`);
      if (falseFixes) parts.push(t(L, 'notMistake') + ' — ' + falseFixes);
      ctx.feedback('bad', t(L, 'almost'), parts.join('. '));
      // неверные правки возвращаем к исходному слову, чтобы можно было попробовать снова
      tokens.forEach((tok, p) => {
        if (state[p] === 'falsefix') {
          if (!byPos.has(p)) values[p] = tok;
          state[p] = byPos.has(p) ? 'edited' : 'idle';
          if (byPos.has(p) && values[p] === tok) state[p] = 'idle';
        }
      });
      setTimeout(render, 900);
      ctx.setAction(t(L, 'check'), check);
      return;
    }
    tokens.forEach((tok, p) => {
      const m = byPos.get(p);
      if (m && state[p] !== 'right') {
        wrongLog.push({ i: task.mistakes.indexOf(m), given: values[p], expected: [m.right].flat()[0], q: tok });
        values[p] = m.full ? [m.right].flat()[0] : tok.replace(core(tok), core([m.right].flat()[0]));
        state[p] = 'shown';
      } else if (!m && values[p] !== tok) {
        values[p] = tok;
        state[p] = 'idle';
      }
    });
    render();
    ctx.feedback('bad', t(L, 'notQuite'), task.answer || null);
    finishBtn();
  }

  function finishBtn() {
    ctx.setAction(t(L, 'next'), () => ctx.finish({ errors: wrongLog.length, wrong: wrongLog }));
  }

  render();
  update();
}
