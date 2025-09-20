const svc = require('../../src/services/invoiceService');
const db = require('../../src/database/db');

describe('generateInvoicePrintableHtml totals', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('computes items, paid, return and remaining correctly in printable HTML', async () => {
    // Build a fake invoice object
    const inv = {
      _id: '64f8b9f0f0f0f0f0f0f0f0f0',
      invoiceNumber: 5555,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerName: 'Test Customer',
      customerPhone: '01000000000',
      plumberName: '',
      notes: 'Some notes',
      items: [
        { productName: 'Prod A', qty: 2, price: 100, discountedPrice: 90, category: 'cat', delivered: false },
        { productName: 'Prod B', qty: 1, price: 50, category: 'cat', delivered: false }
      ],
      payments: [
        { amount: 50, date: new Date().toISOString(), note: '' }
      ],
      // returnInvoice items will be used to compute returnTotal
      returnInvoice: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [{ productName: 'Prod A', qty: 1, price: 90, category: 'cat' }]
      }
    };

    // Spy getInvoiceById to return our fake invoice
    jest.spyOn(svc, 'getInvoiceById').mockResolvedValue(inv);
    // Ensure getLocalModels returns something harmless (Product/Plumber lookups not needed here)
    jest.spyOn(db, 'getLocalModels').mockReturnValue({ Product: null, Plumber: null });

    const html = await svc.generateInvoicePrintableHtml(inv.invoiceNumber);

    // Compute expected values
    const itemsTotal = (2 * 90) + (1 * 50); // 230.00
    const paidTotal = 50; // from payments (excluding returns)
    const returnTotal = 1 * 90; // from returnInvoice
    const remaining = Number((itemsTotal - (paidTotal + returnTotal)).toFixed(2)); // 90.00

    // Assert the formatted numbers appear in the returned HTML
    expect(html).toEqual(expect.stringContaining(itemsTotal.toFixed(2)));
    expect(html).toEqual(expect.stringContaining(paidTotal.toFixed(2)));
    expect(html).toEqual(expect.stringContaining(returnTotal.toFixed(2)));
    expect(html).toEqual(expect.stringContaining(remaining.toFixed(2)));
  });
});
