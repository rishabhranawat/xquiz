/**
 * Share modal: renders a scorecard from the current stats and lets the user
 * download it or post it to X.
 */

import { DEFAULT_STATS, MESSAGE_TYPES } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { sendMessage } from '../shared/messaging.js';
import { accuracyPercent } from '../shared/stats.js';
import { byId, setHidden } from './dom.js';
import { renderScorecard } from './scorecard.js';

const RENDER_DELAY_MS = 500; // brief loading state, purely for UX

/**
 * Text pre-filled when sharing to X.
 * @param {{accuracy: number, streak: number}} stats
 */
export function buildShareText({ accuracy, streak }) {
  return `🧠 Testing my attention span on X with XQuiz!

📊 ${accuracy}% retention accuracy
🔥 ${streak} question streak

Are you actually reading your feed or just scrolling? Find out 👇`;
}

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

export function createShareView() {
  const el = {
    modal: byId('share-modal'),
    openButton: byId('share-btn'),
    closeButton: byId('close-share'),
    loading: byId('share-loading'),
    result: byId('share-result'),
    error: byId('share-error'),
    errorText: byId('share-error-text'),
    image: byId('scorecard-image'),
    downloadButton: byId('download-scorecard'),
    postButton: byId('post-to-x'),
    retryButton: byId('retry-share'),
  };

  /** @type {{dataUrl: string, accuracy: number, streak: number} | null} */
  let scorecard = null;

  async function generate() {
    setHidden(el.loading, false);
    setHidden(el.result, true);
    setHidden(el.error, true);

    const response = await sendMessage(MESSAGE_TYPES.GET_STATS, {}, { stats: DEFAULT_STATS });
    const stats = response.stats || DEFAULT_STATS;
    const accuracy = accuracyPercent(stats) ?? 0;

    try {
      const dataUrl = renderScorecard({
        accuracy,
        streak: stats.currentStreak,
        bestStreak: stats.bestStreak,
      });
      await new Promise((resolve) => setTimeout(resolve, RENDER_DELAY_MS));

      scorecard = { dataUrl, accuracy, streak: stats.currentStreak };
      el.image.src = dataUrl;
      setHidden(el.loading, true);
      setHidden(el.result, false);
    } catch (error) {
      setHidden(el.loading, true);
      setHidden(el.error, false);
      el.errorText.textContent = error.message;
    }
  }

  function download() {
    if (!scorecard) return;
    const link = document.createElement('a');
    link.href = scorecard.dataUrl;
    link.download = `xquiz-scorecard-${Date.now()}.png`;
    link.click();
  }

  /** Shares via the Web Share API when possible, else copies the image and opens X. */
  async function postToX() {
    const text = buildShareText(scorecard ?? { accuracy: 0, streak: 0 });

    if (navigator.share && navigator.canShare && scorecard) {
      try {
        const blob = await dataUrlToBlob(scorecard.dataUrl);
        const file = new File([blob], 'xquiz-scorecard.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ text, files: [file] });
          return;
        }
      } catch (error) {
        logger.debug('Web Share failed, falling back to intent URL:', error);
      }
    }

    if (scorecard) {
      try {
        const blob = await dataUrlToBlob(scorecard.dataUrl);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        alert('Scorecard copied to clipboard! Paste it into your tweet.');
      } catch (error) {
        logger.debug('Could not copy to clipboard:', error);
      }
    }

    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }

  el.openButton.addEventListener('click', () => {
    setHidden(el.modal, false);
    generate();
  });
  el.closeButton.addEventListener('click', () => setHidden(el.modal, true));
  el.modal.addEventListener('click', (event) => {
    if (event.target === el.modal) setHidden(el.modal, true);
  });
  el.downloadButton.addEventListener('click', download);
  el.postButton.addEventListener('click', postToX);
  el.retryButton.addEventListener('click', generate);
}
