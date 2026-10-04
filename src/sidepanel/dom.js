/**
 * Small DOM helpers for the side panel views.
 */

/**
 * Like document.getElementById but fails loudly if the markup and code drift apart.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id} in sidepanel/index.html`);
  return element;
}

/**
 * Shows or hides an element via the `hidden` utility class.
 * @param {Element} element
 * @param {boolean} hidden
 */
export function setHidden(element, hidden) {
  element.classList.toggle('hidden', hidden);
}

/**
 * Creates an element with a class and plain text (never HTML).
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 */
export function createElement(tag, className, text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}
