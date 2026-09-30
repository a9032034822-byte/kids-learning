// Пример в столбик: цифры вводятся по разрядам (справа налево) на большой цифровой клавиатуре.
// Деление: частное вписывается слева направо, потом показывается проверка умножением.
import { h, fmtNum } from '../util.js';
import { t } from '../i18n.js';
import { exprToRu } from '../numwords.js';
import { sequence, prompt } from './common.js';

const OPS = { '+': '+', '-': '−', '−': '−', '×': '×', '*': '×', ':': ':' };

export function mount(el, task, ctx) {
  const L = ctx.lang;
  el.append(prompt(task.q, ctx, { listen: false }));
  const body = h('div');
  el.append(body);
  sequence(body, ctx, task.items, (i, box, done) => {
    const it = task.items[i];
    const op = OPS[it.op] || it.op;
    const A = String(it.a), B = String(it.b), R = String(it.r);
    const isDiv = op === ':';
    const W = isDiv ? R.length : Math.max(A.length, B.length, R.length) + (op === '+' && R.length <= Math.max(A.length, B.length) ? 1 : 0);
    const cells = Array(W).fill('');
    let focus = isDiv ? 0 : W - 1;
    const say = L === 'ru' ? exprToRu(it.a, op, it.b) : `${it.a} ${op === '−' ? 'minus' : op === '+' ? 'plus' : op} ${it.b}`;

    const head = h(
      'div',
      { class: 'column-head' },
      h('span', { class: 'column-expr' }, `${fmtNum(A)} ${op} ${fmtNum(B)}`),
      h('button', { class: 'btn-listen', type: 'button', onclick: () => ctx.speak(say, L) }, '🔊')
    );
    box.append(head);
    if (isDiv) box.append(h('p', { class: 'hint-line' }, '📓 ' + t(L, 'columnDiv')));

    const grid = h('div', { class: 'column-grid' + (isDiv ? ' div' : ''), style: { '--cols': String(isDiv ? A.length + B.length + 2 + W : W + 1) } });
    const ansCells = [];
    const mk = (cls, txt) => h('div', { class: 'cc ' + cls }, txt);

    if (!isDiv) {
      // строка «в уме»
      grid.append(mk('op', ''));
      for (let k = 0; k < W; k++) {
        const c = h('button', { class: 'cc carry', type: 'button', title: t(L, 'carry') }, '');
        c.onclick = () => {
          c.textContent = c.textContent ? '' : op === '−' ? '•' : '1';
        };
        grid.append(k < W - 1 ? c : mk('nocarry', ''));
      }
      grid.append(mk('op', ''));
      for (let k = 0; k < W; k++) grid.append(mk('digit', A.padStart(W, ' ')[k].trim()));
      grid.append(mk('op sign', op));
      for (let k = 0; k < W; k++) grid.append(mk('digit', B.padStart(W, ' ')[k].trim()));
      grid.append(h('div', { class: 'column-line', style: { gridColumn: `1 / span ${W + 1}` } }));
      grid.append(mk('op', ''));
      for (let k = 0; k < W; k++) {
        const c = h('button', { class: 'cc ans', type: 'button', onclick: () => setFocus(k) }, '');
        ansCells.push(c);
        grid.append(c);
      }
    } else {
      for (const ch of A) grid.append(mk('digit', ch));
      grid.append(mk('op sign', ':'));
      for (const ch of B) grid.append(mk('digit', ch));
      grid.append(mk('op sign', '='));
      for (let k = 0; k < W; k++) {
        const c = h('button', { class: 'cc ans', type: 'button', onclick: () => setFocus(k) }, '');
        ansCells.push(c);
        grid.append(c);
      }
    }
    const wrapEl = h('div', { class: 'column-wrap' }, grid);
    box.append(h('div', { class: 'column-layout' }, wrapEl));

    const pad = h('div', { class: 'digit-pad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].forEach((d) =>
      pad.append(
        h(
          'button',
          {
            type: 'button',
            class: 'pad-key' + (d === '⌫' ? ' back' : d === '✓' ? ' ok' : ''),
            onclick: () => press(d),
          },
          d
        )
      )
    );
    box.lastChild.append(pad);
    const note = h('div', { class: 'column-note' });
    box.append(note);

    const onKey = (e) => {
      if (!box.isConnected) return document.removeEventListener('keydown', onKey);
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') press('✓');
    };
    document.addEventListener('keydown', onKey);

    function setFocus(k) {
      focus = Math.max(0, Math.min(W - 1, k));
      paint();
    }
    function paint() {
      ansCells.forEach((c, k) => {
        c.textContent = cells[k];
        c.classList.toggle('focus', k === focus && !lockedAll);
      });
      const filled = cells.some((x) => x);
      ctx.setAction(t(L, 'check'), check, { disabled: !filled || lockedAll });
    }
    let lockedAll = false;
    function press(d) {
      if (lockedAll) return;
      ctx.sfx.tap();
      if (d === '✓') return check();
      if (d === '⌫') {
        if (cells[focus]) cells[focus] = '';
        else {
          focus = isDiv ? Math.max(0, focus - 1) : Math.min(W - 1, focus + 1);
          cells[focus] = '';
        }
      } else {
        cells[focus] = d;
        ansCells[focus].classList.remove('wrong');
        focus = isDiv ? Math.min(W - 1, focus + 1) : Math.max(0, focus - 1);
      }
      paint();
    }
    let tries = 0;
    function value() {
      return cells.join('').replace(/^\s+/, '');
    }
    function check() {
      if (!cells.some((x) => x)) return;
      tries++;
      const given = cells.map((x) => x || ' ').join('').trim();
      const gapInside = /\d\s+\d/.test(given);
      const v = given.replace(/\s/g, '');
      const ok = !gapInside && v === R;
      const target = isDiv ? R.padEnd(W, ' ') : R.padStart(W, ' ');
      if (ok) {
        lockedAll = true;
        ansCells.forEach((c) => c.classList.add('right'));
        paint();
        ctx.feedback('ok', ctx.praise(), isDiv ? `${t(L, 'check2')} ${fmtNum(R)} × ${fmtNum(B)} = ${fmtNum(A)}` : null);
        done(tries > 1 ? { given: '(со 2-й попытки)', expected: `${A} ${op} ${B} = ${R}`, q: `${A} ${op} ${B}`, second: true } : null);
        return;
      }
      ansCells.forEach((c, k) => c.classList.toggle('wrong', (cells[k] || ' ') !== target[k]));
      if (tries < 2) {
        ctx.feedback('bad', t(L, 'almost'));
        const firstWrong = ansCells.findIndex((c) => c.classList.contains('wrong'));
        focus = firstWrong >= 0 ? firstWrong : focus;
        paint();
        return;
      }
      lockedAll = true;
      for (let k = 0; k < W; k++) cells[k] = target[k].trim();
      ansCells.forEach((c) => {
        c.classList.remove('wrong');
        c.classList.add('shown');
      });
      paint();
      ctx.feedback('bad', t(L, 'notQuite'), `${fmtNum(A)} ${op} ${fmtNum(B)} = ${fmtNum(R)}`);
      done({ given: v || value(), expected: R, q: `${A} ${op} ${B}` });
    }
    paint();
  });
}
