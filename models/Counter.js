module.exports = function loadCounter(connection) {
  const { Schema } = require('mongoose');
  const CounterSchema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 1000 }
  }, { timestamps: true });

  return connection.models.Counter || connection.model('Counter', CounterSchema);
};
