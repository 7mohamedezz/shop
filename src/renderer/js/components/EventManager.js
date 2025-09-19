/**
 * Event management system for preventing memory leaks
 */

class EventManager {
  constructor() {
    this.listeners = new Map();
    this.nextId = 1;
    this.cleanupCallbacks = new Set();
  }

  /**
   * Adds an event listener and tracks it for cleanup
   * @param {HTMLElement|Window|Document} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event options
   * @returns {number} - Listener ID for removal
   */
  addEventListener(element, event, handler, options = false) {
    const id = this.nextId++;
    const listenerInfo = {
      element,
      event,
      handler,
      options
    };

    element.addEventListener(event, handler, options);
    this.listeners.set(id, listenerInfo);

    return id;
  }

  /**
   * Removes a specific event listener
   * @param {number} id - Listener ID
   */
  removeEventListener(id) {
    const listener = this.listeners.get(id);
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      this.listeners.delete(id);
    }
  }

  /**
   * Removes all event listeners for a specific element
   * @param {HTMLElement} element - Target element
   */
  removeAllListenersForElement(element) {
    for (const [id, listener] of this.listeners.entries()) {
      if (listener.element === element) {
        this.removeEventListener(id);
      }
    }
  }

  /**
   * Adds a cleanup callback to be called when cleaning up
   * @param {Function} callback - Cleanup function
   */
  addCleanupCallback(callback) {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Removes a cleanup callback
   * @param {Function} callback - Cleanup function
   */
  removeCleanupCallback(callback) {
    this.cleanupCallbacks.delete(callback);
  }

  /**
   * Cleans up all event listeners and runs cleanup callbacks
   */
  cleanup() {
    // Remove all event listeners
    for (const [id] of this.listeners.entries()) {
      this.removeEventListener(id);
    }

    // Run cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    }

    this.cleanupCallbacks.clear();
  }

  /**
   * Gets the number of active listeners
   * @returns {number} - Number of active listeners
   */
  getListenerCount() {
    return this.listeners.size;
  }

  /**
   * Creates a debounced event handler
   * @param {Function} handler - Original handler
   * @param {number} delay - Debounce delay in ms
   * @returns {Function} - Debounced handler
   */
  debounce(handler, delay = 300) {
    let timeoutId;
    const debouncedHandler = (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handler(...args), delay);
    };

    // Add cleanup for the timeout
    this.addCleanupCallback(() => {
      clearTimeout(timeoutId);
    });

    return debouncedHandler;
  }

  /**
   * Creates a throttled event handler
   * @param {Function} handler - Original handler
   * @param {number} delay - Throttle delay in ms
   * @returns {Function} - Throttled handler
   */
  throttle(handler, delay = 100) {
    let lastCall = 0;
    let timeoutId;

    const throttledHandler = (...args) => {
      const now = Date.now();

      if (now - lastCall >= delay) {
        lastCall = now;
        handler(...args);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(
          () => {
            lastCall = Date.now();
            handler(...args);
          },
          delay - (now - lastCall)
        );
      }
    };

    // Add cleanup for the timeout
    this.addCleanupCallback(() => {
      clearTimeout(timeoutId);
    });

    return throttledHandler;
  }
}

/**
 * Autocomplete component with proper cleanup
 */
class AutocompleteManager {
  constructor() {
    this.activeInstances = new Map();
    this.eventManager = new EventManager();
  }

