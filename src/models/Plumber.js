module.exports = function loadPlumber(connection) {
  const { Schema } = require('mongoose');
  const PlumberSchema = new Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true, unique: true, sparse: true }
  }, { timestamps: true });

  PlumberSchema.index({ name: 1 });

  return connection.models.Plumber || connection.model('Plumber', PlumberSchema);
};
