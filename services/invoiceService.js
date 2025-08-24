const dayjs = require('dayjs');
const { getLocalModels } = require('./db');
const { Types } = require('mongoose');
const { toObjectIdString, findByIdSafe } = require('./objectIdUtils');

function isNumericId(v) {
  const s = String(v ?? '').trim();
  return /^[0-9]+$/.test(s);
}

function computeTotals(items, payments) {
  const total = (items || []).reduce((sum, it) => sum + (it.qty || 0) * ((it.discountedPrice ?? it.price) || 0), 0);
  const paid = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = total - paid;
  return { total: Number(total.toFixed(2)), remaining: Number(remaining.toFixed(2)) };
}

function normalizeCategoryName(name) {
  if (!name) return '';
  const n = String(name).replace(/\s+/g, '').toLowerCase();
  if (n === 'br' || n === 'pr') return 'br';
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
    // Decrease stock for sold quantity
    try {
      const qty = Number(it.qty || 0);
      if (productDoc?._id && qty > 0) {
        await Product.updateOne({ _id: productDoc._id }, { $inc: { stock: -qty } });
      }
    } catch (e) {
      console.warn('Stock decrement failed for product', productDoc?._id?.toString?.() || productDoc?._id, e?.message);
    }
  }

  const payments = (payload.payments || []).map(p => ({ amount: p.amount, date: p.date || new Date(), note: p.note || '' }));
  const { total, remaining } = computeTotals(itemDocs, payments);

  // Attempt to set invoiceNumber explicitly (pre-save will still handle if we omit or fail)
  let computedInvoiceNumber;
  try {
    const last = await Invoice.findOne({}, {}, { sort: { invoiceNumber: -1 } }).lean();
    const lastNum = Number(last?.invoiceNumber);
    if (Number.isFinite(lastNum)) {
      computedInvoiceNumber = Math.trunc(lastNum) + 1;
    }
  } catch (e) {
    console.warn('Could not compute next invoice number, letting pre-save handle it:', e?.message);
  }

  const baseDoc = {
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
  };
  if (Number.isFinite(computedInvoiceNumber)) {
    baseDoc.invoiceNumber = computedInvoiceNumber;
  }

  const invoice = await Invoice.create(baseDoc);

  await invoice.populate([{ path: 'customer' }, { path: 'items.product' }]);
  return invoice.toObject();
}

