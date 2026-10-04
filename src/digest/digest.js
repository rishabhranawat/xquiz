/**
 * Daily digest page (extension page). All post-derived strings are rendered
 * with textContent, never innerHTML.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { formatDuration } from '../shared/digest-builder.js';
import { buildMailtoUrl, formatDayLabel, formatDigestText } from '../shared/digest-format.js';
import { isDayKey, localDayKey } from '../shared/day.js';
import { sendMessage } from '../shared/messaging.js';

const $ = (id) => document.getElementById(id);
const el = {
  select: $('day-select'),
  digest: $('digest'),
  empty: $('empty'),
  date: $('digest-date'),
  overview: $('overview'),
  posts: $('stat-posts'),
  time: $('stat-time'),
  source: $('stat-source'),
  copy: $('copy-btn'),
  email: $('email-btn'),
  regenerate: $('regenerate-btn'),
  status: $('action-status'),
  items: $('items'),
  emptyTitle: $('empty-title'),
  emptyText: $('empty-text'),
  generate: $('generate-btn'),
  emptyStatus: $('empty-status'),
};

let currentDay = localDayKey();
let currentDigest = null;

function create(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** Only ever link to x.com, whatever the stored URL says. */
const safePostUrl = (url) =>
  /^https:\/\/x\.com\/\w{1,15}(\/status\/\d+)?$/.test(url) ? url : null;

function renderItem(item) {
  const row = create('li', 'item');
  row.append(create('div', 'rank', String(item.rank)));

  const body = create('div', 'item-body');
  const head = create('div', 'item-head');
  const chips = create('div', 'chips');
  chips.append(create('span', 'chip', `${formatDuration(item.dwellMs)} reading`));
  if (item.hasMedia) chips.append(create('span', 'chip', 'media'));
  head.append(
    create('span', 'author', item.displayName),
    create('span', 'handle', `@${item.author}`),
    chips
  );

  body.append(head, create('p', 'takeaway', item.takeaway), create('p', 'quote', item.text));

  const url = safePostUrl(item.url);
  if (url) {
    const link = create('a', 'item-link', 'Open original post →');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    body.append(link);
  }
  row.append(body);
  return row;
}

function setBusy(busy, label) {
  for (const button of [el.regenerate, el.generate]) button.disabled = busy;
  el.status.textContent = busy ? label : '';
  el.emptyStatus.textContent = busy ? label : '';
}

function render(digest, day) {
  currentDay = day;
  currentDigest = digest;
  el.digest.classList.toggle('hidden', !digest);
  el.empty.classList.toggle('hidden', Boolean(digest));

  if (!digest) {
    const isToday = day === localDayKey();
    el.emptyTitle.textContent = `No digest for ${formatDayLabel(day)}`;
    el.emptyText.textContent = isToday
      ? 'Turn on "Track my reading" in the XQuiz settings, read for a while, and your digest of the top 10 posts will arrive in the evening. You can also build it now.'
      : 'Nothing was recorded for this day.';
    el.generate.classList.toggle('hidden', !isToday);
    return;
  }

  el.date.textContent = formatDayLabel(digest.day);
  el.overview.textContent = digest.overview;
  el.posts.textContent = String(digest.postCount);
  el.time.textContent = formatDuration(digest.totalDwellMs);
  el.source.textContent = digest.source === 'ai' ? 'AI' : 'Basic';
  el.items.replaceChildren(...digest.items.map(renderItem));
  el.email.href = buildMailtoUrl(digest);
}

async function loadDays(selected) {
  const { days = [] } = await sendMessage(MESSAGE_TYPES.LIST_DIGEST_DAYS, {}, {});
  const options = [...new Set([localDayKey(), selected, ...days])].sort().reverse();
  el.select.replaceChildren(
    ...options.map((day) => {
      const option = document.createElement('option');
      option.value = day;
      option.textContent =
        day === localDayKey() ? `Today · ${formatDayLabel(day)}` : formatDayLabel(day);
      return option;
    })
  );
  el.select.value = selected;
}

async function showDay(day) {
  const response = await sendMessage(MESSAGE_TYPES.GET_DIGEST, { day }, {});
  render(response.digest ?? null, day);
}

async function generate() {
  setBusy(true, 'Building your digest…');
  const response = await sendMessage(MESSAGE_TYPES.GENERATE_DIGEST, { day: currentDay }, {});
  setBusy(false);
  if (response.digest) {
    render(response.digest, currentDay);
  } else {
    el.emptyStatus.textContent = response.empty
      ? 'Not enough reading yet. Posts need a couple of seconds of attention to count.'
      : 'Could not build the digest.';
  }
}

async function copyText() {
  if (!currentDigest) return;
  const text = formatDigestText(currentDigest);
  try {
    await navigator.clipboard.writeText(text);
    el.status.textContent = 'Copied to clipboard';
  } catch {
    el.status.textContent = 'Copy failed. Select the text manually instead.';
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  // Opened inside the Safari popup (no tabs): offer a way back to the quiz.
  if (params.get('from') === 'popup') $('back-link').classList.remove('hidden');
  const requested = params.get('day');
  const day = isDayKey(requested) ? requested : localDayKey();
  await loadDays(day);
  await showDay(day);

  el.select.addEventListener('change', () => showDay(el.select.value));
  el.copy.addEventListener('click', copyText);
  el.regenerate.addEventListener('click', generate);
  el.generate.addEventListener('click', generate);
}

init();
