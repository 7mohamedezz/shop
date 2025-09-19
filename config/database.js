// Database configuration
module.exports = {
  // MongoDB connection strings
  local:
    process.env.MONGODB_URI ||
    process.env.MONGODB_ATLAS_URI ||
    'mongodb+srv://abdo326302:LISKKI3ujWdRbrZQ@cluster0.gcuboxy.mongodb.net/plumbing_shop',
  atlas: process.env.MONGODB_ATLAS_URI,

  // Database options
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  },

  // Connection timeouts
  timeouts: {
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000
  }
};
