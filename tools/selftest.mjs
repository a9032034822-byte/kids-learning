// Быстрые проверки без браузера: шифрование, числа словами, Markdown, слияние прогресса,
// сборка вымышленной недели из docs/example во временную папку. Запуск: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deriveMaster, importMaster, encryptJSON, decryptJSON, randomB64 } from '../src/crypto.js';
import { numToRu } from '../src/numwords.js';
import { renderMarkdown } from '../src/markdown.js';
import { matches } from '../src/util.js';
import * as store from '../src/store.js';
import { parseRule, normalizeMd, extractPages, youtubeId, normVideos, loadWeekSource } from './lib/week.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (name) => console.log(`✔ ${++n}. ${name}`);

// шифрование
const kdf = { iter: 1000, salt: randomB64(16) };
const keys = await importMaster(await deriveMaster('correct horse battery', kdf));
const env = await encryptJSON(keys, { a: 'секрет' }, 'week');
assert.deepEqual(await decryptJSON(keys, env, 'week'), { a: 'секрет' });
await assert.rejects(decryptJSON(keys, env, 'index'));
const bad = await importMaster(await deriveMaster('wrong horse battery', kdf));
await assert.rejects(decryptJSON(bad, env, 'week'));
assert.ok(!JSON.stringify(env).includes('секрет'));
ok('AES-GCM: расшифровка, чужой пароль и чужая роль файла отклоняются');

// числа словами
assert.equal(numToRu(2451), 'две тысячи четыреста пятьдесят один');
assert.equal(numToRu(13070), 'тринадцать тысяч семьдесят');
assert.equal(numToRu(200600), 'двести тысяч шестьсот');
assert.equal(numToRu(3005100), 'три миллиона пять тысяч сто');
assert.equal(numToRu(11000400), 'одиннадцать миллионов четыреста');
assert.equal(numToRu(1001), 'одна тысяча один');
assert.equal(numToRu(2), 'два');
ok('числа словами');

// сравнение ответов
assert.ok(matches('3 070 000', '3070000', 'number'));
assert.ok(matches(' Разность. ', 'разность', 'text'));
assert.ok(matches('ежик', 'ёжик', 'text'));
assert.ok(!matches('', '0', 'number'));
ok('сравнение ответов');

// Markdown безопасен
const html = renderMarkdown('**жирно** <script>alert(1)</script> [ссылка](javascript:alert(1)) [ok](https://example.org)');
assert.ok(!html.includes('<script>') && !html.includes('href="javascript'));
assert.ok(html.includes('<strong>жирно</strong>') && html.includes('href="https://example.org"'));
ok('Markdown экранирует HTML и опасные ссылки');

// разбор правил и страниц
assert.equal(parseRule({ name: 'x', see: 'He sings (loud / loudly).', write: 'He sings loudly.' }, () => {}).answer, 1);
assert.equal(parseRule({ name: 'x', see: 'we met in (london / London)', write: 'we met in London' }, () => {}).answer, 1);
assert.equal(parseRule({ name: 'x', see: '208 — («двести ноль восемь» / «двести восемь»)', write: '208 — двести восемь' }, () => {}).answer, 1);
assert.equal(normalizeMd('Wow\\\\\\! \\_\\_ \\[й\\]'), 'Wow! __ [й]');
assert.deepEqual(extractPages('шапка\n\n— стр. 1 —\n\nА\n\n— стр. 2 —\n\nБ').map((p) => [p.n, p.md]), [[1, 'А'], [2, 'Б']]);
ok('правила «Видишь/Пишешь», страницы распечатки, экранирование Google Docs');

// ролики YouTube к песням
assert.equal(youtubeId('https://www.youtube.com/watch?v=abcDEF12345&t=3'), 'abcDEF12345');
assert.equal(youtubeId('https://youtu.be/abcDEF12345'), 'abcDEF12345');
assert.equal(youtubeId('https://www.youtube.com/shorts/xyz_-678901'), 'xyz_-678901');
assert.equal(youtubeId('abcDEF12345'), 'abcDEF12345');
assert.equal(youtubeId('https://example.org/watch?v=short'), null);
assert.deepEqual(normVideos({ youtube: 'https://youtu.be/abcDEF12345', title: 'A' }, 't'), [{ youtube: 'abcDEF12345', title: 'A' }]);
assert.throws(() => normVideos('не ссылка', 't'));
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kl-vid-'));
  fs.cpSync(path.join(ROOT, 'docs/example'), tmp, { recursive: true });
  const w = JSON.parse(fs.readFileSync(path.join(tmp, 'week.json'), 'utf8'));
  const kid = Object.values(w.kids)[0];
  kid.days[0].lessons.push({ subject: 'fr', title: 'Français', tasks: [{ type: 'offline', icon: '🎵', q: 'Chanson' }, { type: 'offline', icon: '🎵', q: 'Своя', video: 'Q1w2E3r4T5y' }] });
  fs.writeFileSync(path.join(tmp, 'week.json'), JSON.stringify(w));
  fs.writeFileSync(path.join(tmp, 'videos.json'), JSON.stringify({ weeks: { 0: { youtube: 'https://youtu.be/abcDEF12345', title: 'Песня' }, 1: 'zzzzzzzzzzz' } }));
  const songs = Object.values(loadWeekSource(tmp).week.kids)[0].days[0].lessons.at(-1).tasks;
  assert.deepEqual(songs.map((t) => t.video[0].youtube), ['abcDEF12345', 'Q1w2E3r4T5y']);
  fs.rmSync(tmp, { recursive: true });
}
ok('ролики YouTube: ссылки, id, привязка videos.json к песням недели');

// слияние прогресса (last-writer-wins)
store.put('p-t', 'a', { v: 1 });
const local = store.slot('p-t');
const r1 = store.merge('p-t', { entries: { a: { v: 0, ts: 1 }, b: { v: 2, ts: 5 } } });
assert.equal(local.entries.a.v, 1);
assert.equal(local.entries.b.v, 2);
assert.ok(r1.changedLocal && r1.remoteBehind);
const r2 = store.merge('p-t', JSON.parse(JSON.stringify(local)));
assert.ok(!r2.changedLocal && !r2.remoteBehind);
ok('слияние прогресса между устройствами');

// сборка примера
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kl-test-'));
const run = (...a) => execFileSync(process.execPath, [path.join(ROOT, 'tools/kl.mjs'), ...a, '--out', out], { env: { ...process.env, FAMILY_PASSWORD: 'selftest-password-1' }, encoding: 'utf8' });
run('build', 'docs/example');
run('verify');
const files = fs.readdirSync(out);
assert.ok(files.includes('manifest.json') && files.includes('index.enc') && files.some((f) => /^w-[0-9a-f]{16}\.enc$/.test(f)));
for (const f of files) assert.ok(!fs.readFileSync(path.join(out, f), 'utf8').includes('Пример'), 'открытый текст в ' + f);
fs.rmSync(out, { recursive: true });
ok('сборка и проверка вымышленной недели; в файлах нет открытого текста');

execFileSync(process.execPath, [path.join(ROOT, 'tools/kl.mjs'), 'check-shell'], { encoding: 'utf8' });
ok('sw.js: список файлов оболочки полный');
console.log('Все проверки пройдены.');
