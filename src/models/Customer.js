module.exports = function loadCustomer(connection) {
  const { Schema } = require('mongoose');
  const CustomerSchema = new Schema(
    {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      isDeleted: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null }
    },
    { timestamps: true }
  );

  CustomerSchema.index({ name: 1 });
  CustomerSchema.index({ phone: 1 }, { unique: true });

  return connection.models.Customer || connection.model('Customer', CustomerSchema);
};
