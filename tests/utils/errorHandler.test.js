/**
 * Tests for error handling utilities
 */

const {
  ErrorTypes,
  AppError,
  formatErrorMessage,
  createErrorResponse,
  normalizeId
} = require('../../src/utils/errorHandler');

describe('Error Handler Utilities', () => {

  describe('AppError', () => {
    test('should create AppError with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(ErrorTypes.BUSINESS_LOGIC_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.timestamp).toBeDefined();
    });

    test('should create AppError with custom values', () => {
      const error = new AppError(
        'Validation failed',
        ErrorTypes.VALIDATION_ERROR,
        400,
        { field: 'name' }
      );
      
      expect(error.message).toBe('Validation failed');
      expect(error.type).toBe(ErrorTypes.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'name' });
    });
  });

  describe('formatErrorMessage', () => {
    test('should format validation errors', () => {
      const error = new AppError('Invalid input', ErrorTypes.VALIDATION_ERROR);
      const message = formatErrorMessage(error);
      expect(message).toBe('Invalid input');
    });

    test('should format database errors', () => {
      const error = new AppError('duplicate key error', ErrorTypes.DATABASE_ERROR);
      const message = formatErrorMessage(error);
      expect(message).toBe('هذا السجل موجود بالفعل');
    });

    test('should format network errors', () => {
      const error = new AppError('connection failed', ErrorTypes.NETWORK_ERROR);
      const message = formatErrorMessage(error);
      expect(message).toBe('مشكلة في الاتصال بالشبكة');
    });

    test('should format not found errors', () => {
      const error = new AppError('not found', ErrorTypes.NOT_FOUND_ERROR);
      const message = formatErrorMessage(error);
      expect(message).toBe('العنصر المطلوب غير موجود');
    });

    test('should handle null/undefined errors', () => {
      expect(formatErrorMessage(null)).toBe('حدث خطأ غير متوقع');
      expect(formatErrorMessage(undefined)).toBe('حدث خطأ غير متوقع');
    });

    test('should use error message as fallback', () => {
      const error = new Error('Custom error message');
      const message = formatErrorMessage(error);
      expect(message).toBe('Custom error message');
    });
  });

  describe('createErrorResponse', () => {
    test('should create standardized error response', () => {
      const error = new AppError('Test error', ErrorTypes.VALIDATION_ERROR);
      const response = createErrorResponse(error);
      
      expect(response.error).toBe(true);
      expect(response.message).toBe('Test error');
      expect(response.type).toBe(ErrorTypes.VALIDATION_ERROR);
      expect(response.timestamp).toBeDefined();
    });

    test('should handle regular Error objects', () => {
      const error = new Error('Regular error');
      const response = createErrorResponse(error);
      
      expect(response.error).toBe(true);
      expect(response.message).toBe('Regular error');
      expect(response.type).toBe(ErrorTypes.BUSINESS_LOGIC_ERROR);
    });
  });

  describe('normalizeId', () => {
    test('should normalize valid ObjectId strings', () => {
      const validId = '507f1f77bcf86cd799439011';
      expect(normalizeId(validId)).toBe(validId);
    });

    test('should extract ID from objects', () => {
      const validId = '507f1f77bcf86cd799439011';
      expect(normalizeId({ _id: validId })).toBe(validId);
      expect(normalizeId({ id: validId })).toBe(validId);
    });

    test('should return null for invalid IDs', () => {
      expect(normalizeId('invalid-id')).toBe(null);
      expect(normalizeId('')).toBe(null);
      expect(normalizeId(null)).toBe(null);
      expect(normalizeId(undefined)).toBe(null);
      expect(normalizeId(123)).toBe(null);
    });

    test('should handle mixed case hex strings', () => {
      const mixedCaseId = '507f1F77BCF86cd799439011';
      expect(normalizeId(mixedCaseId)).toBe(mixedCaseId);
    });
  });
});
