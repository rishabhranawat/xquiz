/**
 * Plain-text rendering of a digest, for "Copy as text" and mailto: links.
 */

import { formatDuration } from './digest-builder.js';

const MAILTO_MAX_LENGTH = 1900; // browsers/mail clients reject much longer mailto: URLs

/** @param {string} day YYYY-MM-DD */
export function formatDayLabel(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** @param {ReturnType<typeof import('./digest-builder.js').assembleDigest>} digest */
export function digestSubject(digest) {
  return `Your XQuiz daily digest - ${formatDayLabel(digest.day)}`;
}

/** @param {ReturnType<typeof import('./digest-builder.js').assembleDigest>} digest */
export function formatDigestText(digest) {
  const lines = [digestSubject(digest), '', digest.overview, ''];
  for (const item of digest.items) {
    lines.push(
      `${item.rank}. ${item.displayName} (@${item.author}) - ${formatDuration(item.dwellMs)}`,
      `   ${item.takeaway}`
    );
    if (item.url) lines.push(`   ${item.url}`);
    lines.push('');
  }
  lines.push(`Read ${digest.postCount} posts for ${formatDuration(digest.totalDwellMs)} in total.`);
  return lines.join('\n');
}

/**
 * mailto: URL with the digest as body. The body is shortened to fit mail
 * clients' URL limits (whole lines are dropped, never half a URL).
 * @param {object} digest
 * @param {string} [to]
 */
export function buildMailtoUrl(digest, to = '') {
  const prefix = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(digestSubject(digest))}&body=`;
  const lines = formatDigestText(digest).split('\n');
  let body = lines.join('\n');
  while (prefix.length + encodeURIComponent(body).length > MAILTO_MAX_LENGTH && lines.length > 3) {
    lines.pop();
    body = `${lines.join('\n').trimEnd()}\n...`;
  }
  return prefix + encodeURIComponent(body);
}
