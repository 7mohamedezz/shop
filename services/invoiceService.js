const dayjs = require('dayjs');
const { getLocalModels } = require('./db');
const { Types } = require('mongoose');
const { toObjectIdString, findByIdSafe } = require('./objectIdUtils');

function computeTotals(items, payments) {
  const total = (items || []).reduce((sum, it) => sum + (it.qty || 0) * ((it.discountedPrice ?? it.price) || 0), 0);
  const paid = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = Math.max(0, total - paid);
  return { total: Number(total.toFixed(2)), remaining: Number(remaining.toFixed(2)) };
}

function normalizeCategoryName(name) {
  if (!name) return '';
  const n = String(name).replace(/\s+/g, '').toLowerCase();
  if (n === 'br') return 'br';
  // Accept common spellings for Abogali (Arabic/English)
  if (n === 'ابوغالي' || n === 'ابوغازي' || n === 'abogali' || n === 'aboghali' || n === 'aboghly' || n === 'aboghali') return 'ابوغالي';
  return n;
}

async function createInvoice(payload) {
  const { Invoice, Customer, Product } = getLocalModels();
  let customer = await Customer.findOne({ phone: payload.customer.phone });
  if (!customer) {
    customer = await Customer.create({ name: payload.customer.name, phone: payload.customer.phone });
  }

  const abogaliPercent = Math.max(0, Math.min(100, Number(payload.discountAbogaliPercent || 0)));
  const brPercent = Math.max(0, Math.min(100, Number(payload.discountBrPercent || 0)));

  const itemDocs = [];
  for (const it of payload.items || []) {
    const rawId = typeof it.product === 'object' && it.product !== null ? (it.product._id || it.product.id || null) : it.product;
    let productDoc = null;
    if (rawId && Types.ObjectId.isValid(rawId)) {
      productDoc = await Product.findById(rawId);
    } else if (rawId) {
      productDoc = null; // invalid id; will fallback to name
    }
    if (!productDoc) {
      productDoc = await Product.findOne({ name: it.name });
    }
    if (!productDoc) {
      productDoc = await Product.create({
        name: it.name,
        category: it.category || '',
        buyingPrice: it.buyingPrice ?? 0,
        sellingPrice: it.price ?? it.sellingPrice ?? 0,
        stock: 0
      });
    }

    const selling = it.price ?? it.sellingPrice ?? productDoc.sellingPrice ?? 0;
    const buying = it.buyingPrice ?? productDoc.buyingPrice ?? 0;
    const categoryRaw = (it.category ?? productDoc.category ?? '').trim();
    const normCat = normalizeCategoryName(categoryRaw);

    let discounted = null;
    if (normCat === 'ابوغالي') {
      if (abogaliPercent > 0) discounted = Number((selling * (1 - abogaliPercent / 100)).toFixed(2));
    } else if (normCat === 'br') {
      if (brPercent > 0) discounted = Number((selling * (1 - brPercent / 100)).toFixed(2));
    }

    itemDocs.push({ product: productDoc._id, qty: it.qty, price: selling, buyingPrice: buying, category: categoryRaw, discountedPrice: discounted });
  }

  const payments = (payload.payments || []).map(p => ({ amount: p.amount, date: p.date || new Date(), note: p.note || '' }));
  const { total, remaining } = computeTotals(itemDocs, payments);

  const invoice = await Invoice.create({
    customer: customer._id,
    plumberName: payload.plumberName || '',
    items: itemDocs,
    payments,
    total,
    remaining,
    notes: payload.notes || '',
    archived: false,
    discountAbogaliPercent: abogaliPercent,
    discountBrPercent: brPercent
  });

  await invoice.populate([{ path: 'customer' }, { path: 'items.product' }]);
  return invoice.toObject();
}

async function listInvoices(filters) {
  const { Invoice, Customer } = getLocalModels();
  const query = {};
  if (filters.archived === true) query.archived = true;
  if (filters.archived === false) query.archived = false;

  if (filters.search) {
    const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const customers = await Customer.find({ $or: [{ name: rx }, { phone: rx }] }, { _id: 1 }).lean();
    const customerIds = customers.map(c => c._id);
    query.$or = [
      { plumberName: rx },
      { customer: { $in: customerIds } }
    ];
  }

  return Invoice.find(query)
    .populate('customer')
    .populate('items.product')
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
}

