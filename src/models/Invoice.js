module.exports = function loadInvoice(connection) {
  const { Schema, Types } = require('mongoose');

  const InvoiceItemSchema = new Schema(
    {
      product: { type: Types.ObjectId, ref: 'Product', required: false },
      // Denormalized product name snapshot at the time of invoicing
      productName: { type: String, default: '' },
      qty: { type: Number, required: true, min: 0 },
      price: { type: Number, required: true, min: 0 },
      buyingPrice: { type: Number, default: 0, min: 0 },
      category: { type: String, default: '' },
      discountedPrice: { type: Number, default: null },
      delivered: { type: Boolean, default: false }
    },
    { _id: false }
  );

  const PaymentSchema = new Schema(
    {
      amount: { type: Number, required: true, min: 0 },
      date: { type: Date, default: Date.now },
      note: { type: String, default: '' }
    },
    { _id: false }
  );

  const InvoiceSchema = new Schema(
    {
      invoiceNumber: { type: Number, unique: true },
      customer: { type: Types.ObjectId, ref: 'Customer', required: true },
      // Denormalized snapshot of customer at time of invoice
      customerName: { type: String, default: '' },
      customerPhone: { type: String, default: '' },
      plumberName: { type: String, default: '' },
      items: { type: [InvoiceItemSchema], default: [] },
      payments: { type: [PaymentSchema], default: [] },
      total: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      notes: { type: String, default: '' },
      archived: { type: Boolean, default: false },
      deleted: { type: Boolean, default: false },
      discountAbogaliPercent: { type: Number, default: 0, min: 0, max: 100 },
      discountBrPercent: { type: Number, default: 0, min: 0, max: 100 }
    },
    { timestamps: true }
  );

  // Auto-increment invoice number using atomic Counter collection
  InvoiceSchema.pre('save', async function (next) {
    if (this.isNew && !this.invoiceNumber) {
      try {
        const Counter = this.constructor.db.model('Counter');
        const counterDoc = await Counter.findOneAndUpdate(
          { _id: 'invoiceNumber' },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        // Start from 1025, so if counter is 1024, next will be 1025
        const nextSeq = counterDoc && counterDoc.seq ? counterDoc.seq : 1025;
        this.invoiceNumber = nextSeq;
      } catch (error) {
        console.error('Error generating invoice number via Counter:', error);
        // Improved fallback: try to get the highest existing invoice number
        try {
          const lastInvoice = await this.constructor.findOne({}, {}, { sort: { invoiceNumber: -1 } });
          const lastNum = lastInvoice?.invoiceNumber || 1024;
          this.invoiceNumber = Math.max(1025, lastNum + 1);
        } catch (fallbackError) {
          console.error('Fallback invoice number generation failed:', fallbackError);
          this.invoiceNumber = 1025; // Ultimate fallback
        }
      }
    }
    next();
  });

  InvoiceSchema.methods.recomputeTotals = function () {
    const itemsTotal = (this.items || []).reduce(
      (sum, it) => sum + (it.qty || 0) * ((it.discountedPrice ?? it.price) || 0),
      0
    );
    const paid = (this.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    this.total = Number(itemsTotal.toFixed(2));
    this.remaining = Number((this.total - paid).toFixed(2));
  };

  return connection.models.Invoice || connection.model('Invoice', InvoiceSchema);
};
