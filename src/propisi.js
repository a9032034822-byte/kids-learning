// Прописи: очередь букв зашита здесь, в недельном контенте их нет.
// Задание «Прописи» добавляется последним уроком в каждый учебный день (кроме каникул).
// Позиция в очереди у каждого ребёнка своя: слот прогресса ребёнка, ключ 'pz'.
// Один учебный день — одна позиция; сдвиг только после «Готово».

import * as store from './store.js';
import { inHolidays } from './util.js';

const SASHA = `А: ма на ра ла ам ан ар
Б: ба бо бу бы би бе бя
В: ва во ву вы ви ве вя
Г: га го гу ги ге аг ог
Д: да до ду ды ди де дя
Е: бе де зе ме не ре ел
Ё: бё дё зё мё нё рё ёж
Ж: жа жо жу жи же аж уж
З: за зо зу зы зи зе зя
И: ми ни ри ли им ин ир
Й: ай ой уй ей ий эй ый
К: ка ко ку ки ке ак ок
Л: ла ло лу лы ли ле ля
М: ма мо му мы ми ме мя
Н: на но ну ны ни не ня
О: мо но ро ло ом он ор
П: па по пу пы пи пе пя
Р: ра ро ру ры ри ре ря
С: са со су сы си се ся
Т: та то ту ты ти те тя
У: му ну ру лу ум ун ур
Ф: фа фо фу фы фи фе аф
Х: ха хо ху хи хе ах ох
Ц: ца цо цу цы ци це ац
Ч: ча чу чи че чё ач оч
Ш: ша шо шу ши ше аш уш
Щ: ща щу щи ще щё ащ ещ
Ъ: съе съё въе объ подъ отъ изъ
Ы: мы ны ры лы бы ды зы
Ь: ль нь рь мь дь зь бь
Э: эм эн эр эл эх эй эт
Ю: бю дю зю мю ню рю юг
Я: бя дя зя мя ня ря ям`;

const LIZA = `А Б: ба бо бу бы би бе бя бю бё аб об уб
В Г: ва во ву вы ви ве вя га го гу ги ге
Д Е: да до ду ды ди дя дю де бе ве ге ед
Ё Ж: жа жо жу жи же жё бё вё дё аж уж ёж
З И: за зо зу зы зе зя зи би ви ги ди жи
Й К: ка ко ку ки ке ак ок ай ой уй ей ий
Л М: ла ло лу лы ли ле ля ма мо му мы ми
Н О: на но ну ны ни не ня он ом ол ок ой
П Р: па по пу пы пи пе ра ро ру ры ри ре
С Т: са со су сы си се та то ту ты ти те
У Ф: фа фо фу фы фи фе ум ун ур ус ут уф
Х Ц: ха хо ху хи хе ах ца цо цу цы ци це
Ч Ш: ча чу чи че чё ач ша шу ши ше шё аш
Щ Ъ: ща щу щи ще щё ащ съе съё въе объ подъ отъ
Ы Ь: мы ны ры лы ты сы ль нь рь ть сь мь
Э Ю: эм эн эр эл эх эй лю ню рю тю сю юг
Я: ля ня ря тя ся мя бя вя дя зя ям як`;

const parse = (txt) =>
  txt.split('\n').map((line) => {
    const [l, s] = line.split(':');
    return { letters: l.trim().split(/\s+/), syl: s.trim().split(/\s+/) };
  });

export const QUEUES = { sasha: parse(SASHA), liza: parse(LIZA) };
export const START = { sasha: 0, liza: 4 };
const NO_CAP = new Set(['Ь', 'Ъ', 'Ы']);

/** «Заглавная строчная»; у Ь, Ъ, Ы — только строчная. */
export function pair(L) {
  return NO_CAP.has(L) ? L.toLowerCase() : `${L} ${L.toLowerCase()}`;
}

