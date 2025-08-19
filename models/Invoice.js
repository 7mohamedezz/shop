module.exports = function loadInvoice(connection) {
  const { Schema, Types } = require('mongoose');

  const InvoiceItemSchema = new Schema({
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    buyingPrice: { type: Number, default: 0, min: 0 },
    category: { type: String, default: '' },
    discountedPrice: { type: Number, default: null }
  }, { _id: false });

  const PaymentSchema = new Schema({
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }, { _id: false });

  const InvoiceSchema = new Schema({
    invoiceNumber: { type: Number, unique: true },
    customer: { type: Types.ObjectId, ref: 'Customer', required: true },
    plumberName: { type: String, default: '' },
    items: { type: [InvoiceItemSchema], default: [] },
    payments: { type: [PaymentSchema], default: [] },
    total: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    archived: { type: Boolean, default: false },
    discountAbogaliPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountBrPercent: { type: Number, default: 0, min: 0, max: 100 }
  }, { timestamps: true });

  // Auto-increment invoice number
  InvoiceSchema.pre('save', async function (next) {
    if (this.isNew && !this.invoiceNumber) {
      try {
        const lastInvoice = await this.constructor.findOne({}, {}, { sort: { invoiceNumber: -1 } });
        this.invoiceNumber = lastInvoice ? lastInvoice.invoiceNumber + 1 : 1001;
      } catch (error) {
        console.error('Error generating invoice number:', error);
        this.invoiceNumber = Date.now() % 100000; // Fallback
      }
    }
    next();
  });

  InvoiceSchema.methods.recomputeTotals = function () {
    const itemsTotal = (this.items || []).reduce((sum, it) => sum + (it.qty || 0) * ((it.discountedPrice ?? it.price) || 0), 0);
    const paid = (this.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    this.total = Number(itemsTotal.toFixed(2));
    this.remaining = Number(Math.max(0, this.total - paid).toFixed(2));
  };

  return connection.models.Invoice || connection.model('Invoice', InvoiceSchema);
};
