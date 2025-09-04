const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const { connectLocalDb, connectAtlasDb, getLocalModels } = require('../database/db');
const productService = require('../services/productService');
const customerService = require('../services/customerService');
const plumberService = require('../services/plumberService');
const invoiceService = require('../services/invoiceService');
const { enqueueSync, startBackgroundSync } = require('../services/syncService');
const { toObjectIdString } = require('../utils/objectIdUtils');

let mainWindow;

async function createWindow() {
  try {
    console.log('🚀 Starting application...');
    
    console.log('📊 Attempting to connect to MongoDB Atlas...');
    try {
      const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || 'mongodb+srv://abdo326302:LISKKI3ujWdRbrZQ@cluster0.gcuboxy.mongodb.net/plumbing_shop';
      await connectLocalDb(mongoUri);
      console.log('✅ MongoDB Atlas connected');
    } catch (error) {
      console.warn('⚠️ MongoDB Atlas connection failed, continuing without database...');
      console.warn('⚠️ Error details:', error.message);
    }
    
    if (process.env.MONGODB_ATLAS_URI) {
      console.log('☁️ Connecting to Atlas database...');
      const atlasConn = await connectAtlasDb(process.env.MONGODB_ATLAS_URI);
      if (atlasConn) {
        console.log('✅ Atlas database connected');
      } else {
        console.warn('⚠️ Atlas database NOT connected. Verify MONGODB_ATLAS_URI and network/IP access list.');
      }
    } else {
      console.log('☁️ Atlas connection disabled (MONGODB_ATLAS_URI not set)');
    }
    
    console.log('🔄 Starting background sync...');
    startBackgroundSync();
    console.log('✅ Background sync started');

    // Resolve icon path for both dev and packaged builds
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'logo.png')
      : path.join(__dirname, '..', '..', 'assets', 'logo.png');

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

// Restore IPC: import JSON files from a selected backup directory
ipcMain.handle('backup:restore', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win || null, {
      title: 'اختر مجلد النسخة للاستراد',
      buttonLabel: 'اختر هذا المجلد',
      properties: ['openDirectory']
    });
    if (canceled || !filePaths || !filePaths[0]) return { canceled: true };

    const dir = filePaths[0];
    const readJson = async (name) => {
      try {
        const p = path.join(dir, `${name}.json`);
        const s = await fs.readFile(p, 'utf8');
        const arr = JSON.parse(s);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };

    const models = getLocalModels();
    const collections = [
      { name: 'products', model: models.Product },
      { name: 'customers', model: models.Customer },
      { name: 'plumbers', model: models.Plumber },
      { name: 'invoices', model: models.Invoice },
      { name: 'return_invoices', model: models.ReturnInvoice }
    ];

    const results = {};
    let maxInvoiceFromDump = 0;
    for (const { name, model } of collections) {
      const docs = await readJson(name);
      if (!docs.length) { results[name] = { matched: 0, upserted: 0 }; continue; }

      // Prepare bulk upserts by _id to avoid duplicates
      const ops = docs
        .filter(d => d && d._id)
        .map(d => {
          const {_id, ...rest} = d;
          return {
            updateOne: {
              filter: { _id },
              update: { $set: rest },
              upsert: true
            }
          };
        });
      if (!ops.length) { results[name] = { matched: 0, upserted: 0 }; continue; }
      const r = await model.bulkWrite(ops, { ordered: false });
      results[name] = { matched: r.matchedCount || 0, upserted: r.upsertedCount || 0 };

      if (name === 'invoices') {
        for (const d of docs) {
          if (typeof d.invoiceNumber === 'number') {
            if (d.invoiceNumber > maxInvoiceFromDump) maxInvoiceFromDump = d.invoiceNumber;
          }
        }
      }
    }

    // Restore counters: upsert any provided counters, then ensure invoiceNumber seq >= max invoiceNumber from dump
    const counterDocs = await readJson('counters');
    if (Array.isArray(counterDocs) && counterDocs.length) {
      const ops = counterDocs
        .filter(d => d && d._id)
        .map(d => ({
          updateOne: {
            filter: { _id: d._id },
            update: { $set: { seq: d.seq || 0 } },
            upsert: true
          }
        }));
      if (ops.length) await models.Counter.bulkWrite(ops, { ordered: false });
    }
    if (maxInvoiceFromDump > 0) {
      await models.Counter.findOneAndUpdate(
        { _id: 'invoiceNumber' },
        { $max: { seq: Math.max(1024, maxInvoiceFromDump) } },
        { upsert: true }
      );
    } else {
      // Initialize counter to 1024 if no invoices in dump (so next will be 1025)
      await models.Counter.findOneAndUpdate(
        { _id: 'invoiceNumber' },
        { $set: { seq: 1024 } },
        { upsert: true }
      );
    }

    return { success: true, results };
  } catch (error) {
    console.error('❌ Restore error:', error);
    return { error: true, message: error.message };
  }
});