async function listInvoices(filters) {
  const { Invoice, Customer, Plumber } = getLocalModels();
  const query = {};
  if (filters.archived === true) query.archived = true;
  if (filters.archived === false) query.archived = false;

  // Explicit filter by customerId
  // If includeCustomerAsPlumber is true, match invoices where the customer matches OR plumber has same phone as the customer
  let customerFilterOr = null;
  if (filters.customerId) {
    const cid = toObjectIdString(filters.customerId);
    if (cid) {
      if (filters.includeCustomerAsPlumber) {
        try {
          const custDoc = await Customer.findById(cid).lean();
          const base = [{ customer: Types.ObjectId.createFromHexString(cid) }];
          if (custDoc?.phone) {
            const plumbers = await (getLocalModels().Plumber.find({ phone: custDoc.phone }, { name: 1 }).lean());
            const names = plumbers.map(p => p.name).filter(Boolean);
            if (names.length > 0) {
              const nameRegexes = names.map(n => new RegExp('^' + String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'));
              base.push({ plumberName: { $in: nameRegexes } });
            }
          }
          customerFilterOr = base;
        } catch (_e) {
          // Fallback to strict customer filter
          query.customer = Types.ObjectId.createFromHexString(cid);
        }
      } else {
        query.customer = Types.ObjectId.createFromHexString(cid);
      }
    }
  }
  // Explicit filter by plumberName (exact, case-insensitive)
  // If includePlumberAsCustomer is true, match invoices where plumberName matches OR invoice.customer has same phone as plumber
  let plumberFilterOr = null;
  if (filters.plumberName) {
    const n = String(filters.plumberName || '').trim();
    if (n) {
      const plumberRx = new RegExp('^' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      if (filters.includePlumberAsCustomer) {
        try {
          const pl = await Plumber.findOne({ name: plumberRx }).lean();
          if (pl?.phone) {
            const custs = await Customer.find({ phone: pl.phone }, { _id: 1 }).lean();
            const cids = custs.map(c => c._id);
            plumberFilterOr = [{ plumberName: plumberRx }];
            if (cids.length > 0) plumberFilterOr.push({ customer: { $in: cids } });
          } else {
            plumberFilterOr = [{ plumberName: plumberRx }];
          }
        } catch (_e) {
          plumberFilterOr = [{ plumberName: plumberRx }];
        }
      } else {
        // simple plumber filter
        query.plumberName = plumberRx;
      }
    }
  }

  if (filters.search) {
    const s = String(filters.search).trim();
    const rx = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const customers = await Customer.find({ $or: [{ name: rx }, { phone: rx }] }, { _id: 1 }).lean();
    const customerIds = customers.map(c => c._id);
    const ors = [
      { plumberName: rx },
      { customer: { $in: customerIds } }
    ];
    // If search is numeric, allow searching by invoiceNumber
    if (/^\d+$/.test(s)) {
      ors.push({ invoiceNumber: Number(s) });
    }
    // If search looks like ObjectId, allow searching by _id
    if (/^[a-f0-9]{24}$/i.test(s)) {
      ors.push({ _id: Types.ObjectId.createFromHexString(s) });
    }
    const andConds = [];
    if (plumberFilterOr) andConds.push({ $or: plumberFilterOr });
    if (customerFilterOr) andConds.push({ $or: customerFilterOr });
    if (andConds.length > 0) {
      andConds.push({ $or: ors });
      query.$and = andConds;
    } else {
      query.$or = ors;
    }
  }

  // If we have combined filters (plumber/customer) and no text search, apply them now
  if ((plumberFilterOr || customerFilterOr) && !filters.search) {
    // Preserve any existing fields in query (e.g., archived, customerId) and AND them with our OR
    if (Object.keys(query).length > 0) {
      // Extract non-logical fields into an $and with our OR
      const { $or, $and, ...rest } = query;
      const andParts = [];
      if (Object.keys(rest).length > 0) andParts.push(rest);
      if ($or) andParts.push({ $or });
      if ($and) andParts.push({ $and });
      const ors = [];
      if (plumberFilterOr) ors.push({ $or: plumberFilterOr });
      if (customerFilterOr) ors.push({ $or: customerFilterOr });
      query.$and = [...(query.$and || []), ...andParts, ...ors];
      // Clean top-level non-logical entries are already in $and
      for (const k of Object.keys(rest)) delete query[k];
      delete query.$or; // consolidated
    } else {
      if (plumberFilterOr && customerFilterOr) {
        query.$and = [{ $or: plumberFilterOr }, { $or: customerFilterOr }];
      } else if (plumberFilterOr) {
        query.$or = plumberFilterOr;
      } else if (customerFilterOr) {
        query.$or = customerFilterOr;
      }
    }
  }

  return Invoice.find(query)
    .populate('customer')
    .populate('items.product')
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
}

async function getInvoiceById(id) {
  const { Invoice, ReturnInvoice } = getLocalModels();
  
  let inv = null;
  let originalKey = null;
  if (isNumericId(id)) {
    const n = Number(String(id).trim());
    inv = await Invoice.findOne({ invoiceNumber: n })
      .populate('customer')
      .populate('items.product')
      .lean();
    originalKey = inv?._id;
  } else {
    const validId = toObjectIdString(id);
    if (!validId) return null;
    inv = await findByIdSafe(Invoice, validId, { 
      populate: ['customer', 'items.product'], 
      lean: true 
    });
    originalKey = validId;
  }
  if (!inv) return null;
  const ret = await ReturnInvoice.findOne({ originalInvoice: originalKey }).lean();
  return { ...inv, returnInvoice: ret || null };
}

async function addPaymentToInvoice(invoiceId, payment) {
  const { Invoice } = getLocalModels();
  
  console.log('addPaymentToInvoice called with:', { invoiceId, type: typeof invoiceId });
  let inv = null;
  if (isNumericId(invoiceId)) {
    const n = Number(String(invoiceId).trim());
    inv = await Invoice.findOne({ invoiceNumber: n });
  } else {
    const validId = toObjectIdString(invoiceId);
    console.log('addPaymentToInvoice normalized id:', { validId });
    if (!validId) throw new Error('Invalid invoice ID format');
    inv = await Invoice.findById(validId);
  }
  if (!inv) throw new Error('Invoice not found');
  inv.payments.push({ amount: payment.amount, date: payment.date || new Date(), note: payment.note || '' });
  inv.recomputeTotals();
  await inv.save();
  await inv.populate([{ path: 'customer' }, { path: 'items.product' }]);
  return inv.toObject();
}

async function updateInvoice(invoiceId, updateData) {
  const { Invoice, Product, Customer } = getLocalModels();
  let inv = null;
  if (isNumericId(invoiceId)) {
    const n = Number(String(invoiceId).trim());
    inv = await Invoice.findOne({ invoiceNumber: n });
  } else {
    const validId = toObjectIdString(invoiceId);
    if (!validId) throw new Error('Invalid invoice ID format');
    inv = await Invoice.findById(validId);
  }
  if (!inv) throw new Error('Invoice not found');
  
  // Update customer if provided
  if (updateData.customer) {
    let customer = await Customer.findOne({ phone: updateData.customer.phone });
    if (!customer) {
      customer = await Customer.create({ 
        name: updateData.customer.name, 
        phone: updateData.customer.phone 
      });
    }
    inv.customer = customer._id;
  }
  
  // Update plumber name
  if (updateData.plumberName !== undefined) {
    inv.plumberName = updateData.plumberName;
  }
  
  // Update discount percentages
  if (updateData.discountAbogaliPercent !== undefined) {
    inv.discountAbogaliPercent = Math.max(0, Math.min(100, Number(updateData.discountAbogaliPercent || 0)));
  }
  if (updateData.discountBrPercent !== undefined) {
    inv.discountBrPercent = Math.max(0, Math.min(100, Number(updateData.discountBrPercent || 0)));
  }
  
  // Update items if provided
  if (updateData.items) {
    const normalized = [];
    for (const it of updateData.items) {
      const rawId = typeof it.product === 'object' && it.product !== null ? (it.product._id || it.product.id || null) : it.product;
      let productDoc = null;
      if (rawId && Types.ObjectId.isValid(rawId)) {
        productDoc = await Product.findById(rawId);
      } else if (rawId) {
        productDoc = null;
      }
      if (!productDoc && it.name) {
        productDoc = await Product.findOne({ name: it.name });
      }
      if (!productDoc && it.name) {
        productDoc = await Product.create({
          name: it.name,
          category: it.category || '',
          buyingPrice: it.buyingPrice ?? 0,
          sellingPrice: it.price ?? it.sellingPrice ?? 0,
          stock: 0
        });
      }
      
      const selling = it.price ?? it.sellingPrice ?? productDoc?.sellingPrice ?? 0;
      const buying = it.buyingPrice ?? productDoc?.buyingPrice ?? 0;
      const categoryRaw = (it.category ?? productDoc?.category ?? '').trim();
      
      // Apply discounts based on category
      let discounted = null;
      const normCat = categoryRaw.replace(/\s+/g, '').toLowerCase();
      if (normCat === 'ابوغالي' && inv.discountAbogaliPercent > 0) {
        discounted = Number((selling * (1 - inv.discountAbogaliPercent / 100)).toFixed(2));
      } else if (normCat === 'br' && inv.discountBrPercent > 0) {
        discounted = Number((selling * (1 - inv.discountBrPercent / 100)).toFixed(2));
      }
      
      normalized.push({
        product: productDoc?._id,
        qty: it.qty,
        price: selling,
        buyingPrice: buying,
        category: categoryRaw,
        discountedPrice: discounted
      });
    }
    inv.items = normalized;
  }
  
  // Update notes
  if (updateData.notes !== undefined) {
    inv.notes = updateData.notes;
  }
  
  inv.recomputeTotals();
  await inv.save();
  await inv.populate([{ path: 'customer' }, { path: 'items.product' }]);
  return inv.toObject();
}

async function updateInvoiceItemsAndNotes(invoiceId, items, notes) {
  return updateInvoice(invoiceId, { items, notes });
}

async function archiveInvoice(invoiceId, archived) {
  const { Invoice } = getLocalModels();
  
  console.log('archiveInvoice called with:', { invoiceId, type: typeof invoiceId, archived });
  let inv = null;
  if (isNumericId(invoiceId)) {
    const n = Number(String(invoiceId).trim());
    inv = await Invoice.findOneAndUpdate({ invoiceNumber: n }, { archived: !!archived }, { new: true });
  } else {
    const validId = toObjectIdString(invoiceId);
    console.log('toObjectIdString result:', { validId, originalId: invoiceId });
    if (!validId) {
      console.error('Invalid invoice ID format:', { invoiceId, type: typeof invoiceId });
      throw new Error(`Invalid invoice ID format: ${invoiceId} (type: ${typeof invoiceId})`);
    }
    inv = await Invoice.findByIdAndUpdate(validId, { archived: !!archived }, { new: true });
  }
  if (!inv) {
    console.error('Invoice not found:', { validId });
    throw new Error(`Invoice not found`);
  }
  return inv.toObject();
}

async function createReturnInvoice(payload) {
  const { ReturnInvoice, Invoice, Product } = getLocalModels();
  let inv = null;
  if (isNumericId(payload.originalInvoice)) {
    const n = Number(String(payload.originalInvoice).trim());
    inv = await Invoice.findOne({ invoiceNumber: n });
  } else {
    const validId = toObjectIdString(payload.originalInvoice);
    if (!validId) throw new Error('Invalid original invoice ID format');
    inv = await Invoice.findById(validId);
  }
  if (!inv) throw new Error('Original invoice not found');
  // Ensure we can match by product name when needed
  try { await inv.populate({ path: 'items.product' }); } catch {}

  // Build return items: use original invoice effective price (discountedPrice ?? price)
  const items = (payload.items || []).map(raw => {
    const name = (raw.productName || raw.product || '').trim();
    const qty = Number(raw.qty || 0);
    const pid = raw.productId && Types.ObjectId.isValid(raw.productId) ? String(raw.productId) : undefined;

    // Find matching original item by productId or by product name
    let originalItem = null;
    if (pid) {
      originalItem = (inv.items || []).find(x => {
        const xid = x.product && typeof x.product === 'object' && x.product._id ? String(x.product._id) : String(x.product || '');
        return String(xid) === String(pid);
      }) || null;
    }
    if (!originalItem && name) {
      const norm = String(name).trim().toLowerCase();
      originalItem = (inv.items || []).find(x => {
        const xname = (x.product && x.product.name) ? x.product.name : '';
        return String(xname).trim().toLowerCase() === norm;
      }) || null;
    }

    const effectivePrice = Number((originalItem ? (originalItem.discountedPrice ?? originalItem.price) : Number(raw.price || 0)).toFixed(2));

    return {
      product: name,
      productId: pid ? Types.ObjectId.createFromHexString(pid) : undefined,
      productName: name,
      qty,
      price: effectivePrice
    };
  }).filter(it => it.product && it.qty > 0);
  const doc = await ReturnInvoice.create({
    originalInvoice: inv._id,
    items,
    createdAt: new Date()
  });
  // Increase stock for returned quantities
  try {
    for (const rit of items) {
      const qty = Number(rit.qty || 0);
      if (qty <= 0) continue;
      if (rit.productId && Types.ObjectId.isValid(rit.productId)) {
        await Product.updateOne({ _id: rit.productId }, { $inc: { stock: qty } });
      } else if (rit.productName) {
        // Fallback by name
        await Product.updateOne({ name: rit.productName }, { $inc: { stock: qty } });
      }
    }
  } catch (e) {
    console.warn('Stock increment on return failed:', e?.message);
  }
  // Deduct the return total from the invoice by adding a payment equal to the return amount
  const returnTotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0);
  if (returnTotal > 0) {
    inv.payments.push({ amount: returnTotal, date: new Date(), note: 'مرتجع' });
    inv.recomputeTotals();
    await inv.save();
  }
  return doc.toObject();
}

async function generateInvoicePrintableHtml(invoiceId) {
  console.log('generateInvoicePrintableHtml called with:', { invoiceId, type: typeof invoiceId });
  let inv = null;
  if (isNumericId(invoiceId)) {
    inv = await getInvoiceById(Number(String(invoiceId).trim()));
  } else {
    const validId = toObjectIdString(invoiceId);
    console.log('toObjectIdString result:', { validId, originalId: invoiceId });
    if (!validId) {
      console.error('Invalid invoice ID format:', { invoiceId, type: typeof invoiceId });
      throw new Error(`Invalid invoice ID format: ${invoiceId} (type: ${typeof invoiceId})`);
    }
    inv = await getInvoiceById(validId);
  }
  if (!inv) {
    console.error('Invoice not found:', { validId });
    throw new Error('Invoice not found');
  }
  // Try to resolve plumber phone by name for display
  let plumberPhone = '';
  try {
    if (inv.plumberName) {
      const { Plumber } = getLocalModels();
      const pl = await Plumber.findOne({ name: inv.plumberName }).lean();
      plumberPhone = pl?.phone || '';
    }
  } catch (e) {
    console.warn('Could not resolve plumber phone for', inv.plumberName, e?.message);
  }
  const paymentsRows = (inv.payments || []).map(p => `
    <tr>
      <td>${dayjs(p.date).format('YYYY-MM-DD')}</td>
      <td>${p.note || ''}</td>
      <td style="text-align:right">${Number(p.amount).toFixed(2)}</td>
    </tr>
  `).join('');
  const itemsTotal = Number(inv.total || 0);
  const paidTotal = Number((inv.payments || [])
    .filter(p => String(p.note || '').trim() !== 'مرتجع')
    .reduce((s, x) => s + Number(x.amount || 0), 0)
    .toFixed(2));
  const returnTotal = Number((inv.returnInvoice?.items || [])
    .reduce((s, ri) => s + Number(ri.qty || 0) * Number(ri.price || 0), 0)
    .toFixed(2));
  const remaining = Number((itemsTotal - (paidTotal + returnTotal)).toFixed(2));
  const returnSection = inv.returnInvoice ? `
    <h3>مرتجع</h3>
    <div>التاريخ: ${dayjs(inv.returnInvoice.createdAt).format('YYYY-MM-DD')}</div>
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:36px; text-align:center">#</th>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>السعر</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${inv.returnInvoice.items.map((ri, idx) => `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${ri.productName || ri.product}</td>
            <td style="text-align:center">${ri.qty}</td>
            <td style="text-align:right">${Number(ri.price).toFixed(2)}</td>
            <td style="text-align:right">${(Number(ri.qty || 0) * Number(ri.price || 0)).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  // Hide profit and discount percentage in print view
  // const revenue = (inv.items || []).reduce((s, it) => s + it.qty * (it.discountedPrice ?? it.price), 0);
  // const cost = (inv.items || []).reduce((s, it) => s + it.qty * (it.buyingPrice ?? 0), 0);
  // const profit = revenue - cost;
  const discountInfo = '';

  const rows = (inv.items || []).map((it, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${it.product?.name || ''}</td>
      <td>${it.category || ''}</td>
      <td style="text-align:center">${it.qty}</td>
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
        body { font-family: 'Tajawal', 'Cairo', Arial, sans-serif; padding: 16px; direction: rtl; font-size: 11px; }
        h1 { margin: 6px 0; font-size: 16px; }
        h2 { margin: 6px 0; font-size: 14px; }
        h3 { margin: 6px 0; font-size: 13px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .muted { color: #666; }
        table { direction: rtl; font-size: 11px; }
        .tbl { width:100%; border-collapse: collapse; }
        .tbl th, .tbl td { border: 1px solid #e5e7eb; padding: 3px 4px; }
        .tbl thead th { background:#f3f4f6; }
        .totals-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-top:12px; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:8px; }
        .card .label { font-size:10px; color:#6b7280; margin-bottom:4px; }
        .card .value { font-size:16px; font-weight:700; color:#111827; }
      </style>
    </head>
    <body>
      <h1>معرض احمد بدوي</h1>
      <div class="muted">هاتف: 01003771479 | العنوان: الكرنك الجديد / نجع بدران</div>
      <hr/>
      <div class="grid">
        <div>
          <div><strong>العميل:</strong> ${inv.customer?.name || ''}</div>
          <div><strong>الهاتف:</strong> ${inv.customer?.phone || ''}</div>
          <div><strong>السباك:</strong> ${inv.plumberName || ''}${plumberPhone ? ` — هاتف: ${plumberPhone}` : ''}</div>
        </div>
        <div style="text-align:left">
          <div><strong>التاريخ:</strong> ${dayjs(inv.createdAt).format('YYYY-MM-DD HH:mm')}</div>
          <div><strong>آخر تحديث:</strong> ${dayjs(inv.updatedAt).format('YYYY-MM-DD HH:mm')}</div>
        </div>
      </div>
      ${discountInfo}
      <h2>الأصناف</h2>
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:36px; text-align:center">#</th>
            <th>الصنف</th>
            <th>الفئة</th>
            <th>الكمية</th>
            <th>سعر البيع</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      
      ${returnSection}
      <h3>المدفوعات</h3>
      <table class="tbl">
        <thead><tr><th>التاريخ</th><th>ملاحظة</th><th>المبلغ</th></tr></thead>
        <tbody>${paymentsRows}</tbody>
      </table>
      <h3>ملاحظات</h3>
      <div>${(inv.notes || '').replace(/</g, '&lt;')}</div>
      <div class="totals-grid">
        <div class="card"><div class="label">إجمالي الأصناف</div><div class="value">${itemsTotal.toFixed(2)}</div></div>
        <div class="card"><div class="label">إجمالي المدفوع</div><div class="value">${paidTotal.toFixed(2)}</div></div>
        <div class="card"><div class="label">إجمالي المرتجع</div><div class="value">${returnTotal.toFixed(2)}</div></div>
        <div class="card"><div class="label">المتبقي</div><div class="value" style="color:${remaining > 0 ? '#dc2626' : '#16a34a'}">${remaining.toFixed(2)}</div></div>
      </div>
    </body>
  </html>`;
}

async function deleteInvoice(invoiceId) {
  const { Invoice, ReturnInvoice } = getLocalModels();
  let inv = null;
  if (isNumericId(invoiceId)) {
    const n = Number(String(invoiceId).trim());
    inv = await Invoice.findOne({ invoiceNumber: n });
  } else {
    const validId = toObjectIdString(invoiceId);
    if (!validId) throw new Error('Invalid invoice ID format');
    inv = await Invoice.findById(validId);
  }
  if (!inv) throw new Error('Invoice not found');
  // Remove related return invoice if exists
  await ReturnInvoice.deleteOne({ originalInvoice: inv._id });
  await Invoice.deleteOne({ _id: inv._id });
  return { success: true };
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoiceById,
  addPaymentToInvoice,
  updateInvoice,
  updateInvoiceItemsAndNotes,
  archiveInvoice,
  createReturnInvoice,
  generateInvoicePrintableHtml,
  deleteInvoice
};
