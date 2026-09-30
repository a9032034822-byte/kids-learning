// Страница распечатки как есть — для всего, что не стало интерактивным.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { prompt } from './common.js';

export function mount(el, task, ctx) {
  const L = ctx.lang;
  if (task.q) el.append(prompt(task.q, ctx));
  for (const n of [task.page].flat()) el.append(ctx.pageSheet(n));
  ctx.setAction(t(L, 'pageSeen', ctx.gender) + ' ✓', () => ctx.finish({ errors: 0 }));
}