// Backup IPC: export all local DB collections to JSON files in a chosen directory
ipcMain.handle('backup:run', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win || null, {
      title: 'اختر مجلد النسخة الاحتياطية (USB)',
      buttonLabel: 'اختر هذا المجلد',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths || !filePaths[0]) {
      return { canceled: true };
    }

    const baseDir = filePaths[0];
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ms = String(ts.getMilliseconds()).padStart(3, '0');
    const baseFolder = `PlumbingShopBackup_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}_${ms}`;
    let outDir = path.join(baseDir, baseFolder);
    // Ensure unique directory name to avoid accidental overwrites or duplicates
    let suffix = 2;
    try {
      // If exists, keep incrementing suffix
      // fs.access throws if not exists
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await fs.access(outDir).then(() => {
          outDir = path.join(baseDir, `${baseFolder}-${suffix++}`);
        }).catch(() => { throw new Error('STOP_LOOP'); });
      }
    } catch (e) {
      // Expected to break loop when directory doesn't exist
      if (e && e.message !== 'STOP_LOOP') {
        // Unexpected error
      }
    }
    await fs.mkdir(outDir, { recursive: true });

    const models = getLocalModels();
    const dumpOne = async (name, model) => {
      const docs = await model.find({}).lean().exec();
      const file = path.join(outDir, `${name}.json`);
      await fs.writeFile(file, JSON.stringify(docs, null, 2), 'utf8');
    };

    await dumpOne('products', models.Product);
    await dumpOne('customers', models.Customer);
    await dumpOne('plumbers', models.Plumber);
    await dumpOne('invoices', models.Invoice);
    await dumpOne('return_invoices', models.ReturnInvoice);
    // Dump counters (e.g., invoiceNumber sequence)
    const counters = await models.Counter.find({}).lean().exec();
    await fs.writeFile(path.join(outDir, 'counters.json'), JSON.stringify(counters, null, 2), 'utf8');

    return { success: true, directory: outDir };
  } catch (error) {
    console.error('❌ Backup error:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('products:lowStock', async () => {
  try {
    console.log('📉 Listing low-stock products');
    const products = await productService.listLowStockProducts();
    console.log('✅ Low-stock count', products.length);
    return products;
  } catch (error) {
    console.error('❌ Error listing low-stock products:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('products:updatePopularity', async (event, { id, quantity }) => {
  try {
    console.log('📈 Updating product popularity:', { id, quantity });
    const product = await productService.updateProductPopularity(id, quantity);
    console.log('✅ Product popularity updated');
    return product;
  } catch (error) {
    console.error('❌ Error updating product popularity:', error);
    return { error: true, message: error.message };
  }
});

    // Enable developer tools for debugging
    mainWindow.webContents.openDevTools();
    
    console.log('🌐 Loading main window...');
    await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    console.log('✅ Application loaded successfully');
    
  } catch (error) {
    console.error('❌ Error creating window:', error);
    console.error('Stack trace:', error.stack);
    
    // Show error dialog to user
    const { dialog } = require('electron');
    dialog.showErrorBox('Application Error', `Failed to start application: ${error.message}`);
  }
}

