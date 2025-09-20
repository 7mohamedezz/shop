/**
 * Simple state management for the application
 */

class StateManager {
  constructor() {
    this.state = {
      currentTab: 'invoices',
      invoices: [],
      products: [],
      customers: [],
      plumbers: [],
      filters: {},
      settings: {
        fontSize: 16,
        printFontSize: 12,
        defaultDiscounts: []
      },
      ui: {
        loading: false,
        selectedInvoice: null,
        searchTerm: ''
      }
    };

    this.subscribers = new Map();
    this.nextSubscriberId = 1;
    // Keep an immutable snapshot of the initial defaults so we can persist only changed keys
    this._initialState = JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Gets current state
   * @param {string} path - State path (dot notation)
   * @returns {any} - State value
   */
  get(path) {
    if (!path) {
      return this.state;
    }

    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, this.state);
  }

  /**
   * Sets state value
   * @param {string} path - State path (dot notation)
   * @param {any} value - Value to set
   */
  set(path, value) {
    if (!path) {
      this.state = { ...value };
    } else {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => {
        if (!obj[key] || typeof obj[key] !== 'object') {
          obj[key] = {};
        }
        return obj[key];
      }, this.state);

      target[lastKey] = value;
    }

    this.notifySubscribers(path, value);
  }

  /**
   * Updates state value (merge for objects, replace for primitives)
   * @param {string} path - State path
   * @param {any} value - Value to update with
   */
  update(path, value) {
    const currentValue = this.get(path);

    if (currentValue && typeof currentValue === 'object' && typeof value === 'object') {
      this.set(path, { ...currentValue, ...value });
    } else {
      this.set(path, value);
    }
  }

  /**
   * Subscribes to state changes
   * @param {string} path - State path to watch
   * @param {Function} callback - Callback function
   * @returns {number} - Subscription ID
   */
  subscribe(path, callback) {
    const id = this.nextSubscriberId++;

    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Map());
    }

    this.subscribers.get(path).set(id, callback);

    return id;
  }

  /**
   * Unsubscribes from state changes
   * @param {number} subscriptionId - Subscription ID
   */
  unsubscribe(subscriptionId) {
    for (const [path, callbacks] of this.subscribers.entries()) {
      if (callbacks.has(subscriptionId)) {
        callbacks.delete(subscriptionId);
        if (callbacks.size === 0) {
          this.subscribers.delete(path);
        }
        break;
      }
    }
  }

  /**
   * Notifies subscribers of state changes
   * @param {string} changedPath - Path that changed
   * @param {any} newValue - New value
   */
  notifySubscribers(changedPath, newValue) {
    // Notify exact path subscribers
    const exactSubscribers = this.subscribers.get(changedPath);
    if (exactSubscribers) {
      exactSubscribers.forEach(callback => {
        try {
          callback(newValue, changedPath);
        } catch (error) {
          console.error('Error in state subscriber:', error);
        }
      });
    }

    // Notify parent path subscribers
    const pathParts = changedPath.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.');
      const parentSubscribers = this.subscribers.get(parentPath);

      if (parentSubscribers) {
        const parentValue = this.get(parentPath);
        parentSubscribers.forEach(callback => {
          try {
            callback(parentValue, parentPath, changedPath);
          } catch (error) {
            console.error('Error in state subscriber:', error);
          }
        });
      }
    }
  }

  /**
   * Resets state to initial values
   */
  reset() {
    this.state = {
      currentTab: 'invoices',
      invoices: [],
      products: [],
      customers: [],
      plumbers: [],
      filters: {},
      settings: {
        fontSize: 16,
        printFontSize: 12,
        defaultDiscounts: []
      },
      ui: {
        loading: false,
        selectedInvoice: null,
        searchTerm: ''
      }
    };

    this.notifySubscribers('', this.state);
  }

  /**
   * Persists state to localStorage
   * @param {string[]} paths - Paths to persist
   */
  persist(paths = ['settings', 'filters']) {
    const toStore = {};
    paths.forEach(path => {
      const value = this.get(path);
      if (value !== undefined) {
        const initial = this._initialState && this._initialState[path];
        if (initial && value && typeof value === 'object' && !Array.isArray(value)) {
          // compute shallow diff of keys compared to initial
          const diff = {};
          Object.keys(value).forEach(k => {
            try {
              const a = JSON.stringify(value[k]);
              const b = JSON.stringify(initial[k]);
              if (a !== b) {
                diff[k] = value[k];
              }
            } catch (_) {
              if (value[k] !== initial[k]) {
                diff[k] = value[k];
              }
            }
          });
          // only include if non-empty
          if (Object.keys(diff).length > 0) {
            toStore[path] = diff;
          }
        } else {
          // primitive or no initial snapshot -> persist whole value
          toStore[path] = value;
        }
      }
    });

    try {
      const storage = globalThis.localStorage || (typeof window !== 'undefined' && window.localStorage);
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem('app-state', JSON.stringify(toStore));
      }
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }

  /**
   * Restores state from localStorage
   * @param {string[]} paths - Paths to restore
   */
  restore(paths = ['settings', 'filters']) {
    try {
      const storage = globalThis.localStorage || (typeof window !== 'undefined' && window.localStorage);
      const stored = storage && typeof storage.getItem === 'function' ? storage.getItem('app-state') : null;
      if (stored) {
        const parsedState = JSON.parse(stored);
        paths.forEach(path => {
          if (parsedState[path] !== undefined) {
            this.set(path, parsedState[path]);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to restore state:', error);
    }
  }
}

// Global state manager instance
let stateManager = null;

/**
 * Gets or creates the global state manager
 * @returns {StateManager} - State manager instance
 */
function getStateManager() {
  if (!stateManager) {
    stateManager = new StateManager();
  }
  return stateManager;
}

module.exports = {
  StateManager,
  getStateManager
};
