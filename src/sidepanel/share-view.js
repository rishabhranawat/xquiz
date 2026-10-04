/**
 * Share modal: renders the "recent stats" scorecard and offers download,
 * clipboard, native share and Post-on-X actions. Feedback is shown as inline
 * toast text (never alert()).
 */

import { dateKey } from '../shared/daily-log.js';
import { MESSAGE_TYPES } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { sendMessage } from '../shared/messaging.js';
import { buildIntentUrl, buildScorecardModel, buildShareText } from '../shared/scorecard-model.js';
import { createEmptyStats, normalizeStats } from '../shared/stats.js';
import { byId, setHidden } from './dom.js';
import { canvasToBlob, renderScorecardCanvas } from './scorecard.js';
import { DEFAULT_FORMAT } from './scorecard-layout.js';

const TOAST_MS = 7000;
const PREFS_KEY = 'xquiz.sharePrefs';
const FOCUSABLE = 'button:not([disabled]):not(.hidden), [href], input, select, [tabindex="-1"]';

/** Remembered format/theme choice; storage may be unavailable, so never throw. */
function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      format: prefs.format === 'square' ? 'square' : DEFAULT_FORMAT,
      theme: prefs.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return { format: DEFAULT_FORMAT, theme: 'dark' };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Persisting the choice is a nicety only.
  }
}