app.whenReady().then(() => {
  createWindow().catch(error => {
    console.error('❌ Failed to create window:', error);
    app.quit();
  });
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(error => {
        console.error('❌ Failed to create window on activate:', error);
      });
    }
  });
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Product IPC
ipcMain.handle('products:create', async (_e, payload) => {
  try {
    console.log('📦 Creating product:', payload);
    const created = await productService.createProduct(payload);
    await enqueueSync('Product', 'upsert', created);
    console.log('✅ Product created:', created._id);
    return created;
  } catch (error) {
    console.error('❌ Error creating product:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('products:search', async (_e, prefix) => {
  try {
    console.log('🔍 Searching products with prefix:', prefix);
    const results = await productService.searchProductsByNamePrefix(prefix || '');
    console.log('✅ Found', results.length, 'products');
    return results;
  } catch (error) {
    console.error('❌ Error searching products:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('products:list', async () => {
  try {
    console.log('📋 Listing all products');
    const products = await productService.listProducts();
    console.log('✅ Listed', products.length, 'products');
    return products;
  } catch (error) {
    console.error('❌ Error listing products:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('products:update', async (_e, { id, update }) => {
  try {
    const normalizedId = toObjectIdString(id) || toObjectIdString(id?._id) || toObjectIdString(id?.id);
    if (!normalizedId) {
      return { error: true, message: 'Invalid product ID format' };
    }
    console.log('📝 Updating product:', normalizedId, update);
    const updated = await productService.updateProduct(normalizedId, update);
    await enqueueSync('Product', 'update', { id: normalizedId, update });
    console.log('✅ Product updated:', normalizedId);
    return updated;
  } catch (error) {
    console.error('❌ Error updating product:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('products:delete', async (_e, id) => {
  try {
    const normalizedId = toObjectIdString(id) || toObjectIdString(id?._id) || toObjectIdString(id?.id);
    if (!normalizedId) {
      return { error: true, message: 'Invalid product ID format' };
    }
    console.log('🗑️ Deleting product:', normalizedId);
    const deleted = await productService.deleteProduct(normalizedId);
    await enqueueSync('Product', 'delete', { id: normalizedId });
    console.log('✅ Product deleted:', normalizedId);
    return deleted;
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    return { error: true, message: error.message };
  }
});

// Customer IPC
ipcMain.handle('customers:upsert', async (_e, payload) => {
  const customer = await customerService.upsertCustomerByPhone(payload);
  await enqueueSync('Customer', 'upsert', customer);
  return customer;
});

ipcMain.handle('customers:list', async () => customerService.listCustomers());
ipcMain.handle('customers:search', async (_e, prefix) => customerService.searchCustomers(prefix));

ipcMain.handle('customers:update', async (_e, { id, data }) => {
  try {
    const norm = toObjectIdString(id) || toObjectIdString(id?._id) || toObjectIdString(id?.id);
    if (!norm) return { error: true, message: 'Invalid customer ID format' };
    const updated = await customerService.updateCustomer(norm, data || {});
    await enqueueSync('Customer', 'update', { id: norm, update: data || {} });
    return updated;
  } catch (error) {
    return { error: true, message: error.message };
  }
});

ipcMain.handle('customers:delete', async (_e, id) => {
  try {
    const norm = toObjectIdString(id) || toObjectIdString(id?._id) || toObjectIdString(id?.id);
    if (!norm) return { error: true, message: 'Invalid customer ID format' };
    const deleted = await customerService.deleteCustomer(norm);
    await enqueueSync('Customer', 'delete', { id: norm });
    return deleted;
  } catch (error) {
    return { error: true, message: error.message };
  }
});

// Plumber IPC
ipcMain.handle('plumbers:upsert', async (_e, payload) => {
  const plumber = await plumberService.upsertPlumberByName(payload);
  await enqueueSync('Plumber', 'upsert', plumber);
  return plumber;
});
ipcMain.handle('plumbers:list', async () => plumberService.listPlumbers());
ipcMain.handle('plumbers:search', async (_e, prefix) => plumberService.searchPlumbers(prefix));

ipcMain.handle('plumbers:update', async (_e, { id, data }) => {
  try {
    const norm = toObjectIdString(id) || toObjectIdString(id?._id) || toObjectIdString(id?.id);
    if (!norm) return { error: true, message: 'Invalid plumber ID format' };
    const updated = await plumberService.updatePlumber(norm, data || {});
    await enqueueSync('Plumber', 'update', { id: norm, update: data || {} });
    return updated;
  } catch (error) {
    return { error: true, message: error.message };
  }
});

ipcMain.handle('plumbers:delete', async (_e, id) => {
  try {
    const norm = toObjectIdString(id) || toObjectIdString(id?._id) || toObjectIdString(id?.id);
    if (!norm) return { error: true, message: 'Invalid plumber ID format' };
    const deleted = await plumberService.deletePlumber(norm);
    await enqueueSync('Plumber', 'delete', { id: norm });
    return deleted;
  } catch (error) {
    return { error: true, message: error.message };
  }
});

// Invoice IPC
ipcMain.handle('invoices:create', async (_e, payload) => {
  try {
    if (!payload?.customer?.name || !payload?.customer?.phone) {
      throw new Error('Customer name and phone are required');
    }
    const invoice = await invoiceService.createInvoice(payload);
    await enqueueSync('Invoice', 'upsert', invoice);
    return invoice;
  } catch (err) {
    return { error: true, message: err.message };
  }
});

ipcMain.handle('invoices:list', async (_e, filters) => invoiceService.listInvoices(filters || {}));
ipcMain.handle('invoices:getById', async (_e, id) => invoiceService.getInvoiceById(id));

ipcMain.handle('invoices:addPayment', async (_e, { invoiceId, payment }) => {
  console.log("IPC 'invoices:addPayment' received:", { invoiceIdType: typeof invoiceId, invoiceId });
  const s = String(invoiceId ?? '').trim();
  let keyForSync = null;
  let targetId = null;
  if (/^\d+$/.test(s)) {
    // Accept numeric invoiceNumber
    targetId = Number(s);
    keyForSync = targetId;
  } else {
    // Normalize invoiceId to a valid ObjectId string defensively
    const normalizedId = toObjectIdString(invoiceId)
      || toObjectIdString(invoiceId?._id)
      || toObjectIdString(invoiceId?.id);
    console.log("IPC 'invoices:addPayment' normalizedId:", normalizedId);
    if (!normalizedId) {
      return { error: true, message: `Invalid invoice ID format` };
    }
    targetId = normalizedId;
    keyForSync = normalizedId;
  }
  const result = await invoiceService.addPaymentToInvoice(targetId, payment || {});
  await enqueueSync('Invoice', 'update', { id: keyForSync, update: { payments: result.payments, remaining: result.remaining } });
  return result;
});

ipcMain.handle('invoices:updateItemsAndNotes', async (_e, { invoiceId, items, notes }) => {
  const updated = await invoiceService.updateInvoiceItemsAndNotes(invoiceId, items, notes);
  await enqueueSync('Invoice', 'update', { id: invoiceId, update: { items, notes } });
  return updated;
});

ipcMain.handle('invoices:update', async (_e, { invoiceId, updateData }) => {
  const updated = await invoiceService.updateInvoice(invoiceId, updateData);
  await enqueueSync('Invoice', 'update', { id: invoiceId, update: updateData });
  return updated;
});

ipcMain.handle('invoices:archive', async (_e, invoiceId, archived) => {
  const updated = await invoiceService.archiveInvoice(invoiceId, archived);
  await enqueueSync('Invoice', 'update', { id: invoiceId, update: { archived } });
  return updated;
});

ipcMain.handle('invoices:delete', async (_e, invoiceId) => {
  try {
    const updated = await invoiceService.deleteInvoice(invoiceId);
    await enqueueSync('Invoice', 'update', { id: invoiceId, update: { deleted: true, archived: false } });
    return updated;
  } catch (err) {
    return { error: true, message: err.message };
  }
});

ipcMain.handle('invoices:restore', async (_e, invoiceId) => {
  try {
    const updated = await invoiceService.restoreInvoice(invoiceId);
    await enqueueSync('Invoice', 'update', { id: invoiceId, update: { deleted: false } });
    return updated;
  } catch (err) {
    return { error: true, message: err.message };
  }
});

ipcMain.handle('invoices:hardDelete', async (_e, invoiceId) => {
  try {
    const result = await invoiceService.hardDeleteInvoice(invoiceId);
    await enqueueSync('Invoice', 'delete', { id: invoiceId });
    return result;
  } catch (err) {
    return { error: true, message: err.message };
  }
});

ipcMain.handle('invoices:initializeCounter', async () => {
  try {
    await invoiceService.initializeInvoiceCounter();
    return { success: true };
  } catch (error) {
    return { error: true, message: error.message };
  }
});

ipcMain.handle('returns:create', async (_e, payload) => {
  const ret = await invoiceService.createReturnInvoice(payload);
  await enqueueSync('ReturnInvoice', 'upsert', ret);
  return ret;
});

ipcMain.handle('print:invoice', async (_e, payload) => {
  const { invoiceId, fontSize } = (payload && typeof payload === 'object') ? payload : { invoiceId: payload };
  const html = await invoiceService.generateInvoicePrintableHtml(invoiceId, { fontSize });
  // Open a visible preview window and trigger Chromium's print preview (allows "Save to PDF")
  const win = new BrowserWindow({
    show: true,
    width: 900,
    height: 1200,
    webPreferences: { contextIsolation: true }
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  // Slight delay to ensure rendering, then open preview
  setTimeout(() => {
    win.webContents.executeJavaScript('window.print();');
  }, 100);

  // Do not close the window automatically; user can close after printing/saving
  return { success: true, preview: true };
});
