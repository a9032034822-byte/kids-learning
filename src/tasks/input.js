// Вписать ответ (числа или слова), по одному пункту. Можно «под диктовку» — поле say.
import { h, matches, fmtNum } from '../util.js';
import { t } from '../i18n.js';
import { sequence, prompt, listenBtn } from './common.js';

function fieldsOf(it) {
  if (it.fields) return it.fields;
  return [{ label: it.label, a: it.a, suffix: it.suffix }];
}

function isNumeric(a) {
  return [a].flat().every((x) => /^[−\-]?[\d\s ]+$/.test(String(x).trim()));
}

export function mount(el, task, ctx) {
  const L = ctx.lang;
  el.append(prompt(task.q, ctx));
  const body = h('div');
  el.append(body);
  sequence(body, ctx, task.items, (i, box, done) => {
    const it = task.items[i];
    if (it.say) {
      box.append(
        h('div', { class: 'say-row' }, h('button', { class: 'btn-say', type: 'button', onclick: () => ctx.speak(it.say, it.sayLang || L) }, '🔊 ', t(L, 'dictation')))
      );
      setTimeout(() => ctx.speak(it.say, it.sayLang || L), 350);
    }
    if (it.q) box.append(h('div', { class: 'item-q' }, it.q, it.listen ? listenBtn(ctx, it.listen) : null));
    const fields = fieldsOf(it);
    const inputs = fields.map((f) => {
      const mode = task.check || (isNumeric(f.a) ? 'number' : 'text');
      const inp = h('input', {
        class: 'answer-input' + (mode === 'number' ? ' num' : ''),
        type: 'text',
        inputmode: mode === 'number' ? 'numeric' : 'text',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        lang: L,
        placeholder: f.placeholder || '…',
        'aria-label': f.label || t(L, 'field'),
      });
      inp._mode = mode;
      inp._a = f.a;
      inp.addEventListener('input', () => {
        inp.classList.remove('wrong');
        ctx.setAction(t(L, 'check'), check, { disabled: inputs.some((x) => !x.value.trim()) });
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const next = inputs[inputs.indexOf(inp) + 1];
          if (next && !next.value.trim()) next.focus();
          else if (!inputs.some((x) => !x.value.trim())) check();
        }
      });
      return inp;
    });
    const row = h('div', { class: 'fields' });
    fields.forEach((f, k) =>
      row.append(h('label', { class: 'field' }, f.label ? h('span', { class: 'field-label' }, f.label) : null, inputs[k], f.suffix ? h('span', { class: 'field-suffix' }, f.suffix) : null))
    );
    box.append(row);
    setTimeout(() => inputs[0] && inputs[0].focus({ preventScroll: true }), 50);

    let tries = 0;
    function check() {
      tries++;
      const res = inputs.map((inp) => matches(inp.value, inp._a, inp._mode));
      res.forEach((ok, k) => {
        inputs[k].classList.toggle('right', ok);
        inputs[k].classList.toggle('wrong', !ok);
        if (ok) inputs[k].readOnly = true;
      });
      if (res.every(Boolean)) {
        ctx.feedback('ok', ctx.praise());
        inputs.forEach((x) => (x.readOnly = true));
        done(tries > 1 ? { given: '(со 2-й попытки)', expected: show(fields), q: it.q || it.say || task.q, second: true } : null);
      } else if (tries < 2) {
        ctx.feedback('bad', t(L, 'almost'));
        const firstWrong = inputs[res.indexOf(false)];
        firstWrong.focus();
        firstWrong.select && firstWrong.select();
        ctx.setAction(t(L, 'check'), check);
      } else {
        const given = inputs.map((x) => x.value).join(' / ');
        inputs.forEach((x, k) => {
          x.readOnly = true;
          if (!res[k]) x.value = String([fields[k].a].flat()[0]);
          x.classList.remove('wrong');
          x.classList.add(res[k] ? 'right' : 'shown');
        });
        ctx.feedback('bad', t(L, 'notQuite'), show(fields));
        done({ given, expected: show(fields), q: it.q || it.say || task.q });
      }
    }
    ctx.setAction(t(L, 'check'), check, { disabled: true });
  });
}

function show(fields) {
  return fields
    .map((f) => {
      const a = String([f.a].flat()[0]);
      const v = /^\d{4,}$/.test(a) ? fmtNum(a) : a;
      return (f.label ? f.label + ': ' : '') + v + (f.suffix ? ' ' + f.suffix : '');
    })
    .join('; ');
}
