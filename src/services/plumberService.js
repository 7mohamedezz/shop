const { getLocalModels } = require('../database/db');

async function upsertPlumber(data) {
  const { Plumber } = getLocalModels();
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();

  if (!name) {
    throw new Error('اسم السباك مطلوب.');
  }

  try {
    // If phone is provided, check for existing plumber with this phone (including deleted)
    if (phone) {
      const existingByPhone = await Plumber.findOne({ phone: phone }).lean();
      if (existingByPhone) {
        if (existingByPhone.isDeleted) {
          // Undelete and update the plumber with new information
          console.log('🔄 Undeleting plumber with phone:', phone, 'and updating name to:', name);
          const updated = await Plumber.findByIdAndUpdate(
            existingByPhone._id,
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
        } else if (existingByPhone.name !== name) {
          // Active plumber exists with this phone but different name
          throw new Error(`رقم الهاتف ${phone} مسجل بالفعل لسباك آخر.`);
        }
      }
    }

    // Check for existing plumber by name (including deleted)
    const existingByName = await Plumber.findOne({ name: name }).lean();
    if (existingByName) {
      if (existingByName.isDeleted) {
        // Undelete and update the plumber
        console.log('🔄 Undeleting plumber with name:', name, 'and updating phone to:', phone);
        const updated = await Plumber.findByIdAndUpdate(
          existingByName._id,
          { 
            name, 
            phone: phone || '',
            isDeleted: false, 
            deletedAt: null,
            updatedAt: new Date()
          },
          { new: true }
        ).lean();
        return updated;
      } else {
        // Update existing active plumber
        const updated = await Plumber.findByIdAndUpdate(
          existingByName._id,
          { name, phone: phone || '' },
          { new: true }
        ).lean();
        return updated;
      }
    }

    // No existing plumber, create new one
    const created = await Plumber.create({ name, phone: phone || '' });
    return created.toObject();
  } catch (err) {
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      throw new Error('رقم الهاتف مستخدم بالفعل');
    }
    throw err;
  }
}

async function listPlumbers() {
  const { Plumber } = getLocalModels();
  return Plumber.find({ isDeleted: { $ne: true } }).sort({ name: 1 }).lean();
}

async function searchPlumbers(prefix) {
  const { Plumber } = getLocalModels();
  const p = String(prefix || '').trim();
  const rx = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return Plumber.find({ 
    $or: [{ name: { $regex: rx } }, { phone: { $regex: rx } }],
    isDeleted: { $ne: true }
  })
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
  const doc = await Plumber.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  ).lean();
  return doc;
}

async function getPlumberById(id, includeDeleted = false) {
  const { Plumber } = getLocalModels();
  const query = { _id: id };
  if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }
  const doc = await Plumber.findOne(query).lean();
  return doc;
}

async function getPlumbersByIds(ids, includeDeleted = false) {
  const { Plumber } = getLocalModels();
  const query = { _id: { $in: ids } };
  if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }
  const docs = await Plumber.find(query).lean();
  return docs;
}

module.exports = { 
  upsertPlumber, 
  listPlumbers, 
  searchPlumbers, 
  updatePlumber, 
  deletePlumber,
  getPlumberById,
  getPlumbersByIds
};
