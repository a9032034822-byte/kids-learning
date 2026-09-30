// Стихотворение недели: текст, словарик и заучивание по дням.
//   read    — вт: прочитать и разобрать слова;
//   part    — ср: первые строки (4–8), потом «проверь себя»;
//   hints   — чт: целиком с подсказками (первые буквы слов);
//   nohints — пт: без подсказок, строку можно подсмотреть; родитель подтверждает.
import { h } from '../util.js';
import { t } from '../i18n.js';

const STAGES = ['read', 'part', 'hints', 'nohints'];
const STAGE_KEY = { read: 'poemRead', part: 'poemPart', hints: 'poemHints', nohints: 'poemNoHints' };

function glossRegex(gloss) {
  const parts = gloss.map(([w]) => {
    const words = w.toLowerCase().split(/\s+/);
    if (words.length > 1) return words.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const s = words[0];
    const stem = s.length > 6 ? s.slice(0, -2) : s.length > 3 ? s.slice(0, -1) : s;
    return stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\p{L}*';
  });
  return parts.length ? new RegExp(`(?<!\\p{L})(${parts.join('|')})`, 'giu') : null;
}

function hintLine(line) {
  let first = true;
  return line.replace(/[\p{L}ё]+/gu, (w) => {
    if (first) {
      first = false;
      return w;
    }
    return w.length <= 2 ? w : w[0] + '…';
  });
}

export function mount(el, task, ctx) {
  const L = ctx.lang;
  const poem = task.poem || ctx.poem;
  if (!poem) {
    ctx.finish({ errors: 0 });
    return;
  }
  const lines = [];
  poem.stanzas.forEach((st, si) => st.forEach((ln, li) => lines.push({ ln, br: li === st.length - 1 && si < poem.stanzas.length - 1 })));
  const gloss = poem.glossary || [];
  const re = glossRegex(gloss);
  let stage = STAGES.includes(task.stage) ? task.stage : 'read';
  let testMode = false;
  let peeks = 0;
  const revealed = new Set();

  const head = h(
    'div',
    { class: 'poem-head' },
    h('div', { class: 'poem-title' }, poem.title),
    h('div', { class: 'poem-author' }, poem.author),
    h('button', { class: 'btn-say', type: 'button', onclick: () => ctx.speak(lines.map((x) => x.ln).join('\n'), L, 0.8) }, '🔊 ', t(L, 'listen'))
  );
  const tabs = h('div', { class: 'poem-tabs' });
  const sheet = h('div', { class: 'poem-sheet', lang: L });
  const glossBox = h('div', { class: 'poem-gloss' });
  const meaning = h('div', { class: 'gloss-meaning', hidden: true });
  el.append(head, tabs, sheet, meaning, glossBox);

  function showMeaning(word) {
    const low = word.toLowerCase();
    const hit = gloss.find(([w]) => {
      const s = w.toLowerCase();
      return low.startsWith(s.length > 6 ? s.slice(0, -2) : s.length > 3 ? s.slice(0, -1) : s) || low.replace(/\s+/g, ' ') === s;
    });
    if (!hit) return;
    meaning.hidden = false;
    meaning.replaceChildren(h('b', {}, hit[0]), ' — ', hit[1]);
    ctx.speak(hit[0] + ' — ' + hit[1], L);
  }

  function lineNodes(text) {
    if (!re) return [text];
    const out = [];
    let last = 0;
    text.replace(re, (m, g, idx) => {
      if (idx > last) out.push(text.slice(last, idx));
      out.push(h('button', { type: 'button', class: 'gloss', onclick: (e) => (e.stopPropagation(), showMeaning(m)) }, m));
      last = idx + m.length;
      return m;
    });
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  function renderTabs() {
    tabs.replaceChildren(
      ...STAGES.map((s) =>
        h(
          'button',
          {
            type: 'button',
            class: 'poem-tab' + (s === stage ? ' active' : ''),
            onclick: () => {
              stage = s;
              testMode = false;
              revealed.clear();
              render();
            },
          },
          t(L, STAGE_KEY[s])
        )
      )
    );
  }

  function render() {
    renderTabs();
    sheet.replaceChildren();
    const n = stage === 'part' ? Math.min(task.lines || 8, lines.length) : lines.length;
    if (stage === 'part') {
      sheet.append(
        h(
          'div',
          { class: 'poem-switch' },
          h('button', { type: 'button', class: 'chip' + (!testMode ? ' active' : ''), onclick: () => ((testMode = false), revealed.clear(), render()) }, t(L, 'poemLearn')),
          h('button', { type: 'button', class: 'chip' + (testMode ? ' active' : ''), onclick: () => ((testMode = true), revealed.clear(), render()) }, t(L, 'poemTest'))
        )
      );
    }
    if (stage === 'nohints' || (stage === 'part' && testMode) || stage === 'hints') sheet.append(h('p', { class: 'hint-line' }, '👆 ' + t(L, 'poemPeek')));
    for (let i = 0; i < n; i++) {
      const { ln, br } = lines[i];
      const hidden = (stage === 'nohints' || (stage === 'part' && testMode)) && !revealed.has(i);
      const hinted = stage === 'hints' && !revealed.has(i);
      const row = h(
        'div',
        {
          class: 'poem-line' + (hidden ? ' hidden-line' : '') + (br ? ' stanza-end' : ''),
          onclick: () => {
            if (hidden || hinted) {
              revealed.add(i);
              if (stage === 'nohints') peeks++;
              render();
              if (stage === 'hints') setTimeout(() => (revealed.delete(i), render()), 2500);
            } else ctx.speak(ln, L, 0.8);
          },
        },
        hidden ? h('span', { class: 'line-bar' }, String(i + 1)) : hinted ? hintLine(ln) : lineNodes(ln)
      );
      sheet.append(row);
    }
    glossBox.replaceChildren();
    if (gloss.length && (stage === 'read' || stage === 'part')) {
      glossBox.append(
        h('div', { class: 'gloss-title' }, '📖 ' + t(L, 'glossary')),
        ...gloss.map(([w, m]) => h('div', { class: 'gloss-row' }, h('b', {}, w), ' — ', m))
      );
    }
    const label = stage === 'nohints' ? t(L, 'recited', ctx.gender) : stage === 'read' ? t(L, 'iRead', ctx.gender) : t(L, 'done');
    ctx.setAction(label + ' ✓', () => ctx.finish({ errors: 0, extra: stage === 'nohints' ? { peeks } : undefined }));
  }
  render();
}
