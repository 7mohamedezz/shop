/**
 * Tests for StateManager
 */

const { StateManager } = require('../../src/renderer/js/services/StateManager');

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get and set', () => {
    test('should get and set simple values', () => {
      stateManager.set('test', 'value');
      expect(stateManager.get('test')).toBe('value');
    });

    test('should get and set nested values', () => {
      stateManager.set('user.name', 'أحمد');
      stateManager.set('user.age', 30);
      
      expect(stateManager.get('user.name')).toBe('أحمد');
      expect(stateManager.get('user.age')).toBe(30);
      expect(stateManager.get('user')).toEqual({ name: 'أحمد', age: 30 });
    });

    test('should return undefined for non-existent paths', () => {
      expect(stateManager.get('nonexistent')).toBeUndefined();
      expect(stateManager.get('nested.path')).toBeUndefined();
    });

    test('should get entire state when no path provided', () => {
      const state = stateManager.get();
      expect(state).toBeDefined();
      expect(state.currentTab).toBe('invoices');
    });
  });

  describe('update', () => {
    test('should merge objects', () => {
      stateManager.set('user', { name: 'أحمد', age: 30 });
      stateManager.update('user', { email: 'ahmed@example.com' });
      
      expect(stateManager.get('user')).toEqual({
        name: 'أحمد',
        age: 30,
        email: 'ahmed@example.com'
      });
    });

    test('should replace primitive values', () => {
      stateManager.set('count', 5);
      stateManager.update('count', 10);
      
      expect(stateManager.get('count')).toBe(10);
    });
  });

  describe('subscribe and unsubscribe', () => {
    test('should notify subscribers on state changes', () => {
      const callback = jest.fn();
      const subscriptionId = stateManager.subscribe('user.name', callback);
      
      stateManager.set('user.name', 'محمد');
      
      expect(callback).toHaveBeenCalledWith('محمد', 'user.name');
    });

    test('should notify parent path subscribers', () => {
      const parentCallback = jest.fn();
      const childCallback = jest.fn();
      
      stateManager.subscribe('user', parentCallback);
      stateManager.subscribe('user.name', childCallback);
      
      stateManager.set('user.name', 'علي');
      
      expect(childCallback).toHaveBeenCalledWith('علي', 'user.name');
      expect(parentCallback).toHaveBeenCalled();
    });

    test('should unsubscribe properly', () => {
      const callback = jest.fn();
      const subscriptionId = stateManager.subscribe('test', callback);
      
      stateManager.unsubscribe(subscriptionId);
      stateManager.set('test', 'value');
      
      expect(callback).not.toHaveBeenCalled();
    });

    test('should handle errors in subscribers gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = jest.fn();
      
      stateManager.subscribe('test', errorCallback);
      stateManager.subscribe('test', normalCallback);
      
      // Should not throw
      expect(() => {
        stateManager.set('test', 'value');
      }).not.toThrow();
      
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('persist and restore', () => {
    test('should persist specified paths', () => {
      stateManager.set('settings.fontSize', 18);
      stateManager.set('filters.status', 'active');
      stateManager.set('temporary', 'should not persist');
      
      stateManager.persist(['settings', 'filters']);
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'app-state',
        JSON.stringify({
          settings: { fontSize: 18 },
          filters: { status: 'active' }
        })
      );
    });

    test('should restore from localStorage', () => {
      const storedData = {
        settings: { fontSize: 20 },
        filters: { status: 'inactive' }
      };
      
      window.localStorage.getItem.mockReturnValue(JSON.stringify(storedData));
      
      stateManager.restore(['settings', 'filters']);
      
      expect(stateManager.get('settings.fontSize')).toBe(20);
      expect(stateManager.get('filters.status')).toBe('inactive');
    });

    test('should handle restore errors gracefully', () => {
      window.localStorage.getItem.mockReturnValue('invalid json');
      
      expect(() => {
        stateManager.restore();
      }).not.toThrow();
    });
  });

  describe('reset', () => {
    test('should reset state to initial values', () => {
      stateManager.set('custom', 'value');
      stateManager.reset();
      
      expect(stateManager.get('custom')).toBeUndefined();
      expect(stateManager.get('currentTab')).toBe('invoices');
    });

    test('should notify subscribers on reset', () => {
      const callback = jest.fn();
      stateManager.subscribe('', callback);
      
      stateManager.reset();
      
      expect(callback).toHaveBeenCalled();
    });
  });
});