async function getInvoiceById(id) {
  const { Invoice, ReturnInvoice } = getLocalModels();
  
  const validId = toObjectIdString(id);
  if (!validId) return null;
  
  const inv = await findByIdSafe(Invoice, validId, { 
    populate: ['customer', 'items.product'], 
    lean: true 
  });
  if (!inv) return null;
  
  const ret = await ReturnInvoice.findOne({ originalInvoice: validId }).lean();
  return { ...inv, returnInvoice: ret || null };
}

async function addPaymentToInvoice(invoiceId, payment) {
  const { Invoice } = getLocalModels();
  
  const validId = toObjectIdString(invoiceId);
  if (!validId) throw new Error('Invalid invoice ID format');
  
  const inv = await Invoice.findById(validId);
  if (!inv) throw new Error('Invoice not found');
  inv.payments.push({ amount: payment.amount, date: payment.date || new Date(), note: payment.note || '' });
  inv.recomputeTotals();
  await inv.save();
  await inv.populate([{ path: 'customer' }, { path: 'items.product' }]);
  return inv.toObject();
}

async function updateInvoiceItemsAndNotes(invoiceId, items, notes) {
  const { Invoice, Product } = getLocalModels();
  
  const validId = toObjectIdString(invoiceId);
  if (!validId) throw new Error('Invalid invoice ID format');
  
  const inv = await Invoice.findById(validId);
  if (!inv) throw new Error('Invoice not found');
  const normalized = [];
  for (const it of (items || [])) {
    const rawId = typeof it.product === 'object' && it.product !== null ? (it.product._id || it.product.id || null) : it.product;
    const productDoc = rawId && Types.ObjectId.isValid(rawId) ? await Product.findById(rawId) : null;
    const categoryRaw = it.category ?? productDoc?.category ?? '';
    normalized.push({
      product: productDoc?._id || (Types.ObjectId.isValid(rawId) ? rawId : undefined),
      qty: it.qty,
      price: it.price ?? productDoc?.sellingPrice ?? 0,
      buyingPrice: it.buyingPrice ?? productDoc?.buyingPrice ?? 0,
      category: categoryRaw,
      discountedPrice: it.discountedPrice ?? null
    });
  }
  inv.items = normalized;
  inv.notes = notes || inv.notes;
  inv.recomputeTotals();
  await inv.save();
  await inv.populate([{ path: 'customer' }, { path: 'items.product' }]);
  return inv.toObject();
}

async function archiveInvoice(invoiceId, archived) {
  const { Invoice } = getLocalModels();
  
  const validId = toObjectIdString(invoiceId);
  if (!validId) throw new Error('Invalid invoice ID format');
  
  const inv = await Invoice.findByIdAndUpdate(validId, { archived: !!archived }, { new: true });
  return inv.toObject();
}

async function createReturnInvoice(payload) {
  const { ReturnInvoice, Invoice } = getLocalModels();
  
  const validId = toObjectIdString(payload.originalInvoice);
  if (!validId) throw new Error('Invalid original invoice ID format');
  
  const inv = await Invoice.findById(validId);
  if (!inv) throw new Error('Original invoice not found');
  const doc = await ReturnInvoice.create({
    originalInvoice: inv._id,
    items: (payload.items || []).map(it => ({ product: it.product, qty: it.qty, price: it.price, reason: it.reason || '' })),
    createdAt: new Date()
  });
  return doc.toObject();
}