/** Чья очередь: по ключу или имени ребёнка из family.json. */
export function kindOf(kid) {
  const s = `${(kid && kid.key) || ''} ${(kid && kid.name) || ''}`.toUpperCase();
  if (/САШ|АЛЕКСАНДР|SASHA/.test(s)) return 'sasha';
  if (/ЛИЗ|ЕЛИЗАВЕТ|LIZA/.test(s)) return 'liza';
  return null;
}

/** Позиции для повторения: i−1 и i−5 (при i < 5 — i−2), если такие есть. */
export function repeatOf(i) {
  return [i - 1, i >= 5 ? i - 5 : i - 2].filter((j) => j >= 0);
}

/**
 * Задание для позиции i → {pos, letters: ['А а'], rows: [{syl, rep, blanks}]} или null.
 * rows — строки слогов; после пунктирной черты в той же строке образца — rep.
 */
export function plan(kind, i) {
  const q = QUEUES[kind];
  if (!q || i < 0 || i >= q.length) return null;
  const cur = q[i];
  const [r1, r2] = repeatOf(i);
  const letters = cur.letters.map(pair);
  if (kind === 'sasha') {
    const today = new Set(cur.syl);
    const pick = (j, fromEnd) => {
      const s = q[j].syl;
      let k = fromEnd ? s.length - 1 : 0;
      while (k >= 0 && k < s.length && today.has(s[k])) k += fromEnd ? -1 : 1;
      return s[k] || s[fromEnd ? s.length - 1 : 0];
    };
    const rep = [];
    if (r1 != null) rep.push(pair(q[r1].letters[0]), pick(r1, false));
    if (r2 != null) rep.push(pair(q[r2].letters[0]), pick(r2, true));
    return { pos: i, letters, rows: [{ syl: cur.syl, rep, blanks: 1 }] };
  }
  const half = Math.ceil(cur.syl.length / 2);
  const repOf = (j) => (j == null ? [] : q[j].letters.map(pair));
  return {
    pos: i,
    letters,
    rows: [
      { syl: cur.syl.slice(0, half), rep: repOf(r1), blanks: 2 },
      { syl: cur.syl.slice(half), rep: repOf(r2), blanks: 2 },
    ],
  };
}

// ---------- позиция в очереди ----------

export function getPos(kidId, kind) {
  const r = store.get(store.kidSlot(kidId), 'pz');
  return r && Number.isInteger(r.pos) ? r.pos : START[kind] || 0;
}

export function setPos(kidId, kind, pos) {
  const max = QUEUES[kind] ? QUEUES[kind].length : 0;
  store.put(store.kidSlot(kidId), 'pz', { pos: Math.max(0, Math.min(max, pos)) });
}

export const taskIdOf = (date) => 'propisi-' + date;

/**
 * Добавляет урок «Прописи» последним в учебные дни недели (кроме каникул).
 * Сегодня — пока очередь не кончилась; прошедшие дни — только если прописи в этот день уже сданы;
 * будущие — нет (позиция станет известна в свой день). Вызывать можно сколько угодно раз.
 */
export function inject(week, weekId, kids, holidays, today) {
  if (!week || !week.kids) return week;
  for (const kid of kids || []) {
    const kind = kindOf(kid);
    const wk = week.kids[kid.id];
    if (!wk || !wk.days) continue;
    for (const day of wk.days) {
      day.lessons = day.lessons.filter((l) => !String(l.id).startsWith('propisi-'));
      if (!kind || !day.lessons.length || inHolidays(day.date, holidays) || day.date > today) continue;
      const id = taskIdOf(day.date);
      const rec = store.taskRec(kid.id, weekId, id);
      if (!(rec && rec.done) && (day.date < today || getPos(kid.id, kind) >= QUEUES[kind].length)) continue;
      day.lessons.push({ id, subject: 'ru', title: 'Прописи', tasks: [{ id, type: 'propisi', title: 'Прописи', approve: true, kind, date: day.date }] });
    }
  }
  return week;
}
