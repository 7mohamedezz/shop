/**
 * Centralized error handling utilities
 */

/**
 * Standard error types for the application
 */
const ErrorTypes = {
  VALIDATION_ERROR: 'ValidationError',
  DATABASE_ERROR: 'DatabaseError',
  NETWORK_ERROR: 'NetworkError',
  PERMISSION_ERROR: 'PermissionError',
  NOT_FOUND_ERROR: 'NotFoundError',
  BUSINESS_LOGIC_ERROR: 'BusinessLogicError'
};

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, type = ErrorTypes.BUSINESS_LOGIC_ERROR, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Formats error messages for display to users
 * @param {Error} error - The error to format
 * @returns {string} - User-friendly error message in Arabic
 */
function formatErrorMessage(error) {
  if (!error) {
    return 'حدث خطأ غير متوقع';
  }

  // Handle validation errors
  if (error.type === ErrorTypes.VALIDATION_ERROR) {
    return error.message || 'بيانات غير صالحة';
  }

  // Handle database errors
  if (error.type === ErrorTypes.DATABASE_ERROR) {
    if (error.message.includes('duplicate')) {
      return 'هذا السجل موجود بالفعل';
    }
    if (error.message.includes('connection')) {
      return 'مشكلة في الاتصال بقاعدة البيانات';
    }
    return 'خطأ في قاعدة البيانات';
  }

  // Handle network errors
  if (error.type === ErrorTypes.NETWORK_ERROR) {
    return 'مشكلة في الاتصال بالشبكة';
  }

  // Handle not found errors
  if (error.type === ErrorTypes.NOT_FOUND_ERROR) {
    return 'العنصر المطلوب غير موجود';
  }

  // Handle permission errors
  if (error.type === ErrorTypes.PERMISSION_ERROR) {
    return 'ليس لديك صلاحية لهذا الإجراء';
  }

  // Default error message
  return error.message || 'حدث خطأ غير متوقع';
}

/**
 * Logs error with appropriate level and context
 * @param {Error} error - The error to log
 * @param {string} context - Additional context about where the error occurred
 */
function logError(error, context = '') {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context,
    message: error.message,
    stack: error.stack,
    type: error.type || 'UnknownError'
  };

  if (error.statusCode >= 500) {
    console.error('🔴 CRITICAL ERROR:', errorInfo);
  } else if (error.statusCode >= 400) {
    console.warn('🟡 CLIENT ERROR:', errorInfo);
  } else {
    console.info('ℹ️ INFO:', errorInfo);
  }
}

/**
 * Wraps async functions to handle errors consistently
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Wrapped function with error handling
 */
function asyncErrorHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, fn.name);

      // Re-throw as AppError if not already one
      if (!(error instanceof AppError)) {
        throw new AppError(formatErrorMessage(error), ErrorTypes.BUSINESS_LOGIC_ERROR, 500, error);
      }

      throw error;
    }
  };
}

/**
 * Creates a standardized error response for IPC handlers
 * @param {Error} error - The error to handle
 * @returns {Object} - Standardized error response
 */
function createErrorResponse(error) {
  logError(error);

  return {
    error: true,
    message: formatErrorMessage(error),
    type: error.type || ErrorTypes.BUSINESS_LOGIC_ERROR,
    timestamp: new Date().toISOString()
  };
}

/**
 * Validates and normalizes ObjectId strings
 * @param {any} id - The ID to validate
 * @returns {string|null} - Normalized ObjectId string or null if invalid
 */
function normalizeId(id) {
  if (!id) {
    return null;
  }

  // Handle different ID formats
  const idString = typeof id === 'object' ? id._id || id.id || String(id) : String(id);

  // Basic ObjectId validation (24 hex characters)
  if (/^[0-9a-fA-F]{24}$/.test(idString)) {
    return idString;
  }

  return null;
}

module.exports = {
  ErrorTypes,
  AppError,
  formatErrorMessage,
  logError,
  asyncErrorHandler,
  createErrorResponse,
  normalizeId
};
