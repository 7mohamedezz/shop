/**
 * Input validation utilities
 */

/**
 * Sanitizes HTML input to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeHtml(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates phone number (supports Arabic/International formats)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone format
 */
function isValidPhone(phone) {
  if (typeof phone !== 'string') {
    return false;
  }
  // Allow digits, spaces, dashes, plus sign, parentheses
  const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Validates and sanitizes user input
 * @param {string} input - Input to validate
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum length
 * @param {number} options.maxLength - Maximum length
 * @param {boolean} options.required - Whether input is required
 * @param {RegExp} options.pattern - Custom pattern to match
 * @returns {Object} - Validation result with isValid and sanitized value
 */
function validateInput(input, options = {}) {
  const { minLength = 0, maxLength = 1000, required = false, pattern = null } = options;

  const sanitized = sanitizeHtml(String(input || '').trim());

  const result = {
    isValid: true,
    value: sanitized,
    errors: []
  };

  // Required check
  if (required && !sanitized) {
    result.isValid = false;
    result.errors.push('هذا الحقل مطلوب');
    return result;
  }

  // Skip other validations if empty and not required
  if (!sanitized && !required) {
    return result;
  }

  // Length validation
  if (sanitized.length < minLength) {
    result.isValid = false;
    result.errors.push(`يجب أن يكون الطول ${minLength} أحرف على الأقل`);
  }

  if (sanitized.length > maxLength) {
    result.isValid = false;
    result.errors.push(`يجب أن لا يتجاوز الطول ${maxLength} حرف`);
  }

  // Pattern validation
  if (pattern && !pattern.test(sanitized)) {
    result.isValid = false;
    result.errors.push('تنسيق غير صالح');
  }

  return result;
}

/**
 * Validates product data
 * @param {Object} product - Product data to validate
 * @returns {Object} - Validation result
 */
function validateProduct(product) {
  const errors = [];

  if (!product || typeof product !== 'object') {
    return { isValid: false, errors: ['بيانات المنتج غير صالحة'] };
  }

  // Name validation
  const nameValidation = validateInput(product.name, {
    required: true,
    minLength: 2,
    maxLength: 200
  });
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors.map(err => `اسم المنتج: ${err}`));
  }

  // Price validation - check both price and sellingPrice fields
  const price = Number(product.price || product.sellingPrice);
  if (isNaN(price) || price < 0) {
    errors.push('سعر المنتج يجب أن يكون رقم موجب');
  }
  
  // Buying price validation (optional)
  const buyingPrice = Number(product.buyingPrice || 0);
  if (product.buyingPrice !== undefined && (isNaN(buyingPrice) || buyingPrice < 0)) {
    errors.push('سعر الشراء يجب أن يكون رقم موجب');
  }

  // Stock validation
  const stock = Number(product.stock);
  if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
    errors.push('المخزون يجب أن يكون رقم صحيح موجب');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      name: nameValidation.value,
      price: Math.max(0, price),
      sellingPrice: Math.max(0, price),
      buyingPrice: Math.max(0, buyingPrice),
      stock: Math.max(0, Math.floor(stock)),
      reorderLevel: Math.max(0, Number(product.reorderLevel || 0)),
      description: sanitizeHtml(String(product.description || '')),
      category: sanitizeHtml(String(product.category || ''))
    }
  };
}

/**
 * Validates customer data
 * @param {Object} customer - Customer data to validate
 * @returns {Object} - Validation result
 */
function validateCustomer(customer) {
  const errors = [];

  if (!customer || typeof customer !== 'object') {
    return { isValid: false, errors: ['بيانات العميل غير صالحة'] };
  }

  // Name validation
  const nameValidation = validateInput(customer.name, {
    required: true,
    minLength: 2,
    maxLength: 100
  });
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors.map(err => `اسم العميل: ${err}`));
  }

  // Phone validation
  const phoneValidation = validateInput(customer.phone, {
    required: true,
    minLength: 7,
    maxLength: 20
  });
  if (!phoneValidation.isValid) {
    errors.push(...phoneValidation.errors.map(err => `رقم الهاتف: ${err}`));
  } else if (!isValidPhone(phoneValidation.value)) {
    errors.push('تنسيق رقم الهاتف غير صالح');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      name: nameValidation.value,
      phone: phoneValidation.value,
      email: customer.email ? (isValidEmail(customer.email) ? customer.email : '') : '',
      address: sanitizeHtml(String(customer.address || ''))
    }
  };
}

module.exports = {
  sanitizeHtml,
  isValidEmail,
  isValidPhone,
  validateInput,
  validateProduct,
  validateCustomer
};
