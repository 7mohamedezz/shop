const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  products: {
    create: (data) => ipcRenderer.invoke('products:create', data),
    search: (prefix) => ipcRenderer.invoke('products:search', prefix),
    list: () => ipcRenderer.invoke('products:list'),
    update: (id, update) => ipcRenderer.invoke('products:update', { id, update }),
    delete: (id) => ipcRenderer.invoke('products:delete', id)
  },
  customers: {
    upsert: (data) => ipcRenderer.invoke('customers:upsert', data),
    list: () => ipcRenderer.invoke('customers:list'),
    search: (prefix) => ipcRenderer.invoke('customers:search', prefix),
    update: (id, data) => ipcRenderer.invoke('customers:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('customers:delete', id)
  },
  plumbers: {
    upsert: (data) => ipcRenderer.invoke('plumbers:upsert', data),
    list: () => ipcRenderer.invoke('plumbers:list'),
    search: (prefix) => ipcRenderer.invoke('plumbers:search', prefix),
    update: (id, data) => ipcRenderer.invoke('plumbers:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('plumbers:delete', id)
  },
  invoices: {
    create: (payload) => ipcRenderer.invoke('invoices:create', payload),
    list: (filters) => ipcRenderer.invoke('invoices:list', filters),
    getById: (id) => ipcRenderer.invoke('invoices:getById', id),
    addPayment: (invoiceId, payment) => ipcRenderer.invoke('invoices:addPayment', { invoiceId, payment }),
    update: (invoiceId, updateData) => ipcRenderer.invoke('invoices:update', { invoiceId, updateData }),
    updateItemsAndNotes: (invoiceId, items, notes) => ipcRenderer.invoke('invoices:updateItemsAndNotes', { invoiceId, items, notes }),
    archive: (invoiceId, archived) => ipcRenderer.invoke('invoices:archive', invoiceId, archived),
    delete: (invoiceId) => ipcRenderer.invoke('invoices:delete', invoiceId)
  },
  returns: {
    create: (data) => ipcRenderer.invoke('returns:create', data)
  },
  print: {
    invoice: (invoiceId) => ipcRenderer.invoke('print:invoice', invoiceId)
  }
});
