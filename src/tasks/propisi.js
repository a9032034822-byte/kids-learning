// Прописи на экране: строка образца на косой линейке, под ней пустая линейка — ребёнок пишет пером.
// Штрихи — в логических координатах строки (W×H), не в пикселях: поворот экрана ничего не портит.
// Если на устройстве хоть раз было перо (pointerType "pen"), палец и ладонь не рисуют.
import { h } from '../util.js';
import { t } from '../i18n.js';
import * as store from '../store.js';
import { plan, getPos, setPos } from '../propisi.js';

export const W = 1000;
export const H = 184;
const TOP = 64; // верх строчной буквы
const BASE = 128; // низ строчной буквы
const XH = BASE - TOP;
const SLANT = Math.tan((14 * Math.PI) / 180); // наклон письма
const RULE_DX = H / Math.tan((65 * Math.PI) / 180); // наклонные линии линейки — 65°
const MARGIN = 24;
const DASH = '—';
const DASH_W = 1.6 * XH;
const GAP = 0.8 * XH;
const GAP_MIN = 0.3 * XH;
const FONT = '"Bad Script"';
const INK = '#1d3d8f';

let fontP = null;
export function fontReady() {
  if (!fontP) fontP = document.fonts && document.fonts.load ? document.fonts.load(`64px ${FONT}`, 'Аа').catch(() => {}) : Promise.resolve();
  return fontP;
}

let FS = 0;
let meter = null;
function measure(tok) {
  if (!meter) meter = document.createElement('canvas').getContext('2d');
  if (!FS) {
    meter.font = `100px ${FONT}`;
    const m = meter.measureText('хо');
    FS = Math.round((XH * 100) / (m.actualBoundingBoxAscent || 45));
    meter.font = `${FS}px ${FONT}`;
  }
  return tok === DASH ? DASH_W : meter.measureText(tok).width;
}

/** Строки образца: сначала уменьшаем промежутки, не помогло — переносим остаток на следующую строку. */
function fit(tokens) {
  const avail = W - 2 * MARGIN - SLANT * XH * 1.6;
  const ws = tokens.map(measure);
  const sum = (a, b) => ws.slice(a, b).reduce((s, w) => s + w, 0);
  const n = tokens.length;
  if (sum(0, n) + (n - 1) * GAP_MIN <= avail) return [{ tok: tokens, g: n > 1 ? Math.min(GAP, (avail - sum(0, n)) / (n - 1)) : GAP }];
  const out = [];
  let start = 0;
  while (start < n) {
    let end = start + 1;
    while (end < n && sum(start, end + 1) + (end - start) * GAP <= avail) end++;
    if (end < n && tokens[end - 1] === DASH && end - 1 > start) end--; // черта не остаётся в конце строки
    out.push({ tok: tokens.slice(start, end), g: GAP });
    start = end;
  }
  return out;
}

/** Лист заданий: [{tok, g, blanks}] — строка образца и сколько под ней пустых линеек. */
export function sheet(p) {
  const rows = [];
  fit(p.letters).forEach((l) => rows.push({ ...l, blanks: 1 }));
  for (const r of p.rows) fit([...r.syl, ...(r.rep.length ? [DASH, ...r.rep] : [])]).forEach((l) => rows.push({ ...l, blanks: r.blanks }));
  return rows.map((r) => ({ ...r, g: Math.round(r.g) }));
}

function ruling(c) {
  c.clearRect(0, 0, W, H);
  c.lineWidth = 1;
  c.strokeStyle = '#d6e1f2';
  c.beginPath();
  for (let x = -RULE_DX; x < W; x += 110) {
    c.moveTo(x, H);
    c.lineTo(x + RULE_DX, 0);
  }
  c.stroke();
  c.lineWidth = 1.6;
  c.strokeStyle = '#8fa9d4';
  c.beginPath();
  c.moveTo(0, TOP);
  c.lineTo(W, TOP);
  c.moveTo(0, BASE);
  c.lineTo(W, BASE);
  c.stroke();
}

function drawSample(c, row) {
  ruling(c);
  measure('');
  c.fillStyle = '#2b2b2b';
  c.font = `${FS}px ${FONT}`;
  let x = MARGIN;
  for (const tok of row.tok) {
    const w = measure(tok);
    if (tok === DASH) {
      c.save();
      c.setLineDash([8, 9]);
      c.lineWidth = 3;
      c.strokeStyle = '#7a7a7a';
      c.beginPath();
      c.moveTo(x, BASE - XH / 2);
      c.lineTo(x + w, BASE - XH / 2);
      c.stroke();
      c.restore();
    } else {
      c.save();
      c.translate(x, BASE);
      c.transform(1, 0, -SLANT, 1, 0, 0);
      c.fillText(tok, 0, 0);
      c.restore();
    }
    x += w + row.g;
  }
}

const widthOf = (p) => (p ? 2.2 + p * 0.45 : 4.5);

/** Штрих — плоский массив [x, y, p, x, y, p, …]; p — нажим 1…10 или 0 (нет данных). */
export function drawStroke(c, s, from = 0) {
  c.strokeStyle = INK;
  c.fillStyle = INK;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (s.length <= 3) {
    c.beginPath();
    c.arc(s[0], s[1], widthOf(s[2]) / 2, 0, Math.PI * 2);
    c.fill();
    return;
  }
  for (let i = Math.max(3, from); i < s.length; i += 3) {
    c.lineWidth = widthOf(s[i + 2]);
    c.beginPath();
    c.moveTo(s[i - 3], s[i - 2]);
    c.lineTo(s[i], s[i + 1]);
    c.stroke();
  }
}

