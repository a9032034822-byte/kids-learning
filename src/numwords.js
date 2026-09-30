// Числа словами по-русски: 2451 → «две тысячи четыреста пятьдесят один».

const ONES_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
const SCALES = [
  null,
  { f: true, forms: ['тысяча', 'тысячи', 'тысяч'] },
  { f: false, forms: ['миллион', 'миллиона', 'миллионов'] },
  { f: false, forms: ['миллиард', 'миллиарда', 'миллиардов'] },
];

function plural(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

function triad(n, fem) {
  const out = [];
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (h) out.push(HUNDREDS[h]);
  if (t === 1) out.push(TEENS[o]);
  else {
    if (t) out.push(TENS[t]);
    if (o) out.push((fem ? ONES_F : ONES_M)[o]);
  }
  return out;
}

export function numToRu(num) {
  let n = Math.floor(Math.abs(Number(num)));
  if (!Number.isFinite(n)) return String(num);
  if (n === 0) return 'ноль';
  const parts = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const tri = n % 1000;
    if (tri) {
      const words = triad(tri, scale === 1);
      if (scale) words.push(plural(tri, SCALES[scale].forms));
      parts.unshift(words.join(' '));
    }
    n = Math.floor(n / 1000);
    scale++;
  }
  return (Number(num) < 0 ? 'минус ' : '') + parts.join(' ');
}

/** «125 + 348» → «сто двадцать пять плюс триста сорок восемь» */
export function exprToRu(a, op, b) {
  const w = { '+': 'плюс', '-': 'минус', '−': 'минус', ':': 'разделить на', '×': 'умножить на' }[op] || op;
  return `${numToRu(a)} ${w} ${numToRu(b)}`;
}
