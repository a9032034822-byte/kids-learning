// Небольшой безопасный рендер Markdown (заголовки, абзацы, списки, таблицы,
// **жирный**, *курсив*, ссылки http/https). Любой HTML во входе экранируется.

import { esc } from './util.js';

export function inline(src) {
  const ph = [];
  let s = String(src).replace(/\\([\\`*_{}\[\]()#+\-.!|~<>])/g, (m, c) => {
    ph.push(esc(c));
    return `\u0000${ph.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => ph[+i]);
  return s;
}

function renderTable(rows) {
  const cells = rows.map((r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  const body = cells.filter((r) => !r.every((c) => c === '' || /^:?-+:?$/.test(c)));
  if (!body.length) return '';
  const isHead = (r) => r.every((c) => c === '' || /^\*\*.*\*\*$/.test(c));
  let html = '<div class="md-table"><table>';
  body.forEach((r, i) => {
    const head = i === 0 && isHead(r);
    html += '<tr>' + r.map((c) => (head ? `<th>${inline(c.replace(/^\*\*|\*\*$/g, ''))}</th>` : `<td>${inline(c)}</td>`)).join('') + '</tr>';
  });
  return html + '</table></div>';
}

export function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    para = [];
  };
  const flushList = () => {
    if (list) {
      const start = list.type === 'ol' && list.start !== 1 ? ` start="${list.start}"` : '';
      out.push(`<${list.type}${start}>` + list.items.map((x) => `<li>${inline(x)}</li>`).join('') + `</${list.type}>`);
    }
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let m;
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara();
      flushList();
      const lvl = Math.min(6, m[1].length + 1); // # документа → h2, h1 оставляем экрану
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      continue;
    }
    if (line.startsWith('|')) {
      flushPara();
      flushList();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++].trim());
      i--;
      out.push(renderTable(rows));
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushPara();
      flushList();
      out.push('<hr>');
      continue;
    }
    if ((m = line.match(/^(\d+)\\?\.\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [], start: +m[1] };
      }
      list.items.push(m[2]);
      continue;
    }
    if ((m = line.match(/^[-•]\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(m[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join('\n');
}
