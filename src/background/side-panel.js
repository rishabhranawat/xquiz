/**
 * Side panel lifecycle: opens it from the toolbar icon, enables it only on
 * X/Twitter tabs, and re-arms the content script's auto-open on navigation.
 *
 * Only host permissions for x.com/twitter.com are needed: for other sites
 * `tab.url` is simply undefined, which we treat as "not X".
 */

import { MESSAGE_TYPES, SIDE_PANEL_PATH, X_HOSTNAMES } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

/**
 * True when `url` points at X/Twitter.
 * @param {string | undefined} url
 */
export function isXUrl(url) {
  if (!url) return false;
  try {
    return X_HOSTNAMES.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Enables the side panel on X tabs and disables (closes) it elsewhere. */
async function updateSidePanel(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isXUrl(tab.url)) {
      await chrome.sidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true });
      // Let the content script request an automatic open on the next user gesture.
      await chrome.tabs
        .sendMessage(tabId, { type: MESSAGE_TYPES.ENABLE_AUTO_OPEN })
        .catch(() => {});
    } else {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
    }
  } catch (error) {
    // E.g. the tab was closed before the update completed.
    logger.warn(`Failed to update side panel for tab ${tabId}:`, error.message);
  }
}

/** Registers tab/action listeners. Call synchronously at service worker start. */
export function registerSidePanel() {
  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') updateSidePanel(tabId);
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => updateSidePanel(tabId));
}

export const messageHandlers = {
  /** Content script asks to open the panel (needs the sender's tab). */
  [MESSAGE_TYPES.OPEN_SIDE_PANEL]: async (_message, sender) => {
    if (sender.tab?.id == null) {
      return { success: false, error: 'Missing tab information for side panel open request.' };
    }
    try {
      await chrome.sidePanel.open({ tabId: sender.tab.id });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
