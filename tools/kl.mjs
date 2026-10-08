#!/usr/bin/env node
// Сборщик контента «Лесной школы».
//
//   node tools/kl.mjs check  <папка недели>          — проверить исходники (пароль не нужен)
//   node tools/kl.mjs build  <папка недели> [--out content]
//                                                    — зашифровать неделю в content/ (нужен FAMILY_PASSWORD)
//   node tools/kl.mjs verify [--out content]         — расшифровать всё и проверить
//   node tools/kl.mjs list   [--out content]         — список недель
//   node tools/kl.mjs remove <id недели ГГГГ-ММ-ДД>   — убрать неделю
//   node tools/kl.mjs rekey                          — сменить пароль: OLD_FAMILY_PASSWORD → FAMILY_PASSWORD
//   node tools/kl.mjs check-shell                    — все ли файлы приложения есть в sw.js
//
// Папка недели (в .work/, вне git): week.json + family.json + src/*.md — тексты 4 документов с Google Drive.
// В вывод не печатается ничего из содержимого — только количества.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveMaster, importMaster, encryptJSON, decryptJSON, weekFileName, randomB64, KDF_ITERATIONS, MIN_PASSWORD_LENGTH } from '../src/crypto.js';
import { loadWeekSource, summarize, BuildError } from './lib/week.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = path.resolve(ROOT, opt('--out', 'content'));

const COLORS = ['#B388EB', '#4CC9F0', '#F4A261', '#06D6A0'];

function die(msg) {
  console.error('✖ ' + msg);
  process.exit(1);
}

function password(env = 'FAMILY_PASSWORD') {
  const pw = process.env[env];
  if (!pw) die(`переменная окружения ${env} не задана. Задайте её в настройках облачного окружения Claude Code (Environment → Variables) и перезапустите сессию.`);
  if (pw.length < MIN_PASSWORD_LENGTH) die(`${env} короче ${MIN_PASSWORD_LENGTH} символов`);
  return pw;
}

function readJSON(f) {
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeJSON(f, obj) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj) + '\n');
}

async function openContent(pw, { create = false } = {}) {
  const mf = path.join(OUT, 'manifest.json');
  let manifest = fs.existsSync(mf) ? readJSON(mf) : null;
  if (!manifest) {
    if (!create) die(`нет ${path.relative(ROOT, mf)} — контент ещё не собирался`);
    manifest = { v: 1, kdf: { alg: 'PBKDF2-SHA256', iter: KDF_ITERATIONS, salt: randomB64(16) }, files: [], updated: null };
  }
  const keys = await importMaster(await deriveMaster(pw, manifest.kdf));
  const idxFile = path.join(OUT, 'index.enc');
  let index = { v: 1, family: { kids: [] }, weeks: [] };
  if (fs.existsSync(idxFile)) {
    try {
      index = await decryptJSON(keys, readJSON(idxFile), 'index');
    } catch {
      die('FAMILY_PASSWORD не подходит к уже собранному контенту (content/index.enc). Для смены пароля — команда rekey.');
    }
  }
  return { manifest, keys, index };
}

async function save({ manifest, keys, index }) {
  index.updated = new Date().toISOString();
  writeJSON(path.join(OUT, 'index.enc'), await encryptJSON(keys, index, 'index'));
  manifest.files = ['index.enc', ...index.weeks.map((w) => w.file)];
  manifest.updated = index.updated;
  writeJSON(path.join(OUT, 'manifest.json'), manifest);
  // удалить осиротевшие файлы недель
  for (const f of fs.readdirSync(OUT)) if (/^w-[0-9a-f]+\.enc$/.test(f) && !manifest.files.includes(f)) fs.unlinkSync(path.join(OUT, f));
}

function mergeFamily(index, family, keysInWeek) {
  const kids = index.family.kids;
  const byKey = new Map(kids.map((k) => [k.key, k]));
  for (const f of (family && family.kids) || []) {
    const cur = byKey.get(f.key);
    if (cur) Object.assign(cur, f, { id: cur.id });
    else {
      const id = 'k' + (kids.length + 1);
      const k = { id, color: COLORS[kids.length % COLORS.length], uiLang: 'ru', gender: 'm', companion: kids.length % 2 ? 'capybara' : 'panda', ...f };
      k.id = id;
      kids.push(k);
      byKey.set(f.key, k);
    }
  }
  for (const key of keysInWeek) {
    if (byKey.has(key)) continue;
    const id = 'k' + (kids.length + 1);
    const name = key.charAt(0) + key.slice(1).toLowerCase();
    const k = { id, key, name, color: COLORS[kids.length % COLORS.length], uiLang: 'ru', gender: 'm', companion: kids.length % 2 ? 'capybara' : 'panda' };
    kids.push(k);
    byKey.set(key, k);
    console.warn(`! новый ребёнок «${name.slice(0, 1)}…» без настроек family.json — заданы значения по умолчанию`);
  }
  return byKey;
}

