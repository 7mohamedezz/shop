const { getLocalModels } = require('./db');

function serialize(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  return { ...obj, _id: String(obj._id) };
}

async function createProduct(data) {
  const { Product } = getLocalModels();
  const created = await Product.create({
    name: data.name,
    category: data.category?.trim() || '',
    buyingPrice: data.buyingPrice ?? data.buy ?? 0,
    sellingPrice: data.sellingPrice ?? data.price ?? 0,
    stock: data.stock ?? 0
  });
  return serialize(created);
}

async function listProducts() {
  const { Product } = getLocalModels();
  const docs = await Product.find({}).sort({ createdAt: -1 }).lean();
  return docs.map(serialize);
}

async function searchProductsByNamePrefix(prefix) {
  const { Product } = getLocalModels();
  const rx = new RegExp('^' + (prefix || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const docs = await Product.find({ name: { $regex: rx } }).sort({ name: 1 }).limit(20).lean();
  return docs.map(serialize);
}

async function updateProduct(id, update) {
  const { Product } = getLocalModels();
  const mapped = { ...update };
  if (update.price != null) mapped.sellingPrice = update.price; // backward compat
  if (update.buy != null) mapped.buyingPrice = update.buy;
  if (update.category != null) mapped.category = String(update.category).trim();
  const doc = await Product.findByIdAndUpdate(id, mapped, { new: true }).lean();
  return serialize(doc);
}

async function deleteProduct(id) {
  const { Product } = getLocalModels();
  const doc = await Product.findByIdAndDelete(id).lean();
  return serialize(doc);
}

module.exports = {
  createProduct,
  listProducts,
  searchProductsByNamePrefix,
  updateProduct,
  deleteProduct
};
