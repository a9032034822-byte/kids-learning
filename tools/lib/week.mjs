// Разбор исходников недели: week.json (задания, написанные по docs/CONTENT_FORMAT.md)
// + тексты документов Google Drive в src/*.md (страницы распечатки и уроки для родителя).
// Всё здесь — открытый текст; он живёт только в .work/ и в репозиторий не попадает.

import fs from 'node:fs';
import path from 'node:path';

export class BuildError extends Error {}

const SUBJECTS = new Set(['ru', 'lit', 'math', 'en', 'sci', 'logic', 'fr', 'other']);
const TYPES = new Set(['rule', 'choice', 'input', 'fix', 'split', 'stress', 'column', 'sort', 'read', 'poem', 'offline', 'page']);
const STAGES = new Set(['read', 'part', 'hints', 'nohints']);
const COMPANIONS = new Set(['panda', 'capybara', 'bear']);

/** Экспорт Google Docs экранирует знаки (\_ \[ \!), в таблицах — дважды. Снимаем экранирование. */
export function normalizeMd(s) {
  let out = String(s).replace(/\r/g, '').replace(/ /g, ' ');
  for (let k = 0; k < 3; k++) out = out.replace(/\\([\\`*_{}\[\]()#+\-.!~<>=])/g, '$1');
  return out
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractPages(md) {
  const text = normalizeMd(md);
  const re = /^—\s*стр\.\s*(\d+)\s*—\s*$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(text))) marks.push({ n: +m[1], start: m.index, end: m.index + m[0].length });
  return marks.map((mk, i) => ({ n: mk.n, md: text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : text.length).trim() }));
}

const core = (s) => String(s).trim().replace(/^[«"“(]+/, '').replace(/[.,!?;:»"”)]+$/, '');
const unq = (s) => String(s).trim().replace(/^[«"“]+|[»"”]+$/g, '').trim();

function wordRe(opt) {
  const e = unq(opt).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${e}(?![\\p{L}\\p{N}])`, 'u');
}

export function parseRule(task, warn) {
  const out = { ...task };
  const see = String(task.see || '');
  const m = see.match(/\(([^()]*?\s\/\s[^()]*?)\)/);
  if (m && !task.options) {
    out.options = m[1].split(/\s\/\s/).map((x) => unq(x));
    out.seeBefore = see.slice(0, m.index);
    out.seeAfter = see.slice(m.index + m[0].length);
  } else if (task.options) {
    const idx = m ? m.index : -1;
    out.seeBefore = idx >= 0 ? see.slice(0, idx) : see + ' ';
    out.seeAfter = idx >= 0 ? see.slice(idx + m[0].length) : '';
  }
  if (out.options) {
    if (typeof out.answer === 'string') out.answer = out.options.indexOf(out.answer);
    if (typeof out.answer !== 'number' || out.answer < 0) {
      const w = String(task.write || '');
      const hits = out.options.map((o) => {
        const r = wordRe(o).exec(w);
        return r ? r.index : -1;
      });
      const found = hits.map((p, i) => [p, i]).filter(([p]) => p >= 0).sort((a, b) => a[0] - b[0]);
      if (!found.length) throw new BuildError(`правило «${task.name}»: не понял, какой вариант верный — укажите "answer"`);
      if (found.length > 1) warn(`правило «${task.name}»: оба варианта есть в «Пишешь», выбран первый по тексту — «${out.options[found[0][1]]}»`);
      out.answer = found[0][1];
    }
  }
  return out;
}

function parseExpr(s) {
  if (typeof s === 'object') return { a: String(s.a).replace(/\D/g, ''), op: s.op, b: String(s.b).replace(/\D/g, '') };
  const m = String(s).match(/^\s*([\d\s ]+?)\s*([+\-−×x*:÷])\s*([\d\s ]+?)\s*$/);
  if (!m) throw new BuildError(`пример «${s}» не разобран (нужно «125 + 348»)`);
  const op = { '-': '−', x: '×', '*': '×', '÷': ':' }[m[2]] || m[2];
  return { a: m[1].replace(/\D/g, ''), op, b: m[3].replace(/\D/g, '') };
}

function calc({ a, op, b }) {
  const A = BigInt(a), B = BigInt(b);
  if (op === '+') return A + B;
  if (op === '−') {
    if (A < B) throw new BuildError(`${a} − ${b}: отрицательный ответ`);
    return A - B;
  }
  if (op === '×') return A * B;
  if (op === ':') {
    if (B === 0n || A % B !== 0n) throw new BuildError(`${a} : ${b} не делится нацело`);
    return A / B;
  }
  throw new BuildError('неизвестное действие ' + op);
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** id ролика из ссылки YouTube (watch?v=, youtu.be/, shorts/, embed/) или сам id. */
export function youtubeId(s) {
  const v = String(s || '').trim();
  if (YT_ID.test(v)) return v;
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
  return m ? m[1] : null;
}

/** "ID" | {youtube, title} | [...] → [{youtube, title}] */
export function normVideos(v, where) {
  return [v].flat().filter(Boolean).map((x) => {
    const o = typeof x === 'string' ? { youtube: x } : x;
    const id = youtubeId(o.youtube || o.url);
    if (!id) throw new BuildError(`${where}: ролик «${o.youtube || o.url || ''}» — нужна ссылка YouTube или id из 11 знаков`);
    return { youtube: id, title: String(o.title || '') };
  });
}

/** Ролики недели из videos.json (копия «ПРИЛОЖЕНИЕ_ролики (videos.json)»): {"weeks": {"N": ролик или список}}. */
function weekVideos(dir, week) {
  const file = path.join(dir, 'videos.json');
  if (!fs.existsSync(file)) return [];
  let src;
  try {
    src = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new BuildError(`videos.json — ошибка JSON: ${e.message}`);
  }
  const entry = Object.entries((src && src.weeks) || {}).find(([k]) => Number(k) === Number(week));
  return entry ? normVideos(entry[1], `videos.json, неделя ${week}`) : [];
}

const isSong = (lesson, t) => lesson.subject === 'fr' && t.type === 'offline' && t.icon === '🎵';

function normTask(raw, ctx, warn) {
  const t = { ...raw };
  const where = `${ctx.kid} ${ctx.date} «${ctx.lesson}» задание ${ctx.i + 1} (${t.type})`;
  const need = (cond, msg) => {
    if (!cond) throw new BuildError(`${where}: ${msg}`);
  };
  need(TYPES.has(t.type), 'неизвестный тип');
  switch (t.type) {
    case 'rule':
      need(t.name && t.see && t.write, 'нужны name, see, write');
      return parseRule(t, (m) => warn(`${where}: ${m}`));
    case 'choice': {
      const items = t.items || [{ q: t.q, options: t.options, answer: t.answer, why: t.why }];
      for (const it of items) {
        need(Array.isArray(it.options) && it.options.length >= 2, 'нужно ≥ 2 вариантов');
        if (typeof it.answer === 'string') it.answer = it.options.indexOf(it.answer);
        need(Number.isInteger(it.answer) && it.answer >= 0 && it.answer < it.options.length, 'answer — номер или текст верного варианта');
      }
      if (t.items) t.items = items;
      else Object.assign(t, items[0]);
      return t;
    }
    case 'input':
      need(Array.isArray(t.items) && t.items.length, 'нужны items');
      t.items.forEach((it, k) => need(it.a != null || (Array.isArray(it.fields) && it.fields.every((f) => f.a != null)), `пункт ${k + 1}: нет ответа (a)`));
      return t;
    case 'fix': {
      need(t.text && Array.isArray(t.mistakes) && t.mistakes.length, 'нужны text и mistakes');
      const tokens = t.text.split(/\s+/).filter(Boolean);
      const out = [];
      for (const m of t.mistakes) {
        const full = /[.,!?;:]/.test(m.wrong);
        const pos = tokens.map((tok, p) => ((full ? tok === m.wrong : core(tok) === m.wrong) ? p : -1)).filter((p) => p >= 0);
        need(pos.length, `ошибка «${m.wrong}» не найдена в тексте`);
        pos.forEach((p) => out.push({ pos: p, wrong: m.wrong, right: m.right, full }));
      }
      t.tokens = tokens;
      t.mistakes = out.sort((a, b) => a.pos - b.pos);
      return t;
    }
    case 'split': {
      need(t.answer, 'нужен answer (текст с точками)');
      const ans = t.answer.split(/\s+/).filter(Boolean);
      const words = (t.text ? t.text.split(/\s+/).filter(Boolean) : ans.map((w) => w.replace(/[.!?,]+$/, '').toLowerCase())).map((w) => w.replace(/[.!?]+$/, ''));
      need(words.length === ans.length, `в text ${words.length} слов, в answer ${ans.length}`);
      t.words = words;
      t.ends = ans.map((w, i) => (/[.!?]$/.test(w) ? i : -1)).filter((i) => i >= 0);
      need(t.ends.includes(ans.length - 1), 'answer должен кончаться точкой');
      return t;
    }
    case 'stress':
      need(Array.isArray(t.words) && t.words.length, 'нужны words');
      t.words = t.words.map((w) => {
        if (typeof w === 'object') return w;
        const chars = [...w];
        const mark = chars.indexOf('́');
        if (mark > 0) return { w: chars.filter((c) => c !== '́').join(''), s: mark - 1 };
        const yo = chars.findIndex((c) => c === 'ё' || c === 'Ё');
        need(yo >= 0, `в слове «${w}» не отмечено ударение (знак ◌́ после гласной)`);
        return { w, s: yo };
      });
      return t;
    case 'column':
      need(Array.isArray(t.items) && t.items.length, 'нужны items');
      t.items = t.items.map((x) => {
        const e = parseExpr(x);
        try {
          return { ...e, r: calc(e).toString() };
        } catch (err) {
          throw new BuildError(`${where}: ${err.message}`);
        }
      });
      return t;
    case 'sort':
      need(Array.isArray(t.groups) && t.groups.length >= 2 && Array.isArray(t.items) && t.items.length, 'нужны groups и items');
      t.items = t.items.map((x) => (Array.isArray(x) ? { t: x[0], g: x[1], br: x[2] === 'br' || undefined } : x));
      t.items.forEach((x) => need(t.groups.includes(x.g), `«${x.t}»: группы «${x.g}» нет в groups`));
      return t;
    case 'read':
      need((Array.isArray(t.cards) && t.cards.length) || (Array.isArray(t.grid) && t.grid.length), 'нужны cards или grid');
      return t;
    case 'poem':
      need(STAGES.has(t.stage), 'stage: read | part | hints | nohints');
      need(ctx.hasPoem, 'у ребёнка нет poem');
      return t;
    case 'offline':
      need(t.q, 'нужен q — что сделать');
      if (t.video) t.video = normVideos(t.video, where);
      return t;
    case 'page':
      need(t.page != null, 'нужен page');
      [t.page].flat().forEach((n) => need(ctx.pages.has(n), `страницы ${n} нет в распечатке`));
      return t;
  }
  return t;
}

function findSrc(dir, kind, key) {
  const srcDir = path.join(dir, 'src');
  if (!fs.existsSync(srcDir)) return null;
  const files = fs.readdirSync(srcDir).filter((f) => f.normalize('NFC').toUpperCase().includes(kind) && f.normalize('NFC').toUpperCase().includes(key.toUpperCase()));
  return files.length ? path.join(srcDir, files[0]) : null;
}

/** Читает и проверяет неделю. Возвращает {week, family, warnings}. Бросает BuildError. */
export function loadWeekSource(dir) {
  const file = path.join(dir, 'week.json');
  if (!fs.existsSync(file)) throw new BuildError(`нет ${file}`);
  let src;
  try {
    src = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new BuildError(`week.json — ошибка JSON: ${e.message}`);
  }
  const warnings = [];
  const warn = (m) => warnings.push(m);
  for (const k of ['week', 'from', 'to']) if (src[k] == null) throw new BuildError(`week.json: нет поля ${k}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src.from) || !/^\d{4}-\d{2}-\d{2}$/.test(src.to)) throw new BuildError('from/to — даты ГГГГ-ММ-ДД');
  const kids = {};
  for (const [key, kid] of Object.entries(src.kids || {})) {
    const printout = kid.printout ? path.join(dir, kid.printout) : findSrc(dir, 'РАСПЕЧАТКА', key);
    const lessons = kid.lessonsDoc ? path.join(dir, kid.lessonsDoc) : findSrc(dir, 'УРОКИ', key);
    const pages = printout && fs.existsSync(printout) ? extractPages(fs.readFileSync(printout, 'utf8')) : [];
    if (!pages.length) warn(`${key}: страницы распечатки не найдены (src/*РАСПЕЧАТКА*${key}*.md)`);
    const lessonsMd = lessons && fs.existsSync(lessons) ? normalizeMd(fs.readFileSync(lessons, 'utf8')) : '';
    if (!lessonsMd) warn(`${key}: файл уроков для родителя не найден (src/*УРОКИ*${key}*.md)`);
    const pageSet = new Set(pages.map((p) => p.n));
    const usedPages = new Set();
    const days = (kid.days || []).map((day) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new BuildError(`${key}: дата дня «${day.date}»`);
      if (day.date < src.from || day.date > src.to) warn(`${key}: день ${day.date} вне недели ${src.from}–${src.to}`);
      return {
        date: day.date,
        title: day.title,
        lessons: (day.lessons || []).map((l, li) => {
          const subject = l.subject || day.subject || 'other';
          if (!SUBJECTS.has(subject)) throw new BuildError(`${key} ${day.date}: предмет «${subject}»`);
          const lessonId = `${day.date}-${li + 1}`;
          return {
            id: lessonId,
            time: l.time,
            title: l.title,
            subject,
            tag: l.tag,
            tasks: (l.tasks || []).map((tk, ti) => {
              const n = normTask(tk, { kid: key, date: day.date, lesson: l.title, i: ti, pages: pageSet, hasPoem: !!kid.poem }, warn);
              n.id = tk.id || `${lessonId}-${ti + 1}`;
              [n.page].flat().filter(Boolean).forEach((p) => usedPages.add(p));
              return n;
            }),
          };
        }),
      };
    });
    days.sort((a, b) => (a.date < b.date ? -1 : 1));
    const ids = new Set();
    days.forEach((d) => d.lessons.forEach((l) => l.tasks.forEach((t) => {
      if (ids.has(t.id)) throw new BuildError(`${key}: повтор id задания ${t.id}`);
      ids.add(t.id);
    })));
    const unused = [...pageSet].filter((p) => !usedPages.has(p));
    if (unused.length) warn(`${key}: страницы ${unused.join(', ')} не привязаны ни к одному заданию (видны в «Страницах распечатки»)`);
    if (kid.poem) {
      const p = kid.poem;
      if (!p.title || !Array.isArray(p.stanzas) || !p.stanzas.length) throw new BuildError(`${key}: poem — нужны title и stanzas`);
    }
    kids[key] = { key, poem: kid.poem || null, days, pages, lessonsMd };
  }
  if (!Object.keys(kids).length) throw new BuildError('week.json: нет kids');
  // Ролики к песням недели: задания offline с icon 🎵 в уроках французского, если у задания нет своего video.
  const vids = weekVideos(dir, src.week);
  if (vids.length) {
    let songs = 0;
    for (const kid of Object.values(kids))
      kid.days.forEach((d) => d.lessons.forEach((l) => l.tasks.forEach((t) => {
        if (isSong(l, t) && !t.video) {
          t.video = vids;
          songs++;
        }
      })));
    if (!songs) warn(`videos.json: ролики недели ${src.week} не к чему привязать — нет заданий offline с icon «🎵» во французском`);
  }
  // Профили детей: family.json рядом с week.json (копия «ПРИЛОЖЕНИЕ_семья (family.json)» с Drive) главнее поля family в week.json.
  let family = src.family || null;
  const famFile = path.join(dir, 'family.json');
  if (fs.existsSync(famFile)) {
    try {
      family = JSON.parse(fs.readFileSync(famFile, 'utf8'));
    } catch (e) {
      throw new BuildError(`family.json — ошибка JSON: ${e.message}`);
    }
  }
  for (const k of (family && family.kids) || []) {
    if (!k.key || !k.name) throw new BuildError('family: у каждого ребёнка нужны key и name');
    if (k.companion && !COMPANIONS.has(k.companion)) throw new BuildError(`family: персонаж «${k.companion}» — нужен panda, capybara или bear`);
  }
  return {
    week: { id: src.from, week: src.week, from: src.from, to: src.to, title: src.title || `Неделя ${src.week}`, kids },
    family,
    warnings,
  };
}

export function summarize(week) {
  const lines = [];
  for (const kid of Object.values(week.kids)) {
    const tasks = kid.days.flatMap((d) => d.lessons.flatMap((l) => l.tasks));
    const byType = {};
    tasks.forEach((t) => (byType[t.type] = (byType[t.type] || 0) + 1));
    const videos = new Set(tasks.flatMap((t) => (t.video || []).map((v) => v.youtube)));
    lines.push(
      `  ${kid.key.slice(0, 1)}…: дней ${kid.days.length}, уроков ${kid.days.reduce((s, d) => s + d.lessons.length, 0)}, заданий ${tasks.length} (` +
        Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ') +
        `), страниц ${kid.pages.length}, уроки для родителя: ${kid.lessonsMd ? 'есть' : 'НЕТ'}, стих: ${kid.poem ? 'есть' : 'нет'}, роликов: ${videos.size}`
    );
  }
  return lines.join('\n');
}
