module.exports = function loadReturnInvoice(connection) {
  const { Schema, Types } = require('mongoose');

  const ReturnItemSchema = new Schema({
    // Legacy name field kept for backward compatibility
    product: { type: String, required: true },
    // New fields to link to original invoice/product precisely
    productId: { type: Types.ObjectId, ref: 'Product' },
    productName: { type: String },
    qty: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 }
  }, { _id: false });

  const ReturnInvoiceSchema = new Schema({
    originalInvoice: { type: Types.ObjectId, ref: 'Invoice', required: true },
    items: { type: [ReturnItemSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
  });

  return connection.models.ReturnInvoice || connection.model('ReturnInvoice', ReturnInvoiceSchema);
};
