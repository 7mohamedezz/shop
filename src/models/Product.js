module.exports = function loadProduct(connection) {
  const { Schema } = require('mongoose');
  const ProductSchema = new Schema({
    name: { type: String, required: true, trim: true },
    category: { type: String, default: '', trim: true },
    buyingPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0, default: 0 },
    stock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 }
  }, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

  // Backwards compatibility: expose price as sellingPrice
  ProductSchema.virtual('price').get(function () { return this.sellingPrice; });

  ProductSchema.index({ name: 1 });
  ProductSchema.index({ category: 1 });
  ProductSchema.index({ stock: 1 });

  return connection.models.Product || connection.model('Product', ProductSchema);
};
