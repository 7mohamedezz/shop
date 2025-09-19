const { contextBridge, ipcRenderer } = require('electron');

// Define allowed IPC channels for security
const ALLOWED_RECEIVE_CHANNELS = ['show-error', 'database-status'];

// Sanitize data to prevent code injection
function sanitizeData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Basic sanitization - remove potential script tags
    return data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize both key and value
      const sanitizedKey = typeof key === 'string' ? key.replace(/[<>]/g, '') : key;
      sanitized[sanitizedKey] = sanitizeData(value);
    }
    return sanitized;
  }

  return data;
}

contextBridge.exposeInMainWorld('api', {
  receive: (channel, func) => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeAllListeners: channel => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  products: {
    create: data => ipcRenderer.invoke('products:create', sanitizeData(data)),
    search: prefix => ipcRenderer.invoke('products:search', sanitizeData(prefix)),
    list: () => ipcRenderer.invoke('products:list'),
    update: (id, update) =>
      ipcRenderer.invoke('products:update', { id: sanitizeData(id), update: sanitizeData(update) }),
    delete: id => ipcRenderer.invoke('products:delete', sanitizeData(id)),
    lowStock: () => ipcRenderer.invoke('products:lowStock'),
    updatePopularity: (id, quantity) =>
      ipcRenderer.invoke('products:updatePopularity', { id: sanitizeData(id), quantity })
  },
  customers: {
    upsert: data => ipcRenderer.invoke('customers:upsert', data),
    list: () => ipcRenderer.invoke('customers:list'),
    search: prefix => ipcRenderer.invoke('customers:search', prefix),
    update: (id, data) => ipcRenderer.invoke('customers:update', { id, data }),
    delete: id => ipcRenderer.invoke('customers:delete', id)
  },
  plumbers: {
    upsert: data => ipcRenderer.invoke('plumbers:upsert', data),
    list: () => ipcRenderer.invoke('plumbers:list'),
    search: prefix => ipcRenderer.invoke('plumbers:search', prefix),
    update: (id, data) => ipcRenderer.invoke('plumbers:update', { id, data }),
    delete: id => ipcRenderer.invoke('plumbers:delete', id)
  },
  invoices: {
    create: payload => ipcRenderer.invoke('invoices:create', payload),
    list: filters => ipcRenderer.invoke('invoices:list', filters),
    getById: id => ipcRenderer.invoke('invoices:getById', id),
    addPayment: (invoiceId, payment) => ipcRenderer.invoke('invoices:addPayment', { invoiceId, payment }),
    update: (invoiceId, updateData) => ipcRenderer.invoke('invoices:update', { invoiceId, updateData }),
    updateItemsAndNotes: (invoiceId, items, notes) =>
      ipcRenderer.invoke('invoices:updateItemsAndNotes', { invoiceId, items, notes }),
    archive: (invoiceId, archived) => ipcRenderer.invoke('invoices:archive', invoiceId, archived),
    delete: invoiceId => ipcRenderer.invoke('invoices:delete', invoiceId),
    restore: invoiceId => ipcRenderer.invoke('invoices:restore', invoiceId),
    hardDelete: invoiceId => ipcRenderer.invoke('invoices:hardDelete', invoiceId),
    initializeCounter: () => ipcRenderer.invoke('invoices:initializeCounter')
  },
  returns: {
    create: data => ipcRenderer.invoke('returns:create', data),
    update: (returnId, updateData) => ipcRenderer.invoke('returns:update', { returnId, updateData })
  },
  print: {
    invoice: (invoiceId, options = {}) => ipcRenderer.invoke('print:invoice', { invoiceId, ...options })
  },
  backup: {
    run: () => ipcRenderer.invoke('backup:run'),
    create: () => ipcRenderer.invoke('backup:run'),
    restore: () => ipcRenderer.invoke('backup:restore')
  }
});
