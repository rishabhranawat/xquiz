/**
 * "Past Questions" list. All content is rendered with textContent.
 */

import { MESSAGE_TYPES, QUIZ_TYPES, QUIZ_TYPE_LABELS } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { byId, createElement } from './dom.js';

const HISTORY_TYPE_LABELS = {
  ...QUIZ_TYPE_LABELS,
  [QUIZ_TYPES.TRUE_FALSE]: 'True/False',
};

function renderEntry(entry) {
  const item = createElement('div', 'history-item');

  const meta = createElement('div', 'history-meta');
  meta.append(
    createElement('span', 'history-type', HISTORY_TYPE_LABELS[entry.type] || entry.type),
    createElement('span', 'history-time', new Date(entry.timestamp).toLocaleString())
  );

  item.append(meta, createElement('p', 'history-question', entry.question));
  if (Array.isArray(entry.options)) {
    item.append(createElement('p', 'history-options', entry.options.join(' • ')));
  }
  item.append(createElement('p', 'history-answer', `Answer: ${entry.answer}`));
  return item;
}

export function createHistoryView() {
  const list = byId('history-list');
  const clearButton = byId('clear-quiz-history');
  let history = [];

  function render() {
    list.replaceChildren();
    clearButton.disabled = history.length === 0;
    if (history.length === 0) {
      list.append(createElement('p', 'history-empty', 'No past questions yet.'));
      return;
    }
    list.append(...history.map(renderEntry));
  }

  async function load() {
    const response = await sendMessage(MESSAGE_TYPES.GET_QUIZ_HISTORY, {}, { history: [] });
    history = response.history || [];
    render();
  }

  clearButton.addEventListener('click', async () => {
    if (history.length === 0 || !confirm('Clear all saved quiz questions?')) return;
    await sendMessage(MESSAGE_TYPES.CLEAR_QUIZ_HISTORY);
    await load();
  });

  return { load };
}
