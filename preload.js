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
    search: (prefix) => ipcRenderer.invoke('customers:search', prefix)
  },
  plumbers: {
    upsert: (data) => ipcRenderer.invoke('plumbers:upsert', data),
    list: () => ipcRenderer.invoke('plumbers:list'),
    search: (prefix) => ipcRenderer.invoke('plumbers:search', prefix)
  },
  invoices: {
    create: (payload) => ipcRenderer.invoke('invoices:create', payload),
    list: (filters) => ipcRenderer.invoke('invoices:list', filters),
    getById: (id) => ipcRenderer.invoke('invoices:getById', id),
    addPayment: (invoiceId, payment) => ipcRenderer.invoke('invoices:addPayment', { invoiceId, payment }),
    updateItemsAndNotes: (invoiceId, items, notes) => ipcRenderer.invoke('invoices:updateItemsAndNotes', { invoiceId, items, notes }),
    archive: (invoiceId, archived) => ipcRenderer.invoke('invoices:archive', { invoiceId, archived })
  },
  returns: {
    create: (data) => ipcRenderer.invoke('returns:create', data)
  },
  print: {
    invoice: (invoiceId) => ipcRenderer.invoke('print:invoice', { invoiceId })
  }
});
