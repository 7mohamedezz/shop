const { getLocalModels } = require('../database/db');

async function upsertCustomerByPhone(data) {
  const { Customer } = getLocalModels();
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  if (!phone) {
    throw new Error('رقم الهاتف مطلوب');
  }
  if (!name) {
    throw new Error('الاسم مطلوب');
  }
  try {
    // Check for existing customer including deleted ones
    const existing = await Customer.findOne({ phone }).lean();
    if (existing) {
      if (existing.isDeleted) {
        // Undelete and update the customer with new information
        console.log('🔄 Undeleting customer with phone:', phone, 'and updating name to:', name);
        const updated = await Customer.findByIdAndUpdate(
          existing._id,
          { 
            name, 
            phone,
            isDeleted: false, 
            deletedAt: null,
            updatedAt: new Date()
          },
          { new: true }
        ).lean();
        return updated;
      } else {
        // Active customer exists with this phone
        throw new Error('رقم الهاتف مستخدم بالفعل');
      }
    }
    // No existing customer, create new one
    const created = await Customer.create({ name, phone });
    return created.toObject();
  } catch (err) {
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      throw new Error('رقم الهاتف مستخدم بالفعل');
    }
    throw err;
  }
}

async function listCustomers() {
  const { Customer } = getLocalModels();
  return Customer.find({ isDeleted: { $ne: true } }).sort({ name: 1 }).lean();
}

async function searchCustomers(prefix) {
  const { Customer } = getLocalModels();
  const p = String(prefix || '').trim();
  const rx = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return Customer.find({ 
    $or: [{ name: { $regex: rx } }, { phone: { $regex: rx } }],
    isDeleted: { $ne: true }
  })
    .sort({ name: 1 })
    .limit(20)
    .lean();
}

async function updateCustomer(id, data) {
  const { Customer } = getLocalModels();
  const update = { name: String(data.name || '').trim(), phone: String(data.phone || '').trim() };
  try {
    const doc = await Customer.findByIdAndUpdate(id, update, { new: true }).lean();
    return doc;
  } catch (err) {
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      throw new Error('رقم الهاتف مستخدم بالفعل');
    }
    throw err;
  }
}

async function deleteCustomer(id) {
  const { Customer } = getLocalModels();
  const doc = await Customer.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  ).lean();
  return doc;
}

async function getCustomerById(id, includeDeleted = false) {
  const { Customer } = getLocalModels();
  const query = { _id: id };
  if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }
  const doc = await Customer.findOne(query).lean();
  return doc;
}

async function getCustomersByIds(ids, includeDeleted = false) {
  const { Customer } = getLocalModels();
  const query = { _id: { $in: ids } };
  if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }
  const docs = await Customer.find(query).lean();
  return docs;
}

module.exports = { 
  upsertCustomerByPhone, 
  listCustomers, 
  searchCustomers, 
  updateCustomer, 
  deleteCustomer,
  getCustomerById,
  getCustomersByIds
};
