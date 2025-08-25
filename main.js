const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
require('dotenv').config();

const { connectLocalDb, connectAtlasDb } = require('./services/db');
const productService = require('./services/productService');
const customerService = require('./services/customerService');
const plumberService = require('./services/plumberService');
const invoiceService = require('./services/invoiceService');
const { enqueueSync, startBackgroundSync } = require('./services/syncService');
const { toObjectIdString } = require('./services/objectIdUtils');

let mainWindow;

async function createWindow() {
  try {
    console.log('🚀 Starting application...');
    
    console.log('📊 Connecting to local database...');
    await connectLocalDb(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/plumbing_shop');
    console.log('✅ Local database connected');
    
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

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
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

    // Enable developer tools for debugging
    mainWindow.webContents.openDevTools();
    
    console.log('🌐 Loading main window...');
    await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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

ipcMain.handle('returns:create', async (_e, payload) => {
  const ret = await invoiceService.createReturnInvoice(payload);
  await enqueueSync('ReturnInvoice', 'upsert', ret);
  return ret;
});

ipcMain.handle('print:invoice', async (_e, invoiceId) => {
  const html = await invoiceService.generateInvoicePrintableHtml(invoiceId);
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
