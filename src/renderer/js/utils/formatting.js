/**
 * Formatting utility functions
 */

/**
 * Formats currency values
 * @param {number|string} n - Number to format
 * @returns {string} - Formatted currency string
 */
function currency(n) {
  return Number(n || 0).toFixed(2);
}

/**
 * Formats Gregorian dates
 * @param {Date|string} date - Date to format
 * @param {boolean} withTime - Whether to include time
 * @returns {string} - Formatted date string
 */
function formatGregorian(date, withTime = false) {
  if (!date) {
    return '';
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '';
  }

  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  return d.toLocaleDateString('ar-EG', options);
}

/**
 * Normalizes Arabic/English digits
 * @param {string} str - String with mixed digits
 * @returns {string} - String with normalized digits
 */
function normalizeDigits(str) {
  if (typeof str !== 'string') {
    return '';
  }

  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const englishDigits = '0123456789';

  return str.replace(/[٠-٩]/g, match => {
    return englishDigits[arabicDigits.indexOf(match)];
  });
}

/**
 * Normalizes category names
 * @param {string} name - Category name to normalize
 * @returns {string} - Normalized category name
 */
function normalizeCategory(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Formats file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats phone numbers for display
 * @param {string} phone - Phone number to format
 * @returns {string} - Formatted phone number
 */
function formatPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  const cleaned = phone.replace(/\D/g, '');

  // Egyptian phone number format
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }

  // International format
  if (cleaned.length > 10) {
    return `+${cleaned.slice(0, -10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
  }

  return phone;
}

module.exports = {
  currency,
  formatGregorian,
  normalizeDigits,
  normalizeCategory,
  formatFileSize,
  formatPhone
};
