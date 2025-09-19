/**
 * Tests for validation utilities
 */

const {
  sanitizeHtml,
  isValidEmail,
  isValidPhone,
  validateInput,
  validateProduct,
  validateCustomer
} = require('../../src/utils/validation');

describe('Validation Utilities', () => {
  
  describe('sanitizeHtml', () => {
    test('should sanitize HTML special characters', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    test('should handle empty or non-string input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
      expect(sanitizeHtml(123)).toBe('');
    });

    test('should preserve Arabic text', () => {
      expect(sanitizeHtml('مرحبا بك')).toBe('مرحبا بك');
    });
  });

  describe('isValidEmail', () => {
    test('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@domain.com')).toBe(true);
    });

    test('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    test('should validate phone numbers', () => {
      expect(isValidPhone('01234567890')).toBe(true);
      expect(isValidPhone('+201234567890')).toBe(true);
      expect(isValidPhone('012-345-6789')).toBe(true);
      expect(isValidPhone('012 345 6789')).toBe(true);
    });

    test('should reject invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('abc123')).toBe(false);
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });
  });

  describe('validateInput', () => {
    test('should validate required fields', () => {
      const result = validateInput('', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('هذا الحقل مطلوب');
    });

    test('should validate length constraints', () => {
      const result = validateInput('ab', { minLength: 3 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('3 أحرف على الأقل');
    });

    test('should sanitize input', () => {
      const result = validateInput('<script>test</script>');
      expect(result.value).toBe('&lt;script&gt;test&lt;&#x2F;script&gt;');
    });

    test('should validate with custom pattern', () => {
      const result = validateInput('123', { pattern: /^\d+$/ });
      expect(result.isValid).toBe(true);
      
      const result2 = validateInput('abc', { pattern: /^\d+$/ });
      expect(result2.isValid).toBe(false);
    });
  });

  describe('validateProduct', () => {
    test('should validate valid product data', () => {
      const product = {
        name: 'منتج تجريبي',
        price: 100,
        stock: 50,
        description: 'وصف المنتج',
        category: 'فئة'
      };

      const result = validateProduct(product);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.name).toBe('منتج تجريبي');
    });

    test('should reject invalid product data', () => {
      const product = {
        name: '',
        price: -10,
        stock: -5
      };

      const result = validateProduct(product);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle non-object input', () => {
      const result = validateProduct(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('بيانات المنتج غير صالحة');
    });
  });

  describe('validateCustomer', () => {
    test('should validate valid customer data', () => {
      const customer = {
        name: 'أحمد محمد',
        phone: '01234567890',
        email: 'ahmed@example.com',
        address: 'العنوان'
      };

      const result = validateCustomer(customer);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.name).toBe('أحمد محمد');
    });

    test('should reject invalid customer data', () => {
      const customer = {
        name: '',
        phone: '123'
      };

      const result = validateCustomer(customer);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle missing required fields', () => {
      const result = validateCustomer({});
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('اسم العميل'))).toBe(true);
      expect(result.errors.some(err => err.includes('رقم الهاتف'))).toBe(true);
    });
  });
});
