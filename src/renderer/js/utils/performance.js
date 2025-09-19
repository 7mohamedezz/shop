/**
 * Performance optimization utilities
 */

/**
 * Virtual scrolling implementation for large lists
 */
class VirtualScroller {
  constructor(container, itemHeight, renderItem, getItemCount) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.getItemCount = getItemCount;

    this.scrollTop = 0;
    this.visibleItems = new Map();
    this.itemPool = [];

    this.init();
  }

  init() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';

    this.viewport = document.createElement('div');
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0';
    this.viewport.style.left = '0';
    this.viewport.style.right = '0';
    this.container.appendChild(this.viewport);

    this.container.addEventListener('scroll', this.handleScroll.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this));

    this.update();
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.update();
  }

  handleResize() {
    this.update();
  }

  update() {
    const itemCount = this.getItemCount();
    const containerHeight = this.container.clientHeight;
    const totalHeight = itemCount * this.itemHeight;

    // Set container height
    this.container.style.height = totalHeight + 'px';

    // Calculate visible range
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(itemCount - 1, Math.ceil((this.scrollTop + containerHeight) / this.itemHeight));

    // Remove items outside visible range
    for (const [index, element] of this.visibleItems) {
      if (index < startIndex || index > endIndex) {
        this.returnItemToPool(element);
        this.visibleItems.delete(index);
      }
    }

    // Add items in visible range
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.visibleItems.has(i)) {
        const element = this.getItemFromPool();
        element.style.position = 'absolute';
        element.style.top = i * this.itemHeight + 'px';
        element.style.left = '0';
        element.style.right = '0';
        element.style.height = this.itemHeight + 'px';

        this.renderItem(element, i);
        this.viewport.appendChild(element);
        this.visibleItems.set(i, element);
      }
    }
  }

  getItemFromPool() {
    if (this.itemPool.length > 0) {
      return this.itemPool.pop();
    }

    const element = document.createElement('div');
    element.className = 'virtual-scroll-item';
    return element;
  }

  returnItemToPool(element) {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
    this.itemPool.push(element);
  }

  scrollToIndex(index) {
    const targetScrollTop = index * this.itemHeight;
    this.container.scrollTop = targetScrollTop;
  }

  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);

    // Clean up DOM
    if (this.viewport.parentNode) {
      this.viewport.parentNode.removeChild(this.viewport);
    }

    this.visibleItems.clear();
    this.itemPool = [];
  }
}

/**
 * Pagination utility for large datasets
 */
class Paginator {
  constructor(pageSize = 50) {
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.totalItems = 0;
    this.data = [];
    this.filteredData = [];
    this.filters = {};
    this.sortConfig = { key: null, direction: 'asc' };
  }

  setData(data) {
    this.data = [...data];
    this.applyFiltersAndSort();
    return this;
  }

  setFilters(filters) {
    this.filters = { ...filters };
    this.currentPage = 1; // Reset to first page
    this.applyFiltersAndSort();
    return this;
  }

  setSort(key, direction = 'asc') {
    this.sortConfig = { key, direction };
    this.applyFiltersAndSort();
    return this;
  }

  applyFiltersAndSort() {
    let filtered = [...this.data];

    // Apply filters
    Object.entries(this.filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        filtered = filtered.filter(item => {
          const itemValue = this.getNestedValue(item, key);
          if (typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(String(value).toLowerCase());
          }
          return itemValue === value;
        });
      }
    });

    // Apply sorting
    if (this.sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = this.getNestedValue(a, this.sortConfig.key);
        const bVal = this.getNestedValue(b, this.sortConfig.key);

        let comparison = 0;
        if (aVal > bVal) {
          comparison = 1;
        }
        if (aVal < bVal) {
          comparison = -1;
        }

        return this.sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    this.filteredData = filtered;
    this.totalItems = filtered.length;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  getCurrentPageData() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredData.slice(startIndex, endIndex);
  }

  getTotalPages() {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  hasNextPage() {
    return this.currentPage < this.getTotalPages();
  }

  hasPreviousPage() {
    return this.currentPage > 1;
  }

  nextPage() {
    if (this.hasNextPage()) {
      this.currentPage++;
    }
    return this;
  }

  previousPage() {
    if (this.hasPreviousPage()) {
      this.currentPage--;
    }
    return this;
  }

  goToPage(page) {
    const totalPages = this.getTotalPages();
    this.currentPage = Math.max(1, Math.min(page, totalPages));
    return this;
  }

  getPageInfo() {
    return {
      currentPage: this.currentPage,
      totalPages: this.getTotalPages(),
      totalItems: this.totalItems,
      pageSize: this.pageSize,
      startIndex: (this.currentPage - 1) * this.pageSize + 1,
      endIndex: Math.min(this.currentPage * this.pageSize, this.totalItems)
    };
  }
}

/**
 * Simple cache implementation with TTL support
 */
class Cache {
  constructor(defaultTTL = 300000) {
    // 5 minutes default
    this.cache = new Map();
    this.timers = new Map();
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.cache.set(key, value);

    // Set expiration timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }

    return this;
  }

  get(key) {
    return this.cache.get(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.cache.keys());
  }
}

/**
 * Request deduplication utility
 */
class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  async dedupe(key, requestFn) {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Create new request promise
    const promise = requestFn().finally(() => {
      // Clean up when request completes
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear() {
    this.pendingRequests.clear();
  }
}

/**
 * Memory usage monitor
 */
class MemoryMonitor {
  constructor() {
    this.observers = new Set();
    this.isMonitoring = false;
  }

  start(interval = 30000) {
    // Check every 30 seconds
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, interval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
  }

  checkMemoryUsage() {
    if (window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      const usage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };

      this.notifyObservers(usage);

      // Warn if memory usage is high
      if (usage.percentage > 80) {
        console.warn('High memory usage detected:', usage);
      }
    }
  }

  addObserver(callback) {
    this.observers.add(callback);
  }

  removeObserver(callback) {
    this.observers.delete(callback);
  }

  notifyObservers(usage) {
    this.observers.forEach(callback => {
      try {
        callback(usage);
      } catch (error) {
        console.error('Error in memory observer:', error);
      }
    });
  }
}

module.exports = {
  VirtualScroller,
  Paginator,
  Cache,
  RequestDeduplicator,
  MemoryMonitor
};
