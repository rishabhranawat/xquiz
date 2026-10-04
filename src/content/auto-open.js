/**
 * Auto-open: the side panel can only be opened from a user gesture, so we
 * listen for the next click/keypress on the page and ask the background to
 * open it. The background re-arms us (ENABLE_AUTO_OPEN) after navigations.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { isTouchPrimary } from '../shared/browser.js';
import { isExtensionValid, sendMessage } from '../shared/messaging.js';

const GESTURE_EVENTS = ['pointerdown', 'keydown'];

/**
 * @param {{supported?: boolean}} [options] `supported: false` makes every method
 *   a no-op. By default touch-first devices (no side panel in iOS Safari) are
 *   unsupported, and the first background reply of `unsupported` turns it off
 *   for good (Safari desktop has no side panel either).
 */
export function createAutoOpen({ supported = !isTouchPrimary() } = {}) {
  let enabled = supported;
  let listening = false;
  let requestInFlight = false;

  function detach() {
    if (!listening) return;
    GESTURE_EVENTS.forEach((type) => window.removeEventListener(type, handleGesture, true));
    listening = false;
  }

  function attach() {
    if (!enabled || listening || requestInFlight) return;
    GESTURE_EVENTS.forEach((type) => window.addEventListener(type, handleGesture, true));
    listening = true;
  }

  async function handleGesture() {
    if (!enabled || requestInFlight) return;
    requestInFlight = true;
    detach();

    const response = isExtensionValid()
      ? await sendMessage(MESSAGE_TYPES.OPEN_SIDE_PANEL, {}, { success: false })
      : { success: false };
    requestInFlight = false;

    if (response.unsupported) {
      supported = false; // no side panel in this browser: stay off
      enabled = false;
    } else if (response.success) {
      enabled = false; // wait for the background to re-arm us
    } else {
      attach(); // try again on the next gesture
    }
  }

  return {
    /** Starts listening for the opening gesture. */
    start: attach,
    /** Re-arms auto-open (called when the background asks for it). */
    enable() {
      if (!supported) return;
      enabled = true;
      requestInFlight = false;
      attach();
    },
  };
}
