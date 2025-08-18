const { getLocalModels } = require('./db');

async function createProduct(data) {
  const { Product } = getLocalModels();
  const created = await Product.create({
    name: data.name,
    category: data.category?.trim() || '',
    buyingPrice: data.buyingPrice ?? data.buy ?? 0,
    sellingPrice: data.sellingPrice ?? data.price ?? 0,
    stock: data.stock ?? 0
  });
  return created.toObject();
}

async function listProducts() {
  const { Product } = getLocalModels();
  return Product.find({}).sort({ createdAt: -1 }).lean();
}

async function searchProductsByNamePrefix(prefix) {
  const { Product } = getLocalModels();
  const rx = new RegExp('^' + (prefix || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return Product.find({ name: { $regex: rx } }).sort({ name: 1 }).limit(20).lean();
}

async function updateProduct(id, update) {
  const { Product } = getLocalModels();
  const mapped = { ...update };
  if (update.price != null) mapped.sellingPrice = update.price; // backward compat
  if (update.buy != null) mapped.buyingPrice = update.buy;
  if (update.category != null) mapped.category = String(update.category).trim();
  return Product.findByIdAndUpdate(id, mapped, { new: true }).lean();
}

async function deleteProduct(id) {
  const { Product } = getLocalModels();
  return Product.findByIdAndDelete(id).lean();
}

module.exports = {
  createProduct,
  listProducts,
  searchProductsByNamePrefix,
  updateProduct,
  deleteProduct
};
