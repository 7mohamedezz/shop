const mongoose = require('mongoose');

const loadProduct = require('../models/Product');
const loadCustomer = require('../models/Customer');
const loadInvoice = require('../models/Invoice');
const loadReturnInvoice = require('../models/ReturnInvoice');
const loadPlumber = require('../models/Plumber');
const loadCounter = require('../models/Counter');

let localConn = null;
let atlasConn = null;
let localModels = null;
let atlasModels = null;

function loadModelsFor(conn) {
  return {
    Product: loadProduct(conn),
    Customer: loadCustomer(conn),
    Invoice: loadInvoice(conn),
    ReturnInvoice: loadReturnInvoice(conn),
    Plumber: loadPlumber(conn),
    Counter: loadCounter(conn)
  };
}

async function connectLocalDb(uri) {
  if (localConn) return localConn;
  try {
    console.log('🔄 Attempting to connect to MongoDB Atlas...');
    localConn = await mongoose.createConnection(uri, { 
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
      bufferCommands: false,
      retryWrites: true,
      w: 'majority'
    }).asPromise();
    console.log('✅ Connected to MongoDB Atlas successfully');
    localModels = loadModelsFor(localConn);
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB Atlas:', err?.message || err);
    console.warn('⚠️ Application will continue without database functionality');
    // Don't throw error, just return null to indicate no connection
    return null;
  }
  return localConn;
}

async function connectAtlasDb(uri) {
  if (!uri) return null;
  try {
    atlasConn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 3000 }).asPromise();
    atlasModels = loadModelsFor(atlasConn);
  } catch (e) {
    console.error('❌ Failed to connect to Atlas:', e?.message || e);
    atlasConn = null;
    atlasModels = null;
  }
  return atlasConn;
}

function getLocalModels() {
  if (!localModels) {
    console.warn('⚠️ No database connection available, returning empty models');
    return {
      Product: null,
      Customer: null,
      Invoice: null,
      ReturnInvoice: null,
      Plumber: null,
      Counter: null
    };
  }
  return localModels;
}

function getAtlasModels() {
  return atlasModels;
}

function getConnections() {
  return { localConn, atlasConn };
}

module.exports = {
  connectLocalDb,
  connectAtlasDb,
  getLocalModels,
  getAtlasModels,
  getConnections
};
