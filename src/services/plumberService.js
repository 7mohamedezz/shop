const { getLocalModels } = require('../database/db');

async function upsertPlumber(data) {
  const { Plumber } = getLocalModels();
  const { name, phone } = data;

  if (!name) {
    throw new Error('اسم السباك مطلوب.');
  }

  // If a phone number is provided, check if it already exists
  if (phone) {
    const existing = await Plumber.findOne({ phone: phone }).lean();
    // If a plumber with this phone exists and it's not the same plumber we might be updating
    if (existing && existing.name !== name) {
      throw new Error(`رقم الهاتف ${phone} مسجل بالفعل لسباك آخر.`);
    }
  }

  // Try to find a plumber by name to update, or create a new one
  const plumber = await Plumber.findOneAndUpdate(
    { name: name },
    { $set: { name, phone: phone || '' } },
    { new: true, upsert: true, runValidators: true, context: 'query' }
  );

  return plumber.toObject();
}

async function listPlumbers() {
  const { Plumber } = getLocalModels();
  return Plumber.find({}).sort({ name: 1 }).lean();
}

async function searchPlumbers(prefix) {
  const { Plumber } = getLocalModels();
  const p = String(prefix || '').trim();
  const rx = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return Plumber.find({ $or: [{ name: { $regex: rx } }, { phone: { $regex: rx } }] })
    .sort({ name: 1 })
    .limit(20)
    .lean();
}

async function updatePlumber(id, data) {
  const { Plumber } = getLocalModels();
  const update = { name: data.name, phone: data.phone || '' };
  const doc = await Plumber.findByIdAndUpdate(id, update, { new: true }).lean();
  return doc;
}

async function deletePlumber(id) {
  const { Plumber } = getLocalModels();
  const doc = await Plumber.findByIdAndDelete(id).lean();
  return doc;
}

module.exports = { upsertPlumber, listPlumbers, searchPlumbers, updatePlumber, deletePlumber };
