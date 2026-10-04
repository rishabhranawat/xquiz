/**
 * Daily digest entry points in the side panel: the header button that opens
 * the digest page, and the digest actions inside the settings modal.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { DIGEST_PAGE_PATH } from '../shared/digest-constants.js';
import { hasSidePanel, ext } from '../shared/browser.js';
import { sendMessage } from '../shared/messaging.js';
import { byId } from './dom.js';

/**
 * Opens the digest. Chrome: a new tab. Without a side panel (Safari) the
 * digest opens inside the popup instead: tabs.create from an iOS popup is not
 * reliable and would dismiss it anyway. The page shows a back link (`from=popup`).
 */
function openDigestPage() {
  if (hasSidePanel()) {
    ext.tabs.create({ url: ext.runtime.getURL(DIGEST_PAGE_PATH) });
  } else {
    window.location.assign(`../${DIGEST_PAGE_PATH}?from=popup`);
  }
}

export function createDigestView() {
  const status = byId('digest-status');
  const generateButton = byId('generate-digest');

  /** Shows how much reading has been recorded today. */
  async function refreshStatus() {
    const response = await sendMessage(MESSAGE_TYPES.GET_READING_STATUS, {}, null);
    const count = response?.today?.postCount ?? 0;
    status.textContent = `${count} post${count === 1 ? '' : 's'} recorded today.`;
  }

  byId('digest-btn').addEventListener('click', openDigestPage);

  generateButton.addEventListener('click', async () => {
    generateButton.disabled = true;
    const response = await sendMessage(MESSAGE_TYPES.GENERATE_DIGEST, {}, {});
    generateButton.disabled = false;
    if (response.digest) openDigestPage();
    else status.textContent = 'Not enough reading recorded yet to build a digest.';
  });

  byId('clear-reading-data').addEventListener('click', async () => {
    if (!confirm('Delete all recorded reading data and saved digests? This cannot be undone.')) {
      return;
    }
    await sendMessage(MESSAGE_TYPES.CLEAR_READING_DATA);
    refreshStatus();
  });

  return { refreshStatus };
}
