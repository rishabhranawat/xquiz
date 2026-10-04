/**
 * Auto-open: the side panel can only be opened from a user gesture, so we
 * listen for the next click/keypress on the page and ask the background to
 * open it. The background re-arms us (ENABLE_AUTO_OPEN) after navigations.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { isExtensionValid, sendMessage } from '../shared/messaging.js';

const GESTURE_EVENTS = ['pointerdown', 'keydown'];

export function createAutoOpen() {
  let enabled = true;
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

    if (response.success) {
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
      enabled = true;
      requestInFlight = false;
      attach();
    },
  };
}
