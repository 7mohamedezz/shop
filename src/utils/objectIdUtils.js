const { Types } = require('mongoose');

/**
 * Converts any input to a valid ObjectId string
 * @param {*} id - The input ID (string, object, ObjectId, etc.)
 * @returns {string|null} - Valid ObjectId string or null if invalid
 */
function toObjectIdString(id) {
  if (!id) {
    return null;
  }

  // If it's already a string, validate and return
  if (typeof id === 'string') {
    const trimmedId = id.trim();
    if (Types.ObjectId.isValid(trimmedId)) {
      return trimmedId;
    }
    // Try to extract a 24-hex substring from wrappers like ObjectId("...")
    const match = trimmedId.match(/[a-fA-F0-9]{24}/);
    if (match && Types.ObjectId.isValid(match[0])) {
      return match[0];
    }
    return null;
  }

  // If it's an object, try to extract the ID
  if (typeof id === 'object' && id !== null) {
    // Try toString() method (works for MongoDB ObjectId)
    if (id.toString && typeof id.toString === 'function') {
      const stringId = id.toString().trim();
      return Types.ObjectId.isValid(stringId) ? stringId : null;
    }

    // Try _id property
    if (id._id) {
      return toObjectIdString(id._id);
    }

    // Try id property
    if (id.id) {
      return toObjectIdString(id.id);
    }

    // Last resort: convert to string
    const stringId = String(id).trim();
    return Types.ObjectId.isValid(stringId) ? stringId : null;
  }

  // Convert anything else to string and validate
  const stringId = String(id).trim();
  return Types.ObjectId.isValid(stringId) ? stringId : null;
}

/**
 * Safely finds a document by ID with proper ObjectId conversion
 * @param {Model} Model - Mongoose model
 * @param {*} id - The ID to search for
 * @param {Object} options - Query options (populate, lean, etc.)
 * @returns {Promise} - Query result or null
 */
async function findByIdSafe(Model, id, options = {}) {
  const validId = toObjectIdString(id);
  if (!validId) {
    return null;
  }

  let query = Model.findById(validId);

  if (options.populate) {
    if (Array.isArray(options.populate)) {
      options.populate.forEach(pop => (query = query.populate(pop)));
    } else {
      query = query.populate(options.populate);
    }
  }

  if (options.lean) {
    query = query.lean();
  }

  return await query;
}

module.exports = {
  toObjectIdString,
  findByIdSafe
};
