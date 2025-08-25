const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const loadProduct = require('../models/Product');
const loadCustomer = require('../models/Customer');
const loadInvoice = require('../models/Invoice');
const loadReturnInvoice = require('../models/ReturnInvoice');
const loadPlumber = require('../models/Plumber');

let localConn = null;
let atlasConn = null;
let localModels = null;
let atlasModels = null;
let memoryServer = null;

function loadModelsFor(conn) {
  return {
    Product: loadProduct(conn),
    Customer: loadCustomer(conn),
    Invoice: loadInvoice(conn),
    ReturnInvoice: loadReturnInvoice(conn),
    Plumber: loadPlumber(conn)
  };
}

async function connectLocalDb(uri) {
  if (localConn) return localConn;
  try {
    localConn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 2500 }).asPromise();
  } catch (err) {
    // Fallback to in-memory MongoDB for offline-first usage
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri('plumbing_shop');
    localConn = await mongoose.createConnection(memUri, { serverSelectionTimeoutMS: 2500 }).asPromise();
  }
  localModels = loadModelsFor(localConn);
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
  if (!localModels) throw new Error('Local DB not initialized');
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
