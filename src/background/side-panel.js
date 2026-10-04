/**
 * Side panel lifecycle: opens it from the toolbar icon, enables it only on
 * X/Twitter tabs, and re-arms the content script's auto-open on navigation.
 *
 * Only host permissions for x.com/twitter.com are needed: for other sites
 * `tab.url` is simply undefined, which we treat as "not X".
 */

import { MESSAGE_TYPES, SIDE_PANEL_PATH, X_HOSTNAMES } from '../shared/constants.js';
import { ext, hasSidePanel } from '../shared/browser.js';
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
    const tab = await ext.tabs.get(tabId);
    if (isXUrl(tab.url)) {
      await ext.sidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true });
      // Let the content script request an automatic open on the next user gesture.
      await ext.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.ENABLE_AUTO_OPEN }).catch(() => {});
    } else {
      await ext.sidePanel.setOptions({ tabId, enabled: false });
    }
  } catch (error) {
    // E.g. the tab was closed before the update completed.
    logger.warn(`Failed to update side panel for tab ${tabId}:`, error.message);
  }
}

/**
 * Registers tab/action listeners. Call synchronously at service worker start.
 * A no-op where there is no side panel (Safari): the toolbar popup is the UI.
 */
export function registerSidePanel() {
  if (!hasSidePanel()) return;
  ext.action.onClicked.addListener((tab) => {
    ext.sidePanel.open({ tabId: tab.id });
  });

  ext.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') updateSidePanel(tabId);
  });

  ext.tabs.onActivated.addListener(({ tabId }) => updateSidePanel(tabId));
}

export const messageHandlers = {
  /** Content script asks to open the panel (needs the sender's tab). */
  [MESSAGE_TYPES.OPEN_SIDE_PANEL]: async (_message, sender) => {
    if (!hasSidePanel()) {
      return { success: false, unsupported: true, error: 'The side panel is not available.' };
    }
    if (sender.tab?.id == null) {
      return { success: false, error: 'Missing tab information for side panel open request.' };
    }
    try {
      await ext.sidePanel.open({ tabId: sender.tab.id });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
