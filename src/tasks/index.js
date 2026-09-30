import * as rule from './rule.js';
import * as choice from './choice.js';
import * as input from './input.js';
import * as fix from './fix.js';
import * as split from './split.js';
import * as stress from './stress.js';
import * as column from './column.js';
import * as sort from './sort.js';
import * as read from './read.js';
import * as poem from './poem.js';
import * as offline from './offline.js';
import * as page from './page.js';

export const TASKS = { rule, choice, input, fix, split, stress, column, sort, read, poem, offline, page };

/** Задания, где ошибки можно вернуть на повтор отдельными пунктами. */
export const RETRYABLE = new Set(['rule', 'choice', 'input', 'fix', 'split', 'stress', 'column', 'sort']);

/** Нужна ли отметка родителя. */
export function needsApproval(task) {
  if (task.type === 'offline') return task.approve !== false;
  if (task.type === 'poem') return task.stage === 'nohints' && task.approve !== false;
  return !!task.approve;
}
