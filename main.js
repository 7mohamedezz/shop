const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
require('dotenv').config();

const { connectLocalDb, connectAtlasDb } = require('./services/db');
const productService = require('./services/productService');
const customerService = require('./services/customerService');
const plumberService = require('./services/plumberService');
const invoiceService = require('./services/invoiceService');
const { enqueueSync, startBackgroundSync } = require('./services/syncService');

let mainWindow;

async function createWindow() {
  await connectLocalDb(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/plumbing_shop');
  await connectAtlasDb(process.env.MONGODB_ATLAS_URI || '');
  startBackgroundSync();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Product IPC
ipcMain.handle('products:create', async (_e, payload) => {
  const created = await productService.createProduct(payload);
  await enqueueSync('Product', 'upsert', created);
  return created;
});

ipcMain.handle('products:search', async (_e, prefix) => {
  return productService.searchProductsByNamePrefix(prefix || '');
});

ipcMain.handle('products:list', async () => productService.listProducts());

ipcMain.handle('products:update', async (_e, { id, update }) => {
  const updated = await productService.updateProduct(id, update);
  await enqueueSync('Product', 'update', { id, update });
  return updated;
});

ipcMain.handle('products:delete', async (_e, id) => {
  const deleted = await productService.deleteProduct(id);
  await enqueueSync('Product', 'delete', { id });
  return deleted;
});

// Customer IPC
ipcMain.handle('customers:upsert', async (_e, payload) => {
  const customer = await customerService.upsertCustomerByPhone(payload);
  await enqueueSync('Customer', 'upsert', customer);
  return customer;
});

ipcMain.handle('customers:list', async () => customerService.listCustomers());
ipcMain.handle('customers:search', async (_e, prefix) => customerService.searchCustomers(prefix));

// Plumber IPC
ipcMain.handle('plumbers:upsert', async (_e, payload) => {
  const plumber = await plumberService.upsertPlumberByName(payload);
  await enqueueSync('Plumber', 'upsert', plumber);
  return plumber;
});
ipcMain.handle('plumbers:list', async () => plumberService.listPlumbers());
ipcMain.handle('plumbers:search', async (_e, prefix) => plumberService.searchPlumbers(prefix));

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
  const result = await invoiceService.addPaymentToInvoice(invoiceId, payment);
  await enqueueSync('Invoice', 'update', { id: invoiceId, update: { payments: result.payments, remaining: result.remaining } });
  return result;
});

ipcMain.handle('invoices:updateItemsAndNotes', async (_e, { invoiceId, items, notes }) => {
  const updated = await invoiceService.updateInvoiceItemsAndNotes(invoiceId, items, notes);
  await enqueueSync('Invoice', 'update', { id: invoiceId, update: { items: updated.items, notes: updated.notes, total: updated.total, remaining: updated.remaining } });
  return updated;
});

ipcMain.handle('invoices:archive', async (_e, { invoiceId, archived }) => {
  const updated = await invoiceService.archiveInvoice(invoiceId, archived);
  await enqueueSync('Invoice', 'update', { id: invoiceId, update: { archived } });
  return updated;
});

ipcMain.handle('returns:create', async (_e, payload) => {
  const ret = await invoiceService.createReturnInvoice(payload);
  await enqueueSync('ReturnInvoice', 'upsert', ret);
  return ret;
});

ipcMain.handle('print:invoice', async (_e, { invoiceId }) => {
  const html = await invoiceService.generateInvoicePrintableHtml(invoiceId);
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save Invoice PDF',
    defaultPath: `invoice-${invoiceId}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (filePath) {
    const fs = require('fs');
    fs.writeFileSync(filePath, pdfBuffer);
  }
  win.close();
  return { success: true, saved: Boolean(filePath) };
});
