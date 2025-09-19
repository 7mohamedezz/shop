/**
 * DOM utility functions
 */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/**
 * Scrolls to an element smoothly
 * @param {string} elementId - The ID of the element to scroll to
 */
function scrollToElement(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Shows loading state on an element
 * @param {HTMLElement} element - The element to show loading on
 * @param {string} text - Loading text
 */
function showLoadingState(element, text = 'جاري التحميل...') {
  if (!element) {
    return;
  }

  element.disabled = true;
  const originalText = element.textContent;
  element.dataset.originalText = originalText;
  element.textContent = text;
  element.classList.add('loading');
}

/**
 * Hides loading state from an element
 * @param {HTMLElement} element - The element to hide loading from
 */
function hideLoadingState(element) {
  if (!element) {
    return;
  }

  element.disabled = false;
  element.textContent = element.dataset.originalText || element.textContent;
  element.classList.remove('loading');
  delete element.dataset.originalText;
}

/**
 * Creates a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Sanitizes HTML content for safe insertion
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Creates an element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {string|HTMLElement[]} content - Element content
 * @returns {HTMLElement} - Created element
 */
function createElement(tag, attributes = {}, content = '') {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });

  if (typeof content === 'string') {
    element.innerHTML = content;
  } else if (Array.isArray(content)) {
    content.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });
  }

  return element;
}

module.exports = {
  $,
  $$,
  scrollToElement,
  showLoadingState,
  hideLoadingState,
  debounce,
  sanitizeHtml,
  createElement
};