export function createShareView() {
  const el = {
    modal: byId('share-modal'),
    openButton: byId('share-btn'),
    closeButton: byId('close-share'),
    loading: byId('share-loading'),
    result: byId('share-result'),
    error: byId('share-error'),
    errorText: byId('share-error-text'),
    image: /** @type {HTMLImageElement} */ (byId('scorecard-image')),
    downloadButton: byId('download-scorecard'),
    copyButton: byId('copy-scorecard'),
    nativeShareButton: byId('native-share-scorecard'),
    postButton: byId('post-to-x'),
    retryButton: byId('retry-share'),
    toast: byId('share-toast'),
  };
  const formatButtons = [...el.modal.querySelectorAll('[data-share-format]')];
  const themeButtons = [...el.modal.querySelectorAll('[data-share-theme]')];

  const prefs = loadPrefs();
  /** @type {import('../shared/scorecard-model.js').ScorecardModel | null} */
  let model = null;
  /** @type {{blob: Blob, url: string, file: File} | null} */
  let image = null;
  let renderToken = 0;
  let toastTimer = 0;
  /** @type {Element | null} */
  let returnFocusTo = null;

  const isOpen = () => !el.modal.classList.contains('hidden');

  function toast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    if (message) toastTimer = setTimeout(() => (el.toast.textContent = ''), TOAST_MS);
  }

  function syncOptionButtons() {
    for (const button of formatButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.shareFormat === prefs.format));
    }
    for (const button of themeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.shareTheme === prefs.theme));
    }
  }

  /** Re-renders the canvas for the current model/format/theme. */
  async function render() {
    if (!model) return;
    const token = ++renderToken;
    try {
      const canvas = renderScorecardCanvas(model, prefs);
      const blob = await canvasToBlob(canvas);
      if (token !== renderToken) return; // a newer render superseded this one
      if (image) URL.revokeObjectURL(image.url);
      const file = new File([blob], 'xquiz-scorecard.png', { type: 'image/png' });
      image = { blob, file, url: URL.createObjectURL(blob) };
      el.image.src = image.url;
      el.image.alt = scorecardAltText(model);
      el.image.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
      setHidden(el.nativeShareButton, !canShareFile(file));
      setHidden(el.loading, true);
      setHidden(el.error, true);
      setHidden(el.result, false);
    } catch (error) {
      showError(error);
    }
  }

  function showError(error) {
    logger.debug('Scorecard failed:', error);
    setHidden(el.loading, true);
    setHidden(el.result, true);
    setHidden(el.error, false);
    el.errorText.textContent = error?.message || 'Failed to generate scorecard';
  }

  /** Loads fresh stats, builds the model and renders. */
  async function generate() {
    setHidden(el.loading, false);
    setHidden(el.result, true);
    setHidden(el.error, true);
    toast('');
    try {
      const response = await sendMessage(MESSAGE_TYPES.GET_STATS, {}, {});
      model = buildScorecardModel({
        stats: response?.stats ? normalizeStats(response.stats) : createEmptyStats(),
        dailyLog: response?.dailyLog ?? {},
      });
      await render();
    } catch (error) {
      showError(error);
    }
  }

  function download() {
    if (!image || !model) return;
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `xquiz-scorecard-${prefs.format}-${dateKey(new Date())}.png`;
    link.click();
    toast('Scorecard downloaded as PNG.');
  }

  /**
   * Copies the PNG to the clipboard.
   * @returns {Promise<boolean>} whether the image was copied.
   */
  async function copyImage() {
    if (!image) return false;
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image.blob })]);
      return true;
    } catch (error) {
      logger.debug('Could not copy to clipboard:', error);
      return false;
    }
  }

  async function copy() {
    toast(
      (await copyImage())
        ? 'Image copied to clipboard.'
        : 'Copying images is not supported here. Use Download PNG instead.'
    );
  }

  async function nativeShare() {
    if (!image || !model) return;
    try {
      await navigator.share({ text: buildShareText(model), files: [image.file] });
      toast('Shared.');
    } catch (error) {
      if (error?.name === 'AbortError') return; // user dismissed the share sheet
      logger.debug('Web Share failed:', error);
      toast('Sharing failed. Try Download PNG or Copy image instead.');
    }
  }

  /** X intents cannot carry images, so copy the image first and say so. */
  async function postToX() {
    if (!model) return;
    const copied = await copyImage();
    toast(
      copied
        ? 'Image copied. Paste it into your post (X cannot attach images automatically).'
        : 'Could not copy the image. Download it and attach it to your post.'
    );
    window.open(buildIntentUrl(buildShareText(model)), '_blank', 'noopener,noreferrer');
  }

  function open() {
    returnFocusTo = document.activeElement;
    setHidden(el.modal, false);
    syncOptionButtons();
    formatButtons.find((b) => b.getAttribute('aria-pressed') === 'true')?.focus();
    generate();
  }

  function close() {
    if (!isOpen()) return;
    setHidden(el.modal, true);
    renderToken++;
    toast('');
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    if (returnFocusTo instanceof HTMLElement) returnFocusTo.focus();
  }

  /** Escape closes; Tab stays inside the dialog. */
  function onKeydown(event) {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...el.modal.querySelectorAll(FOCUSABLE)].filter(
      (node) => node.getClientRects().length > 0
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!el.modal.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  for (const button of formatButtons) {
    button.addEventListener('click', () => {
      prefs.format = button.dataset.shareFormat === 'square' ? 'square' : 'wide';
      savePrefs(prefs);
      syncOptionButtons();
      render();
    });
  }
  for (const button of themeButtons) {
    button.addEventListener('click', () => {
      prefs.theme = button.dataset.shareTheme === 'light' ? 'light' : 'dark';
      savePrefs(prefs);
      syncOptionButtons();
      render();
    });
  }

  el.openButton.addEventListener('click', open);
  el.closeButton.addEventListener('click', close);
  el.modal.addEventListener('click', (event) => {
    if (event.target === el.modal) close();
  });
  document.addEventListener('keydown', onKeydown, true);
  el.downloadButton.addEventListener('click', download);
  el.copyButton.addEventListener('click', copy);
  el.nativeShareButton.addEventListener('click', nativeShare);
  el.postButton.addEventListener('click', postToX);
  el.retryButton.addEventListener('click', generate);
}

/** Whether the Web Share API can share this file here. */
function canShareFile(file) {
  try {
    return Boolean(navigator.share && navigator.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

/** Accessible description of the card (aggregate numbers only). */
function scorecardAltText(model) {
  const accuracy = model.accuracy === null ? 'no accuracy yet' : `${model.accuracy}% accuracy`;
  return `XQuiz scorecard: ${model.rank.title}, ${accuracy}, ${model.score.correct} of ${model.score.total} correct, current streak ${model.streak}, best streak ${model.bestStreak}.`;
}