  /**
   * Creates an autocomplete instance
   * @param {HTMLInputElement} input - Input element
   * @param {Function} searchFn - Search function
   * @param {Function} renderFn - Render function
   * @param {Object} options - Configuration options
   * @returns {Object} - Autocomplete instance
   */
  create(input, searchFn, renderFn, options = {}) {
    const { minLength = 2, delay = 300, maxResults = 10, placeholder = 'ابحث...' } = options;

    const instanceId = `autocomplete_${Date.now()}_${Math.random()}`;

    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    // Create wrapper for positioning
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = '100%';

    // Insert wrapper and move input inside
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.appendChild(dropdown);

    let currentResults = [];
    let selectedIndex = -1;
    let isOpen = false;

    // Search function with debouncing
    const debouncedSearch = this.eventManager.debounce(async query => {
      if (query.length < minLength) {
        this.hide();
        return;
      }

      try {
        const results = await searchFn(query);
        currentResults = results.slice(0, maxResults);
        this.render();
        this.show();
      } catch (error) {
        console.error('Autocomplete search error:', error);
        this.hide();
      }
    }, delay);

    // Event handlers
    const handleInput = e => {
      const query = e.target.value.trim();
      selectedIndex = -1;
      debouncedSearch(query);
    };

    const handleKeydown = e => {
      if (!isOpen) {
        return;
      }

      switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        this.updateSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        this.updateSelection();
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          this.selectItem(currentResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
      }
    };

    const handleBlur = e => {
      // Delay hiding to allow clicking on dropdown items
      setTimeout(() => {
        if (!dropdown.contains(document.activeElement)) {
          this.hide();
        }
      }, 150);
    };

    const handleDropdownClick = e => {
      const item = e.target.closest('.autocomplete-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.selectItem(currentResults[index]);
      }
    };

    // Register event listeners
    const inputListenerId = this.eventManager.addEventListener(input, 'input', handleInput);
    const keydownListenerId = this.eventManager.addEventListener(input, 'keydown', handleKeydown);
    const blurListenerId = this.eventManager.addEventListener(input, 'blur', handleBlur);
    const clickListenerId = this.eventManager.addEventListener(dropdown, 'click', handleDropdownClick);

    // Instance methods
    const instance = {
      show: () => {
        dropdown.style.display = 'block';
        isOpen = true;
      },

      hide: () => {
        dropdown.style.display = 'none';
        isOpen = false;
        selectedIndex = -1;
      },

      render: () => {
        if (currentResults.length === 0) {
          dropdown.innerHTML = '<div class="autocomplete-no-results">لا توجد نتائج</div>';
          return;
        }

        dropdown.innerHTML = currentResults
          .map(
            (result, index) => `
            <div class="autocomplete-item" data-index="${index}">
              ${renderFn(result)}
            </div>
          `
          )
          .join('');
      },

      updateSelection: () => {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
          item.classList.toggle('selected', index === selectedIndex);
        });
      },

      selectItem: item => {
        // Trigger custom event
        const event = new CustomEvent('autocomplete:select', {
          detail: { item, input }
        });
        input.dispatchEvent(event);
        instance.hide();
      },

      destroy: () => {
        this.eventManager.removeEventListener(inputListenerId);
        this.eventManager.removeEventListener(keydownListenerId);
        this.eventManager.removeEventListener(blurListenerId);
        this.eventManager.removeEventListener(clickListenerId);

        if (wrapper.parentNode) {
          wrapper.parentNode.insertBefore(input, wrapper);
          wrapper.parentNode.removeChild(wrapper);
        }

        this.activeInstances.delete(instanceId);
      }
    };

    this.activeInstances.set(instanceId, instance);
    return instance;
  }

  /**
   * Destroys all autocomplete instances
   */
  destroyAll() {
    for (const instance of this.activeInstances.values()) {
      instance.destroy();
    }
    this.activeInstances.clear();
    this.eventManager.cleanup();
  }

  /**
   * Gets the number of active instances
   * @returns {number} - Number of active instances
   */
  getInstanceCount() {
    return this.activeInstances.size;
  }
}

// Global instances
let globalEventManager = null;
let globalAutocompleteManager = null;

/**
 * Gets or creates the global event manager
 * @returns {EventManager} - Event manager instance
 */
function getEventManager() {
  if (!globalEventManager) {
    globalEventManager = new EventManager();
  }
  return globalEventManager;
}

/**
 * Gets or creates the global autocomplete manager
 * @returns {AutocompleteManager} - Autocomplete manager instance
 */
function getAutocompleteManager() {
  if (!globalAutocompleteManager) {
    globalAutocompleteManager = new AutocompleteManager();
  }
  return globalAutocompleteManager;
}

/**
 * Cleans up all global managers (call on app shutdown)
 */
function cleanupAll() {
  if (globalEventManager) {
    globalEventManager.cleanup();
    globalEventManager = null;
  }

  if (globalAutocompleteManager) {
    globalAutocompleteManager.destroyAll();
    globalAutocompleteManager = null;
  }
}

module.exports = {
  EventManager,
  AutocompleteManager,
  getEventManager,
  getAutocompleteManager,
  cleanupAll
};
