// Мелкие помощники: построение DOM, даты, сравнение ответов.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v; // только для доверенной разметки: SVG персонажей и вывод renderMarkdown
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const c of [kids].flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- даты (всё в местном времени устройства, формат ГГГГ-ММ-ДД) ----------

const pad = (n) => String(n).padStart(2, '0');

export function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function weekday(s) {
  return parseISO(s).getDay(); // 0 — воскресенье
}

export function mondayOf(s) {
  const wd = weekday(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

/** «Сегодня». Для проверки можно подменить: ?today=2026-09-30 */
export function todayISO() {
  try {
    const q = new URLSearchParams(location.search).get('today');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  } catch {}
  return iso(new Date());
}

export function inHolidays(date, holidays) {
  return (holidays || []).some((hd) => hd.from && date >= hd.from && (!hd.to || date <= hd.to));
}

// ---------- сравнение ответов ----------

export function normNumber(s) {
  return String(s).replace(/[\s   ]/g, '').replace(/^\+/, '').replace(/[−–]/g, '-');
}

export function normText(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»“”"„]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.,!?;:]+|[.,!?;:]+$/g, '')
    .trim();
}

export function normExact(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

export function matches(given, accepted, mode) {
  const f = mode === 'number' ? normNumber : mode === 'exact' ? normExact : normText;
  const g = f(given);
  if (!g) return false;
  return [accepted].flat().some((a) => f(a) === g);
}

export function shuffle(arr, seed) {
  const a = arr.slice();
  let s = seed || Math.floor(Math.random() * 1e9);
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function fmtNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