async function build(dir) {
  if (!dir) die('укажите папку недели: node tools/kl.mjs build .work/week-01');
  const pw = password();
  let parsed;
  try {
    parsed = loadWeekSource(path.resolve(ROOT, dir));
  } catch (e) {
    if (e instanceof BuildError) die(e.message);
    throw e;
  }
  parsed.warnings.forEach((w) => console.warn('! ' + w));
  const ctx = await openContent(pw, { create: true });
  const byKey = mergeFamily(ctx.index, parsed.family, Object.keys(parsed.week.kids));
  const week = { ...parsed.week, kids: {} };
  const dates = {};
  for (const [key, kid] of Object.entries(parsed.week.kids)) {
    const prof = byKey.get(key);
    week.kids[prof.id] = kid;
    dates[prof.id] = kid.days.map((d) => d.date);
  }
  const file = await weekFileName(ctx.keys, week.id);
  writeJSON(path.join(OUT, file), await encryptJSON(ctx.keys, { v: 1, ...week }, 'week'));
  const meta = { id: week.id, week: week.week, from: week.from, to: week.to, title: week.title, file, dates };
  ctx.index.weeks = ctx.index.weeks.filter((w) => w.id !== week.id).concat(meta).sort((a, b) => (a.from < b.from ? -1 : 1));
  await save(ctx);
  console.log(`✔ неделя ${week.week} (${week.from}–${week.to}) → ${path.relative(ROOT, path.join(OUT, file))}`);
  console.log(summarize(parsed.week));
  console.log(`  всего недель в контенте: ${ctx.index.weeks.length}`);
}

async function verify() {
  const { manifest, keys, index } = await openContent(password());
  let ok = true;
  for (const w of index.weeks) {
    try {
      const data = await decryptJSON(keys, readJSON(path.join(OUT, w.file)), 'week');
      const n = Object.values(data.kids).reduce((s, k) => s + k.days.reduce((a, d) => a + d.lessons.reduce((b, l) => b + l.tasks.length, 0), 0), 0);
      console.log(`✔ неделя ${w.week} ${w.from}–${w.to}: детей ${Object.keys(data.kids).length}, заданий ${n}`);
    } catch (e) {
      ok = false;
      console.error(`✖ неделя ${w.week} (${w.file}): ${e.message}`);
    }
  }
  const missing = manifest.files.filter((f) => !fs.existsSync(path.join(OUT, f)));
  if (missing.length) {
    ok = false;
    console.error('✖ нет файлов: ' + missing.join(', '));
  }
  console.log(`профилей детей: ${index.family.kids.length}`);
  if (!ok) process.exit(1);
}

async function list() {
  const { index } = await openContent(password());
  for (const w of index.weeks) console.log(`${w.id}  неделя ${w.week}  ${w.from}–${w.to}  ${w.file}`);
}

async function remove(id) {
  const ctx = await openContent(password());
  const before = ctx.index.weeks.length;
  ctx.index.weeks = ctx.index.weeks.filter((w) => w.id !== id);
  if (before === ctx.index.weeks.length) die('нет недели ' + id);
  await save(ctx);
  console.log('✔ удалена неделя ' + id);
}

async function rekey() {
  const oldPw = password('OLD_FAMILY_PASSWORD');
  const newPw = password('FAMILY_PASSWORD');
  const old = await openContent(oldPw);
  const weeks = [];
  for (const w of old.index.weeks) weeks.push([w, await decryptJSON(old.keys, readJSON(path.join(OUT, w.file)), 'week')]);
  const manifest = { ...old.manifest, kdf: { alg: 'PBKDF2-SHA256', iter: KDF_ITERATIONS, salt: randomB64(16) } };
  const keys = await importMaster(await deriveMaster(newPw, manifest.kdf));
  for (const [w, data] of weeks) {
    w.file = await weekFileName(keys, w.id);
    writeJSON(path.join(OUT, w.file), await encryptJSON(keys, data, 'week'));
  }
  await save({ manifest, keys, index: old.index });
  console.log(`✔ перешифровано недель: ${weeks.length}. На каждом планшете один раз введите новый пароль. Прогресс синхронизации начнётся заново.`);
}

function checkShell() {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'([^']+\.(?:js|css|html|json|webmanifest|svg|png|woff))'/g)].map((m) => m[1]));
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const need = [...walk('src'), ...walk('assets')].map((f) => f.split(path.sep).join('/')).filter((f) => !f.endsWith('.txt')).concat(['index.html', 'styles.css', 'manifest.webmanifest', 'settings.json']);
  const miss = need.filter((f) => !listed.has(f));
  const extra = [...listed].filter((f) => f !== 'sw.js' && !fs.existsSync(path.join(ROOT, f)));
  if (miss.length) console.error('✖ нет в SHELL (sw.js): ' + miss.join(', '));
  if (extra.length) console.error('✖ в SHELL есть несуществующие файлы: ' + extra.join(', '));
  if (miss.length || extra.length) process.exit(1);
  console.log('✔ sw.js: все файлы оболочки на месте. После правки файлов приложения поднимите VERSION в sw.js.');
}

async function check(dir) {
  if (!dir) die('укажите папку недели');
  try {
    const parsed = loadWeekSource(path.resolve(ROOT, dir));
    parsed.warnings.forEach((w) => console.warn('! ' + w));
    console.log(`✔ неделя ${parsed.week.week} (${parsed.week.from}–${parsed.week.to}) — исходники в порядке`);
    console.log(summarize(parsed.week));
  } catch (e) {
    if (e instanceof BuildError) die(e.message);
    throw e;
  }
}

const COMMANDS = { build: () => build(args[1]), check: () => check(args[1]), verify, list, remove: () => remove(args[1]), rekey, 'check-shell': checkShell };
if (!COMMANDS[cmd]) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 1 : 0);
}
await COMMANDS[cmd]();
