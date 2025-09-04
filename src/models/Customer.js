module.exports = function loadCustomer(connection) {
  const { Schema } = require('mongoose');
  const CustomerSchema = new Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true }
  }, { timestamps: true });

  CustomerSchema.index({ name: 1 });
  CustomerSchema.index({ phone: 1 });

  return connection.models.Customer || connection.model('Customer', CustomerSchema);
};
