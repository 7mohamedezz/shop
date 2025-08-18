const { getLocalModels } = require('./db');

async function upsertPlumberByName(data) {
  const { Plumber } = getLocalModels();
  const plumber = await Plumber.findOneAndUpdate(
    { name: data.name },
    { $set: { name: data.name, phone: data.phone || '' } },
    { new: true, upsert: true }
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

module.exports = { upsertPlumberByName, listPlumbers, searchPlumbers };
