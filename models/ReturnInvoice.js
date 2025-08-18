module.exports = function loadReturnInvoice(connection) {
  const { Schema, Types } = require('mongoose');

  const ReturnItemSchema = new Schema({
    product: { type: String, required: true },
    qty: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' }
  }, { _id: false });

  const ReturnInvoiceSchema = new Schema({
    originalInvoice: { type: Types.ObjectId, ref: 'Invoice', required: true },
    items: { type: [ReturnItemSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
  });

  return connection.models.ReturnInvoice || connection.model('ReturnInvoice', ReturnInvoiceSchema);
};
