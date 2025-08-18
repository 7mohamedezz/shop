const { getLocalModels } = require('./db');

async function upsertCustomerByPhone(data) {
  const { Customer } = getLocalModels();
  const customer = await Customer.findOneAndUpdate(
    { phone: data.phone },
    { $set: { name: data.name, phone: data.phone } },
    { new: true, upsert: true }
  );
  return customer.toObject();
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

module.exports = { upsertCustomerByPhone, listCustomers, searchCustomers };
