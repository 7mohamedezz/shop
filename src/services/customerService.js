const { getLocalModels } = require('../database/db');

async function upsertCustomerByPhone(data) {
  const { Customer } = getLocalModels();
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  if (!phone) throw new Error('رقم الهاتف مطلوب');
  if (!name) throw new Error('الاسم مطلوب');
  try {
    const existing = await Customer.findOne({ phone }).lean();
    if (existing) {
      // لا تقم بالاستبدال عند التكرار
      throw new Error('رقم الهاتف مستخدم بالفعل');
    }
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
  return Customer.find({}).sort({ name: 1 }).lean();
}

async function searchCustomers(prefix) {
  const { Customer } = getLocalModels();
  const p = String(prefix || '').trim();
  const rx = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return Customer.find({ $or: [{ name: { $regex: rx } }, { phone: { $regex: rx } }] })
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
  const doc = await Customer.findByIdAndDelete(id).lean();
  return doc;
}

module.exports = { upsertCustomerByPhone, listCustomers, searchCustomers, updateCustomer, deleteCustomer };
