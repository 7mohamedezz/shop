/**
 * API service for safe IPC communication
 */

const { showErrorMessage } = require('../components/Notification');
const { showLoadingState, hideLoadingState } = require('../utils/dom');

class ApiService {
  constructor() {
    this.isOnline = true;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  /**
   * Makes a safe API call with error handling and loading states
   * @param {Function} apiCall - The API call function
   * @param {string} errorContext - Context for error messages
   * @param {HTMLElement} loadingElement - Element to show loading state on
   * @param {boolean} showSuccessMessage - Whether to show success message
   * @returns {Promise<any>} - API response or null on error
   */
  async safeCall(apiCall, errorContext = '', loadingElement = null, showSuccessMessage = false) {
    if (loadingElement) {
      showLoadingState(loadingElement);
    }

    try {
      const result = await this.retryCall(apiCall);

      if (result && result.error) {
        throw new Error(result.message || 'Unknown error occurred');
      }

      if (showSuccessMessage) {
        showErrorMessage('تم بنجاح', 'success');
      }

      return result;
    } catch (error) {
      console.error(`API Error in ${errorContext}:`, error);

      const message = this.getErrorMessage(error, errorContext);
      showErrorMessage(message, 'error');

      return null;
    } finally {
      if (loadingElement) {
        hideLoadingState(loadingElement);
      }
    }
  }

  /**
   * Retries an API call with exponential backoff
   * @param {Function} apiCall - The API call function
   * @param {number} attempt - Current attempt number
   * @returns {Promise<any>} - API response
   */
  async retryCall(apiCall, attempt = 1) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt < this.retryAttempts && this.isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        return this.retryCall(apiCall, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Determines if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether the error is retryable
   */
  isRetryableError(error) {
    const retryableMessages = ['network', 'timeout', 'connection', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'];

    const message = error.message.toLowerCase();
    return retryableMessages.some(msg => message.includes(msg));
  }

  /**
   * Gets user-friendly error message
   * @param {Error} error - The error object
   * @param {string} context - Error context
   * @returns {string} - User-friendly error message
   */
  getErrorMessage(error, context) {
    const message = error.message || 'Unknown error';

    // Network errors
    if (message.includes('fetch') || message.includes('network')) {
      return 'مشكلة في الاتصال. تحقق من الشبكة وحاول مرة أخرى.';
    }

    // Database errors
    if (message.includes('database') || message.includes('mongodb')) {
      return 'مشكلة في قاعدة البيانات. تحقق من الاتصال.';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('required')) {
      return message; // Already in Arabic from validation
    }

    // Default error with context
    return context ? `خطأ في ${context}: ${message}` : message;
  }

  /**
   * Sleep utility for delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Product API methods
   */
  async createProduct(productData) {
    return this.safeCall(() => window.electronAPI.invoke('products:create', productData), 'إنشاء المنتج');
  }

  async updateProduct(id, updateData) {
    return this.safeCall(
      () => window.electronAPI.invoke('products:update', { id, update: updateData }),
      'تحديث المنتج'
    );
  }

  async deleteProduct(id) {
    return this.safeCall(() => window.electronAPI.invoke('products:delete', id), 'حذف المنتج');
  }

  async searchProducts(prefix) {
    return this.safeCall(() => window.electronAPI.invoke('products:search', prefix), 'البحث في المنتجات');
  }

  async listProducts() {
    return this.safeCall(() => window.electronAPI.invoke('products:list'), 'جلب قائمة المنتجات');
  }

  async listLowStockProducts() {
    return this.safeCall(() => window.electronAPI.invoke('products:lowStock'), 'جلب المنتجات قليلة المخزون');
  }

  /**
   * Customer API methods
   */
  async upsertCustomer(customerData) {
    return this.safeCall(() => window.electronAPI.invoke('customers:upsert', customerData), 'حفظ بيانات العميل');
  }

  async updateCustomer(id, data) {
    return this.safeCall(() => window.electronAPI.invoke('customers:update', { id, data }), 'تحديث بيانات العميل');
  }

  async deleteCustomer(id) {
    return this.safeCall(() => window.electronAPI.invoke('customers:delete', id), 'حذف العميل');
  }

  async searchCustomers(prefix) {
    return this.safeCall(() => window.electronAPI.invoke('customers:search', prefix), 'البحث في العملاء');
  }

  async listCustomers() {
    return this.safeCall(() => window.electronAPI.invoke('customers:list'), 'جلب قائمة العملاء');
  }

  /**
   * Invoice API methods
   */
  async createInvoice(invoiceData) {
    return this.safeCall(() => window.electronAPI.invoke('invoices:create', invoiceData), 'إنشاء الفاتورة');
  }

  async updateInvoice(invoiceId, updateData) {
    return this.safeCall(
      () => window.electronAPI.invoke('invoices:update', { invoiceId, updateData }),
      'تحديث الفاتورة'
    );
  }

  async addPayment(invoiceId, payment) {
    return this.safeCall(() => window.electronAPI.invoke('invoices:addPayment', { invoiceId, payment }), 'إضافة دفعة');
  }

  async listInvoices(filters = {}) {
    return this.safeCall(() => window.electronAPI.invoke('invoices:list', filters), 'جلب قائمة الفواتير');
  }

  async getInvoiceById(id) {
    return this.safeCall(() => window.electronAPI.invoke('invoices:getById', id), 'جلب تفاصيل الفاتورة');
  }

  async printInvoice(invoiceId, fontSize) {
    return this.safeCall(() => window.electronAPI.invoke('print:invoice', { invoiceId, fontSize }), 'طباعة الفاتورة');
  }
}

// Global API service instance
let apiService = null;

/**
 * Gets or creates the global API service
 * @returns {ApiService} - API service instance
 */
function getApiService() {
  if (!apiService) {
    apiService = new ApiService();
  }
  return apiService;
}

module.exports = {
  ApiService,
  getApiService
};
