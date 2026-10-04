/**
 * Runtime messaging helpers shared by every extension context. Wire format is
 * `{ type: MESSAGE_TYPES.X, ...payload }`; see MESSAGE_TYPES in constants.js.
 */

import { logger } from './logger.js';

/**
 * False once the extension was reloaded/updated and this context is orphaned.
 * @returns {boolean}
 */
export function isExtensionValid() {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

/**
 * Sends a message to the extension and resolves with the response. Never
 * rejects: if the context is invalid, nobody is listening or the receiver
 * fails, the fallback is returned instead.
 * @param {string} type A MESSAGE_TYPES value.
 * @param {object} [payload] Extra message fields.
 * @param {any} [fallback] Value to resolve with when no response arrives.
 * @returns {Promise<any>}
 */
export async function sendMessage(type, payload = {}, fallback = null) {
  if (!isExtensionValid()) {
    logger.warn(`Extension context invalidated; dropping ${type}`);
    return fallback;
  }
  try {
    const response = await chrome.runtime.sendMessage({ type, ...payload });
    return response ?? fallback;
  } catch (error) {
    // Typically "Receiving end does not exist" (side panel closed, worker restarting).
    logger.debug(`${type} not delivered:`, error.message);
    return fallback;
  }
}

/**
 * Fire-and-forget variant of sendMessage for broadcasts.
 * @param {string} type
 * @param {object} [payload]
 */
export function broadcast(type, payload = {}) {
  return sendMessage(type, payload).then(() => undefined);
}

/**
 * Registers a request/response router (used by the service worker). Every
 * message from this extension gets exactly one response: the handler's
 * return value (sync or async), `{ error }` if it throws, or
 * `{ error: 'UNKNOWN_MESSAGE' }` when no handler exists.
 * Messages from other extensions are rejected.
 *
 * @param {Record<string, (message: any, sender: chrome.runtime.MessageSender) => any>} handlers
 *   Map of message type -> handler.
 * @param {{beforeHandle?: () => Promise<void>}} [options] `beforeHandle` is awaited
 *   before every handler (e.g. to finish loading persisted state).
 */
export function registerMessageRouter(handlers, { beforeHandle } = {}) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender?.id && sender.id !== chrome.runtime.id) {
      logger.warn('Blocked message from untrusted sender:', sender.id);
      sendResponse({ error: 'UNAUTHORIZED' });
      return false;
    }

    const handler = Object.hasOwn(handlers, message?.type) ? handlers[message.type] : null;
    if (!handler) {
      sendResponse({ error: 'UNKNOWN_MESSAGE' });
      return false;
    }

    (async () => {
      await beforeHandle?.();
      return handler(message, sender);
    })()
      .then((response) => sendResponse(response ?? {}))
      .catch((error) => {
        logger.error(`Handler for ${message.type} failed:`, error);
        sendResponse({ error: error?.message || 'INTERNAL_ERROR' });
      });
    return true; // keep the channel open for the async response
  });
}

/**
 * Registers a listener that dispatches notifications to handlers without
 * responding (used by the side panel and content script). Unknown types are
 * ignored so other listeners can answer them.
 * @param {Record<string, (message: any, sender: chrome.runtime.MessageSender) => void>} handlers
 */
export function listenForMessages(handlers) {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender?.id && sender.id !== chrome.runtime.id) return;
    if (Object.hasOwn(handlers, message?.type)) handlers[message.type](message, sender);
  });
}
