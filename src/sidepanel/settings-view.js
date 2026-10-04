/**
 * Settings modal: loading, editing and saving user settings, plus the
 * "reset stats" / "clear tweet history" maintenance actions.
 */

import { MESSAGE_TYPES, PAGE_IDS } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { normalizeSettings } from '../shared/settings.js';
import { byId, setHidden } from './dom.js';

/**
 * @param {object} callbacks
 * @param {(settings: object) => void} callbacks.onSaved Called after settings were saved.
 * @param {(stats: object) => void} callbacks.onStatsReset Called with the zeroed stats.
 */
export function createSettingsView({ onSaved, onStatsReset }) {
  const el = {
    modal: byId('settings-modal'),
    openButton: byId('settings-btn'),
    closeButton: byId('close-settings'),
    saveButton: byId('save-settings'),
    apiKey: byId('gemini-api-key'),
    tweetsSlider: byId('tweets-per-quiz'),
    tweetsValue: byId('tweets-value'),
    viewTimeSlider: byId('view-time-seconds'),
    viewTimeValue: byId('view-time-value'),
    removeVideos: byId('remove-videos-toggle'),
    resetStats: byId('reset-stats'),
    clearTweetHistory: byId('clear-history'),
  };
  const pageCheckboxes = [...document.querySelectorAll('[data-track-page]')];

  const open = () => setHidden(el.modal, false);
  const close = () => setHidden(el.modal, true);

  /** Writes settings into the form controls. */
  function populate(settings) {
    el.apiKey.value = settings.apiKey;
    el.tweetsSlider.value = settings.tweetsPerQuiz;
    el.tweetsValue.textContent = settings.tweetsPerQuiz;
    const seconds = settings.viewTimeMs / 1000;
    el.viewTimeSlider.value = seconds;
    el.viewTimeValue.textContent = `${seconds}s`;
    el.removeVideos.checked = settings.removeVideos;
    pageCheckboxes.forEach((checkbox) => {
      checkbox.checked = settings.allowedPages.includes(checkbox.value);
    });
  }

  /** Reads the form controls into a normalized settings object. */
  function readForm() {
    let allowedPages = pageCheckboxes.filter((cb) => cb.checked).map((cb) => cb.value);
    if (allowedPages.length === 0) {
      // At least one page must be tracked; fall back to the home timeline.
      allowedPages = [PAGE_IDS.HOME];
      pageCheckboxes.forEach((cb) => {
        if (cb.value === PAGE_IDS.HOME) cb.checked = true;
      });
    }
    return normalizeSettings({
      apiKey: el.apiKey.value,
      tweetsPerQuiz: parseInt(el.tweetsSlider.value, 10),
      viewTimeMs: parseInt(el.viewTimeSlider.value, 10) * 1000,
      removeVideos: el.removeVideos.checked,
      allowedPages,
    });
  }

  async function save() {
    const settings = readForm();
    await sendMessage(MESSAGE_TYPES.UPDATE_SETTINGS, settings);
    close();
    onSaved(settings);
  }

  async function resetStats() {
    if (!confirm('Reset all stats? This cannot be undone.')) return;
    const response = await sendMessage(MESSAGE_TYPES.RESET_STATS);
    if (response?.stats) onStatsReset(response.stats);
    close();
  }

  async function clearTweetHistory() {
    const warning =
      "Clear tweet history? You may see quizzes about tweets you've already been tested on.";
    if (!confirm(warning)) return;
    await sendMessage(MESSAGE_TYPES.CLEAR_TWEET_HISTORY);
    close();
  }

  el.openButton.addEventListener('click', open);
  el.closeButton.addEventListener('click', close);
  el.modal.addEventListener('click', (event) => {
    if (event.target === el.modal) close();
  });
  el.tweetsSlider.addEventListener('input', () => {
    el.tweetsValue.textContent = el.tweetsSlider.value;
  });
  el.viewTimeSlider.addEventListener('input', () => {
    el.viewTimeValue.textContent = `${el.viewTimeSlider.value}s`;
  });
  el.saveButton.addEventListener('click', save);
  el.resetStats.addEventListener('click', resetStats);
  el.clearTweetHistory.addEventListener('click', clearTweetHistory);

  return {
    /** Fetches settings from the background and fills the form. Returns them. */
    async load() {
      const settings = normalizeSettings(await sendMessage(MESSAGE_TYPES.GET_SETTINGS, {}, {}));
      populate(settings);
      return settings;
    },
  };
}
