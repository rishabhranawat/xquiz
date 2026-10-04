/**
 * Floating "READING / NOT READING" badge shown in the corner of the page.
 */

const ROOT_ID = 'xquiz-status';
const STYLE_ID = 'xquiz-status-style';

const STYLES = `
#xquiz-status {
  position: fixed !important;
  bottom: 20px !important;
  right: 20px !important;
  background: rgba(10, 10, 10, 0.95) !important;
  border: 1px solid rgba(239, 68, 68, 0.5) !important;
  border-radius: 20px !important;
  padding: 8px 14px !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 12px !important;
  color: #a1a1aa !important;
  z-index: 2147483647 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  transition: all 0.3s ease !important;
  cursor: default !important;
  user-select: none !important;
  pointer-events: auto !important;
}

#xquiz-status:hover {
  background: rgba(20, 20, 20, 0.98) !important;
}

/* Active/Reading state - GREEN */
#xquiz-status.reading {
  border-color: rgba(34, 197, 94, 0.5) !important;
}

#xquiz-status.reading .xquiz-status-dot {
  background: #22c55e !important;
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.8) !important;
  animation: xquiz-flash-green 1s ease-in-out infinite !important;
}

#xquiz-status.reading .xquiz-status-label {
  color: #22c55e !important;
}

/* Inactive/Not Reading state - RED */
#xquiz-status:not(.reading) {
  border-color: rgba(239, 68, 68, 0.5) !important;
}

#xquiz-status:not(.reading) .xquiz-status-dot {
  background: #ef4444 !important;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.8) !important;
  animation: xquiz-flash-red 1.5s ease-in-out infinite !important;
}

#xquiz-status:not(.reading) .xquiz-status-label {
  color: #ef4444 !important;
}

#xquiz-status .xquiz-status-hidden {
  color: #a1a1aa !important;
  font-size: 11px !important;
}

#xquiz-status:not(.reading) .xquiz-status-count {
  display: none !important;
}

.xquiz-status-dot {
  width: 10px !important;
  height: 10px !important;
  border-radius: 50% !important;
  flex-shrink: 0 !important;
}

@keyframes xquiz-flash-green {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 20px rgba(34, 197, 94, 1);
  }
}

@keyframes xquiz-flash-red {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  }
  50% {
    opacity: 0.5;
    box-shadow: 0 0 4px rgba(239, 68, 68, 0.4);
  }
}

.xquiz-status-text {
  color: #fafafa !important;
  font-weight: 600 !important;
}

.xquiz-status-label {
  font-size: 10px !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}

.xquiz-status-count {
  color: #3b82f6 !important;
  font-weight: 600 !important;
  background: rgba(59, 130, 246, 0.1) !important;
  padding: 2px 8px !important;
  border-radius: 10px !important;
}
`;

/** @type {HTMLElement | null} */
let root = null;

function createChild(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/**
 * Creates the badge (once). Waits for document.body if it is not ready yet.
 * @param {number} total Tweets needed per quiz.
 */
export function createStatusIndicator(total) {
  if (root?.isConnected) return;
  if (!document.body) {
    setTimeout(() => createStatusIndicator(total), 100);
    return;
  }

  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();

  root = document.createElement('div');
  root.id = ROOT_ID;
  const dot = document.createElement('div');
  dot.className = 'xquiz-status-dot';
  root.append(
    dot,
    createChild('span', 'xquiz-status-text', 'XQuiz'),
    createChild('span', 'xquiz-status-label', 'NOT READING'),
    createChild('span', 'xquiz-status-count', `0/${total}`),
    createChild('span', 'xquiz-status-hidden', '')
  );
  root.querySelector('.xquiz-status-hidden').hidden = true;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;

  document.head.appendChild(style);
  document.body.appendChild(root);
}

/**
 * Updates the badge state.
 * @param {{active: boolean, count: number, total: number, hidden?: number}} state
 */
export function updateStatusIndicator({ active, count, total, hidden = 0 }) {
  if (!root) return;
  root.classList.toggle('reading', active);
  root.querySelector('.xquiz-status-label').textContent = active ? 'READING' : 'NOT READING';
  root.querySelector('.xquiz-status-count').textContent = `${count}/${total}`;
  const hiddenLabel = root.querySelector('.xquiz-status-hidden');
  hiddenLabel.hidden = hidden === 0;
  hiddenLabel.textContent = `${hidden} hidden`;
}

/** Re-creates the badge if the page removed it. */
export function ensureStatusIndicator(state) {
  if (root?.isConnected) return;
  createStatusIndicator(state.total);
  updateStatusIndicator(state);
}

export function removeStatusIndicator() {
  root?.remove();
  document.getElementById(STYLE_ID)?.remove();
  root = null;
}