function renderItemsTable(items) {
  const rows = (items || []).map(it => `
    <tr>
      <td>${it.product?.name || ''}${it.category ? ' (' + it.category + ')' : ''}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${((it.discountedPrice ?? it.price)).toFixed(2)}${it.discountedPrice != null ? ` <span style="color:#16a34a">(-${(100 - (it.discountedPrice / it.price * 100)).toFixed(0)}%)</span>` : ''}</td>
      <td style="text-align:right">${(it.qty * (it.discountedPrice ?? it.price)).toFixed(2)}</td>
    </tr>
  `).join('');
  return `
    <table style="width:100%; border-collapse:collapse" border="1" cellspacing="0" cellpadding="6">
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function generateInvoicePrintableHtml(invoiceId) {
  const validId = toObjectIdString(invoiceId);
  if (!validId) throw new Error('Invalid invoice ID format');
  
  const inv = await getInvoiceById(validId);
  if (!inv) throw new Error('Invoice not found');
  const paymentsRows = (inv.payments || []).map(p => `
    <tr>
      <td>${dayjs(p.date).format('YYYY-MM-DD')}</td>
      <td>${p.note || ''}</td>
      <td style="text-align:right">${Number(p.amount).toFixed(2)}</td>
    </tr>
  `).join('');
  const returnSection = inv.returnInvoice ? `
    <h3>مرتجع</h3>
    <div>التاريخ: ${dayjs(inv.returnInvoice.createdAt).format('YYYY-MM-DD')}</div>
    <table style="width:100%; border-collapse:collapse" border="1" cellspacing="0" cellpadding="6">
      <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>السبب</th></tr></thead>
      <tbody>
        ${inv.returnInvoice.items.map(ri => `<tr><td>${ri.product}</td><td>${ri.qty}</td><td style="text-align:right">${ri.price.toFixed(2)}</td><td>${ri.reason || ''}</td></tr>`).join('')}
      </tbody>
    </table>
  ` : '';

  const revenue = (inv.items || []).reduce((s, it) => s + it.qty * (it.discountedPrice ?? it.price), 0);
  const cost = (inv.items || []).reduce((s, it) => s + it.qty * (it.buyingPrice ?? 0), 0);
  const profit = revenue - cost;

  const discountInfo = (inv.discountAbogaliPercent > 0 || inv.discountBrPercent > 0)
    ? `<div><strong>الخصومات حسب الفئة:</strong> ابوغالي ${inv.discountAbogaliPercent}% | BR ${inv.discountBrPercent}%</div>`
    : '';

  const rows = (inv.items || []).map(it => `
    <tr>
      <td>${it.product?.name || ''}${it.category ? ' (' + it.category + ')' : ''}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${((it.discountedPrice ?? it.price)).toFixed(2)}</td>
      <td style="text-align:right">${(it.qty * (it.discountedPrice ?? it.price)).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>فاتورة ${inv._id}</title>
      <style>
        body { font-family: 'Tajawal', 'Cairo', Arial, sans-serif; padding: 24px; direction: rtl; }
        h1,h2,h3 { margin: 8px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .muted { color: #666; }
        table { direction: rtl; }
      </style>
    </head>
    <body>
      <h1>متجر السباكة</h1>
      <div class="muted">هاتف: xxx-xxx | العنوان: ...</div>
      <hr/>
      <div class="grid">
        <div>
          <div><strong>العميل:</strong> ${inv.customer?.name || ''}</div>
          <div><strong>الهاتف:</strong> ${inv.customer?.phone || ''}</div>
          <div><strong>السباك:</strong> ${inv.plumberName || ''}</div>
        </div>
        <div style="text-align:left">
          <div><strong>التاريخ:</strong> ${dayjs(inv.createdAt).format('YYYY-MM-DD HH:mm')}</div>
          <div><strong>آخر تحديث:</strong> ${dayjs(inv.updatedAt).format('YYYY-MM-DD HH:mm')}</div>
        </div>
      </div>
      ${discountInfo}
      <h2>الأصناف</h2>
      <table style="width:100%; border-collapse:collapse" border="1" cellspacing="0" cellpadding="6">
        <thead>
          <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:12px; text-align:left">
        <div><strong>الإجمالي:</strong> ${inv.total.toFixed(2)}</div>
        <div><strong>المتبقي:</strong> ${inv.remaining.toFixed(2)}</div>
        <div><strong>الربح:</strong> ${profit.toFixed(2)}</div>
      </div>
      <h3>المدفوعات</h3>
      <table style="width:100%; border-collapse:collapse" border="1" cellspacing="0" cellpadding="6">
        <thead><tr><th>التاريخ</th><th>ملاحظة</th><th>المبلغ</th></tr></thead>
        <tbody>${paymentsRows}</tbody>
      </table>
      <h3>ملاحظات</h3>
      <div>${(inv.notes || '').replace(/</g, '&lt;')}</div>
      ${returnSection}
    </body>
  </html>`;
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoiceById,
  addPaymentToInvoice,
  updateInvoiceItemsAndNotes,
  archiveInvoice,
  createReturnInvoice,
  generateInvoicePrintableHtml
};