/** Холст в логических координатах: при смене размера перерисовывается через paint(c). */
function lineCanvas(cls, paint, ro) {
  const cv = h('canvas', { class: 'pz-line ' + cls });
  cv._paint = () => {
    const w = cv.clientWidth;
    if (!w) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(((w * H) / W) * dpr);
    const c = cv.getContext('2d');
    c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    paint(c);
  };
  ro.observe(cv);
  return cv;
}

/**
 * Лист: строки образца, под каждой — пустые линейки со штрихами lines[k].
 * opts.onDown(cv, k) — делает линейку k доступной для письма.
 */
export function renderSheet(rows, lines, opts = {}) {
  const ro = new ResizeObserver((es) => es.forEach((e) => e.target._paint && e.target._paint()));
  const box = h('div', { class: 'pz-sheet' });
  const canvases = [];
  let k = 0;
  for (const row of rows) {
    box.append(lineCanvas('pz-sample', (c) => drawSample(c, row), ro));
    for (let b = 0; b < row.blanks; b++, k++) {
      const li = k;
      if (!lines[li]) lines[li] = [];
      const cv = lineCanvas('pz-blank', (c) => (ruling(c), lines[li].forEach((s) => drawStroke(c, s))), ro);
      canvases.push(cv);
      if (opts.writable) opts.writable(cv, li);
      box.append(cv);
    }
  }
  box._repaint = () => canvases.forEach((cv) => cv._paint());
  return box;
}

let penSeen = null;

export function mount(el, task, ctx) {
  const L = ctx.lang;
  const rec = store.taskRec(ctx.kidId, ctx.weekId, task.id);
  const again = !!(rec && rec.done);
  const pos = again && rec.extra && Number.isInteger(rec.extra.pos) ? rec.extra.pos : getPos(ctx.kidId, task.kind);
  const p = plan(task.kind, pos);
  if (!p) {
    el.append(h('div', { class: 'offline-card' }, h('div', { class: 'offline-icon' }, '🎉'), h('div', { class: 'offline-q' }, t(L, 'propisiEnd'))));
    ctx.setAction(t(L, 'next'), () => ctx.finish({ errors: 0 }));
    return;
  }
  if (penSeen === null) penSeen = !!store.local('penSeen');
  const lines = [];
  const history = [];
  let sent = false;

  const any = () => history.length > 0;
  const action = () =>
    ctx.setAction(t(L, 'done') + ' ✓', () => {
      if (sent || !any()) return;
      sent = true;
      if (!again) setPos(ctx.kidId, task.kind, pos + 1);
      ctx.feedback('info', '👀 ' + t(L, 'waitParent'));
      setTimeout(() => ctx.finish({ errors: 0, extra: { pos } }), 1200);
    }, { disabled: !any() });

  const writable = (cv, li) => {
    let cur = null;
    let id = null;
    let rect = null;
    let c = null;
    const pt = (e) => [
      Math.max(0, Math.min(W, Math.round(((e.clientX - rect.left) * W) / rect.width))),
      Math.max(0, Math.min(H, Math.round(((e.clientY - rect.top) * H) / rect.height))),
      e.pointerType === 'pen' && e.pressure > 0 ? Math.max(1, Math.round(e.pressure * 10)) : 0,
    ];
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'pen' && !penSeen) {
        penSeen = true;
        store.local('penSeen', true);
      }
      if ((penSeen && e.pointerType !== 'pen') || id !== null) return;
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {}
      id = e.pointerId;
      rect = cv.getBoundingClientRect();
      c = cv.getContext('2d');
      cur = pt(e);
      lines[li].push(cur);
      history.push(li);
      drawStroke(c, cur);
      if (history.length === 1) action();
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      e.preventDefault();
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      for (const ev of evs.length ? evs : [e]) {
        const q = pt(ev);
        const n = cur.length;
        const dx = q[0] - cur[n - 3];
        const dy = q[1] - cur[n - 2];
        if (dx * dx + dy * dy < 2.25) continue; // прореживание: ближе 1,5 единицы — не пишем
        cur.push(...q);
        drawStroke(c, cur, cur.length - 3);
      }
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      cur = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  };

  const box = h('div', { class: 'propisi' }, h('div', { class: 'pz-loading' }, '…'));
  const undo = h('button', { type: 'button', class: 'btn-soft' }, '↶ ', t(L, 'eraseLast'));
  const wipe = h('button', { type: 'button', class: 'btn-soft' }, '🗑 ', t(L, 'eraseAll'));
  el.append(
    h('div', { class: 'pz-head' }, h('div', { class: 'offline-kicker' }, '✍️ ', t(L, 'propisi'), ' · ', p.letters.join('  ')), h('div', { class: 'pz-hint' }, t(L, 'propisiHint'))),
    h('div', { class: 'pz-tools' }, undo, wipe),
    box
  );
  action();
  fontReady().then(() => {
    const sh = renderSheet(sheet(p), lines, { writable });
    box.replaceChildren(sh);
    undo.onclick = () => {
      const li = history.pop();
      if (li == null) return;
      lines[li].pop();
      sh._repaint();
      if (!any()) action();
    };
    wipe.onclick = () => {
      if (!any() || !confirm(t(L, 'eraseAllQ'))) return;
      lines.forEach((l) => (l.length = 0));
      history.length = 0;
      sh._repaint();
      action();
    };
  });
}
