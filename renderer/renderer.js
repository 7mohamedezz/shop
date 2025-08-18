const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function currency(n) { return (Number(n || 0)).toFixed(2); }

// Tabs
$$('.tab').forEach(btn => btn.addEventListener('click', () => {
  $$('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.getAttribute('data-tab');
  $$('.page').forEach(p => p.classList.remove('active'));
  $('#' + tab).classList.add('active');
}));

// Plumber autocomplete
const plumberInput = $('#plumber-name');
const plumberSug = $('#plumber-suggestions');
if (plumberInput) {
  plumberInput.addEventListener('input', async () => {
    const q = plumberInput.value.trim();
    if (!q) { plumberSug.style.display = 'none'; plumberSug.innerHTML = ''; return; }
    const list = await window.api.plumbers.list();
    const filtered = list.filter(p => p.name.toLowerCase().startsWith(q.toLowerCase())).slice(0, 10);
    if (!filtered.length) { plumberSug.style.display = 'none'; plumberSug.innerHTML=''; return; }
    plumberSug.innerHTML = filtered.map(p => `<div data-name="${p.name}">${p.name}${p.phone ? ' — '+p.phone : ''}</div>`).join('');
    plumberSug.style.display = 'block';
  });
  plumberSug.addEventListener('click', (e) => {
    const d = e.target.closest('div');
    if (!d) return;
    plumberInput.value = d.getAttribute('data-name');
    plumberSug.style.display = 'none';
  });
}

function normalizeCategory(name) {
  if (!name) return '';
  const n = String(name).replace(/\s+/g, '').toLowerCase();
  if (n === 'br') return 'br';
  if (n === 'ابوغالي' || n === 'abogali' || n === 'aboghali' || n === 'aboghly') return 'ابوغالي';
  return n;
}

function applyDiscountToRow(tr) {
  const priceInput = tr.querySelector('.item-price');
  const basePrice = Number(tr.dataset.basePrice || 0);
  if (basePrice === 0) return; // No base price set yet
  
  const cat = normalizeCategory(tr.dataset.category || '');
  const abog = Number(($('#discount-abogali')?.value) || 0);
  const br = Number(($('#discount-br')?.value) || 0);
  
  let finalPrice = basePrice;
  
  if (cat === 'ابوغالي' && abog > 0) {
    finalPrice = basePrice * (1 - abog / 100);
  } else if (cat === 'br' && br > 0) {
    finalPrice = basePrice * (1 - br / 100);
  }
  
  priceInput.value = Number(finalPrice).toFixed(2);
}

function applyDiscountsToAllRows() {
  $$('#items-body tr').forEach(tr => {
    applyDiscountToRow(tr);
  });
  recomputeTotals();
}

// Invoice form state
function newItemRow() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <div class="autocomplete">
        <input type="text" class="item-name" placeholder="اسم المنتج" />
        <div class="suggestions" style="display:none"></div>
      </div>
    </td>
    <td><input type="number" class="item-qty" placeholder="الكمية" value="1" step="1" min="0" /></td>
    <td><input type="number" class="item-price" placeholder="سعر البيع" step="0.01" min="0" /></td>
    <td class="item-subtotal" style="text-align:center">0.00</td>
    <td><button type="button" class="remove-item">✕</button></td>
  `;

  const nameInput = tr.querySelector('.item-name');
  const priceInput = tr.querySelector('.item-price');
  const qtyInput = tr.querySelector('.item-qty');
  const subtotalCell = tr.querySelector('.item-subtotal');
  const sugg = tr.querySelector('.suggestions');

  let selectedProduct = null;
  nameInput.addEventListener('input', async () => {
    const q = nameInput.value.trim();
    if (!q) { sugg.style.display = 'none'; sugg.innerHTML=''; selectedProduct = null; tr.dataset.basePrice=''; tr.dataset.category=''; recomputeTotals(); return; }
    const list = await window.api.products.search(q);
    if (!list.length) { sugg.style.display = 'none'; sugg.innerHTML=''; selectedProduct = null; return; }
    sugg.innerHTML = list.map(p => `<div data-id="${p._id}" data-price="${p.sellingPrice ?? p.price}" data-buy="${p.buyingPrice ?? 0}" data-category="${p.category || ''}">${p.name} <span style="color:#94a3b8">[${p.category || '—'}]</span> — بيع ${currency(p.sellingPrice ?? p.price)} (شراء ${currency(p.buyingPrice ?? 0)})</div>`).join('');
    sugg.style.display = 'block';
  });

  sugg.addEventListener('click', (e) => {
    const d = e.target.closest('div');
    if (!d) return;
    selectedProduct = { _id: d.getAttribute('data-id'), price: Number(d.getAttribute('data-price')), buy: Number(d.getAttribute('data-buy')), category: d.getAttribute('data-category') };
    nameInput.value = d.textContent.split(' [')[0].trim();
    tr.dataset.basePrice = String(selectedProduct.price);
    tr.dataset.category = selectedProduct.category || '';
    
    // Apply discount based on current discount percentages
    applyDiscountToRow(tr);
    
    sugg.style.display = 'none';
    updateRowSubtotal();
    recomputeTotals();
  });

  tr.querySelector('.remove-item').addEventListener('click', () => {
    tr.remove();
    recomputeTotals();
  });

  function updateRowSubtotal() {
    const qty = Number(qtyInput.value || 0);
    const price = Number(priceInput.value || 0);
    subtotalCell.textContent = currency(qty * price);
  }

  for (const input of [priceInput, qtyInput]) {
    input.addEventListener('input', () => { updateRowSubtotal(); recomputeTotals(); });
  }

  tr.getData = () => ({
    name: nameInput.value.trim(),
    price: Number(tr.dataset.basePrice || priceInput.value || 0), // Send original base price, not discounted price
    qty: Number(qtyInput.value || 0),
    product: selectedProduct?._id || null,
    buyingPrice: selectedProduct?.buy ?? undefined,
    category: selectedProduct?.category || undefined
  });

  updateRowSubtotal();
  return tr;
}

function newPaymentRow() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" class="pay-amount" step="0.01" min="0" placeholder="المبلغ" /></td>
    <td><input type="date" class="pay-date" /></td>
    <td><input type="text" class="pay-note" placeholder="ملاحظة/طريقة" /></td>
    <td><button type="button" class="remove-payment">✕</button></td>
  `;
  tr.querySelector('.remove-payment').addEventListener('click', () => tr.remove());
  return tr;
}

$('#add-item').addEventListener('click', () => { $('#items-body').appendChild(newItemRow()); });
$('#add-payment').addEventListener('click', () => { $('#payments-body').appendChild(newPaymentRow()); });

// Re-apply discounts when discount fields change
$('#discount-abogali')?.addEventListener('input', applyDiscountsToAllRows);
$('#discount-br')?.addEventListener('input', applyDiscountsToAllRows);

// Adjust recomputeTotals to respect updated price (already done by using price inputs)
function recomputeTotals() {
  let total = 0;
  $$('#items-body tr').forEach(tr => {
    // Don't apply discount here - it should already be applied
    const qty = Number(tr.querySelector('.item-qty').value || 0);
    const price = Number(tr.querySelector('.item-price').value || 0);
    const subtotal = qty * price;
    const cell = tr.querySelector('.item-subtotal');
    if (cell) cell.textContent = currency(subtotal);
    total += subtotal;
  });
  let paid = 0;
  $$('#payments-body tr').forEach(tr => { paid += Number(tr.querySelector('.pay-amount').value || 0); });
  $('#total').textContent = currency(total);
  $('#remaining').textContent = currency(Math.max(0, total - paid));
}

$('#invoice-form').addEventListener('input', recomputeTotals);

$('#invoice-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = $$('#items-body tr').map(tr => tr.getData()).filter(it => it.name && it.price >= 0 && it.qty >= 0);
  if (!items.length) { $('#invoice-error').textContent = 'أضف بندًا واحدًا على الأقل.'; return; }
  if (!$('#cust-name').value.trim() || !$('#cust-phone').value.trim()) { $('#invoice-error').textContent = 'اسم العميل ورقم الهاتف مطلوبان.'; return; }
  const payments = $$('#payments-body tr').map(tr => ({ amount: Number(tr.querySelector('.pay-amount').value || 0), date: tr.querySelector('.pay-date').value || new Date().toISOString(), note: tr.querySelector('.pay-note').value })).filter(p => p.amount > 0);

  const payload = {
    customer: { name: $('#cust-name').value.trim(), phone: $('#cust-phone').value.trim() },
    plumberName: $('#plumber-name').value.trim(),
    items,
    payments,
    notes: $('#invoice-notes').value,
    discountAbogaliPercent: Number($('#discount-abogali').value || 0),
    discountBrPercent: Number($('#discount-br').value || 0)
  };

  try {
    $('#invoice-error').textContent = 'جاري إنشاء الفاتورة...';
    const result = await window.api.invoices.create(payload);
    
    if (result && result.error) { 
      $('#invoice-error').textContent = result.message || 'فشل إنشاء الفاتورة.'; 
      return; 
    }
    
    // Success! Show message and refresh invoice list
    $('#invoice-error').textContent = 'تم إنشاء الفاتورة بنجاح!';
    $('#invoice-error').style.color = '#16a34a';
    
    // Clear form
    $('#items-body').innerHTML = '';
    $('#payments-body').innerHTML = '';
    $('#invoice-form').reset();
    recomputeTotals();
    
    // Refresh invoice list to show the new invoice
    await loadInvoices();
    
    // Switch to invoices tab to show the new invoice
    $$('.tab').forEach(b => b.classList.remove('active'));
    $('[data-tab="invoices"]').classList.add('active');
    $$('.page').forEach(p => p.classList.remove('active'));
    $('#invoices').classList.add('active');
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      $('#invoice-error').textContent = '';
      $('#invoice-error').style.color = '#fca5a5';
    }, 3000);
    
  } catch (error) {
    $('#invoice-error').textContent = 'خطأ في إنشاء الفاتورة: ' + (error.message || 'خطأ غير معروف');
    $('#invoice-error').style.color = '#fca5a5';
  }
});

// Live search for customer in invoice
const custNameInput = $('#cust-name');
const custSug = $('#cust-suggestions');
if (custNameInput) {
  custNameInput.addEventListener('input', async () => {
    const q = custNameInput.value.trim();
    if (!q) { custSug.style.display = 'none'; custSug.innerHTML=''; return; }
    const list = await window.api.customers.search(q);
    if (!list.length) { custSug.style.display='none'; custSug.innerHTML=''; return; }
    custSug.innerHTML = list.map(c => `<div data-name="${c.name}" data-phone="${c.phone}">${c.name} — ${c.phone}</div>`).join('');
    custSug.style.display = 'block';
  });
  custSug.addEventListener('click', (e) => {
    const d = e.target.closest('div');
    if (!d) return;
    $('#cust-name').value = d.getAttribute('data-name');
    $('#cust-phone').value = d.getAttribute('data-phone');
    custSug.style.display='none';
  });
}

// Customers/Plumbers page live search
const liveCustomerSearch = $('#live-customer-search');
const liveCustomerResults = $('#live-customer-results');
if (liveCustomerSearch) {
  liveCustomerSearch.addEventListener('input', async () => {
    const q = liveCustomerSearch.value.trim();
    if (!q) { liveCustomerResults.style.display='none'; liveCustomerResults.innerHTML=''; return; }
    const list = await window.api.customers.search(q);
    liveCustomerResults.innerHTML = list.map(c => `<div>${c.name} — ${c.phone}</div>`).join('');
    liveCustomerResults.style.display = list.length ? 'block' : 'none';
  });
}

const livePlumberSearch = $('#live-plumber-search');
const livePlumberResults = $('#live-plumber-results');
if (livePlumberSearch) {
  livePlumberSearch.addEventListener('input', async () => {
    const q = livePlumberSearch.value.trim();
    if (!q) { livePlumberResults.style.display='none'; livePlumberResults.innerHTML=''; return; }
    const list = await window.api.plumbers.search(q);
    livePlumberResults.innerHTML = list.map(p => `<div>${p.name}${p.phone ? ' — ' + p.phone : ''}</div>`).join('');
    livePlumberResults.style.display = list.length ? 'block' : 'none';
  });
}

// Invoice list: view detail and create return invoice preserving sold prices
async function showInvoiceDetail(id) {
  console.log('showInvoiceDetail called with id:', id, typeof id);
  try {
    const inv = await window.api.invoices.getById(id);
    console.log('Invoice data received:', inv);
    const panel = $('#invoice-detail');
    if (!inv) { 
      console.log('No invoice found, hiding panel');
      panel.style.display='none'; 
      return; 
    }
  
    // Calculate totals
    const itemsTotal = (inv.items || []).reduce((sum, it) => sum + (it.qty || 0) * (it.discountedPrice ?? it.price), 0);
    const paidTotal = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const remaining = Math.max(0, itemsTotal - paidTotal);
    
    // Format dates
    const createdDate = new Date(inv.createdAt).toLocaleDateString('ar-SA');
    const updatedDate = new Date(inv.updatedAt).toLocaleDateString('ar-SA');
    
    // Items table
    const itemsRows = (inv.items || []).map(it => {
      const itemTotal = (it.qty || 0) * (it.discountedPrice ?? it.price);
      const discountInfo = it.discountedPrice != null ? ` <span style="color:#16a34a">(-${(100 - (it.discountedPrice / it.price * 100)).toFixed(0)}%)</span>` : '';
      return `<tr>
        <td>${it.product?.name || ''}</td>
        <td>${it.category || ''}</td>
        <td>${it.qty}</td>
        <td>${(it.discountedPrice ?? it.price).toFixed(2)}${discountInfo}</td>
        <td>${itemTotal.toFixed(2)}</td>
      </tr>`;
    }).join('');
    
    // Payments table
    const paymentsRows = (inv.payments || []).map(p => {
      const paymentDate = new Date(p.date).toLocaleDateString('ar-SA');
      return `<tr>
        <td>${paymentDate}</td>
        <td>${p.note || ''}</td>
        <td>${Number(p.amount).toFixed(2)}</td>
        <td><button type="button" class="remove-payment-btn" data-payment-id="${p._id || 'temp'}">حذف</button></td>
      </tr>`;
    }).join('');
    
    // Discount info
    const discountInfo = (inv.discountAbogaliPercent > 0 || inv.discountBrPercent > 0)
      ? `<div style="margin:8px 0; padding:8px; background:#f0f9ff; border-radius:4px;">
           <strong>الخصومات:</strong> ابوغالي ${inv.discountAbogaliPercent}% | BR ${inv.discountBrPercent}%
         </div>`
      : '';
    
    panel.innerHTML = `
      <h3>تفاصيل الفاتورة</h3>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
        <div>
          <div><strong>العميل:</strong> ${inv.customer?.name || ''}</div>
          <div><strong>الهاتف:</strong> ${inv.customer?.phone || ''}</div>
          <div><strong>السباك:</strong> ${inv.plumberName || ''}</div>
        </div>
        <div>
          <div><strong>تاريخ الإنشاء:</strong> ${createdDate}</div>
          <div><strong>آخر تحديث:</strong> ${updatedDate}</div>
          <div><strong>الحالة:</strong> ${inv.archived ? 'مؤرشف' : 'نشط'}</div>
        </div>
      </div>
      
      ${discountInfo}
      
      <h4>الأصناف</h4>
      <table class="items-table" style="margin-top:8px">
        <thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      
      <div style="margin:16px 0; padding:12px; background:#f8fafc; border-radius:4px;">
        <div><strong>إجمالي الأصناف:</strong> ${itemsTotal.toFixed(2)}</div>
        <div><strong>إجمالي المدفوع:</strong> ${paidTotal.toFixed(2)}</div>
        <div><strong>المتبقي:</strong> <span style="color:${remaining > 0 ? '#dc2626' : '#16a34a'}">${remaining.toFixed(2)}</span></div>
      </div>
      
      <h4>المدفوعات</h4>
      <table class="items-table" style="margin-top:8px">
        <thead><tr><th>التاريخ</th><th>ملاحظة</th><th>المبلغ</th><th></th></tr></thead>
        <tbody>${paymentsRows}</tbody>
      </table>
      
      <div style="margin:16px 0; padding:12px; background:#f0fdf4; border-radius:4px;">
        <h5>إضافة دفعة جديدة</h5>
        <div class="row" style="gap:8px; align-items:end;">
        <input type="number" id="new-payment-amount" placeholder="المبلغ" step="0.01" min="0" style="width:120px" />
        <input type="date" id="new-payment-date" style="width:140px" />
        <input type="text" id="new-payment-note" placeholder="ملاحظة" style="width:200px" />
        <button type="button" id="add-payment-btn" data-invoice-id="${inv._id}">إضافة دفعة</button>
      </div>
    </div>
    
    <div class="row" style="margin-top:16px; gap:8px;">
      <button id="btn-make-return" data-id="${inv._id}">إنشاء فاتورة مرتجع</button>
      <button id="btn-print-invoice" data-id="${inv._id}">طباعة الفاتورة</button>
      <button id="btn-archive-invoice" data-id="${inv._id}" style="background-color:${inv.archived ? '#16a34a' : '#dc2626'}">${inv.archived ? 'إلغاء الأرشفة' : 'أرشفة'}</button>
    </div>
    
    <div id="return-form" style="display:none; margin-top:16px"></div>
  `;
  
  panel.style.display = 'block';
  
  // Add event listeners
  $('#btn-make-return').addEventListener('click', () => buildReturnForm(inv));
  $('#btn-print-invoice').addEventListener('click', async () => {
    await window.api.print.invoice(inv._id);
  });
  $('#btn-archive-invoice').addEventListener('click', async () => {
    await window.api.invoices.archive(inv._id, !inv.archived);
    await loadInvoices(); // Refresh the list
    await showInvoiceDetail(inv._id); // Refresh the detail view
  });
  $('#add-payment-btn').addEventListener('click', async () => {
    const amount = Number($('#new-payment-amount').value || 0);
    const date = $('#new-payment-date').value || new Date().toISOString().split('T')[0];
    const note = $('#new-payment-note').value || '';
    
    if (amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }
    
    try {
      await window.api.invoices.addPayment(inv._id, { amount, date, note });
      // Refresh the detail view to show the new payment
      await showInvoiceDetail(inv._id);
      // Clear the form
      $('#new-payment-amount').value = '';
      $('#new-payment-date').value = '';
      $('#new-payment-note').value = '';
    } catch (error) {
      alert('خطأ في إضافة الدفعة: ' + error.message);
    }
  });
  
  // Handle payment removal (if needed)
  panel.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove-payment-btn')) {
      // Note: You might want to add a removePayment API endpoint
      alert('ميزة حذف المدفوعات غير متوفرة حالياً');
    }
  });
  
  } catch (error) {
    console.error('Error showing invoice detail:', error);
    const panel = $('#invoice-detail');
    panel.innerHTML = `<div style="color: red; padding: 20px;">خطأ في عرض تفاصيل الفاتورة: ${error.message}</div>`;
    panel.style.display = 'block';
  }
}

function buildReturnForm(inv) {
  const mount = $('#return-form');
  const rows = (inv.items || []).map((it, idx) => `
    <tr>
      <td>${it.product?.name || ''}</td>
      <td><input type="number" id="ret-qty-${idx}" min="0" max="${it.qty}" value="0" step="1" /></td>
      <td><input type="number" id="ret-price-${idx}" step="0.01" value="${it.price.toFixed(2)}" /></td>
      <td><input type="text" id="ret-reason-${idx}" placeholder="سبب" /></td>
    </tr>
  `).join('');
  mount.innerHTML = `
    <h4>إنشاء مرتجع</h4>
    <table class="items-table"><thead><tr><th>الصنف</th><th>كمية مرتجعة</th><th>سعر البيع (الأصلي)</th><th>السبب</th></tr></thead><tbody>${rows}</tbody></table>
    <button id="submit-return">حفظ المرتجع</button>
  `;
  mount.style.display = 'block';
  $('#submit-return').addEventListener('click', async () => {
    const items = (inv.items || []).map((it, idx) => ({
      product: it.product?.name || '',
      qty: Number($('#ret-qty-' + idx).value || 0),
      price: Number($('#ret-price-' + idx).value || it.price),
      reason: $('#ret-reason-' + idx).value
    })).filter(x => x.qty > 0);
    if (!items.length) return;
    await window.api.returns.create({ originalInvoice: inv._id, items });
    $('#return-form').style.display = 'none';
  });
}

async function loadInvoices() {
  console.log('Loading invoices...');
  const search = $('#invoice-search').value.trim();
  const filter = $('#archive-filter').value;
  const filters = {};
  if (search) filters.search = search;
  if (filter === 'active') filters.archived = false;
  if (filter === 'archived') filters.archived = true;
  
  try {
    const list = await window.api.invoices.list(filters);
    console.log('Invoices loaded:', list.length, list);
    const container = $('#invoice-list');
    if (!container) {
      console.error('Invoice list container not found!');
      return;
    }
    container.innerHTML = '';
    
    if (list.length === 0) {
      container.innerHTML = '<div class="muted">لا توجد فواتير</div>';
      console.log('No invoices found, showing empty message');
      return;
    }
    
    console.log('Rendering', list.length, 'invoices');
    
    list.forEach(inv => {
    const revenue = (inv.items || []).reduce((s, it) => s + it.qty * (it.discountedPrice ?? it.price), 0);
    const cost = (inv.items || []).reduce((s, it) => s + it.qty * (it.buyingPrice ?? 0), 0);
    const profit = revenue - cost;
    const card = document.createElement('div');
    card.className = 'list-card';
    const discountInfo = (inv.discountAbogaliPercent > 0 || inv.discountBrPercent > 0)
      ? ` | خصم ابوغالي ${inv.discountAbogaliPercent}% | خصم BR ${inv.discountBrPercent}%`
      : '';
    const invoiceId = String(inv._id);
    card.innerHTML = `
      <div>
        <div><strong>${inv.customer?.name || ''}</strong> — ${inv.customer?.phone || ''}</div>
        <div class="muted">السباك: ${inv.plumberName || ''}${discountInfo}</div>
        <div class="muted">تاريخ الإنشاء: ${new Date(inv.createdAt).toLocaleString()} | آخر تحديث: ${new Date(inv.updatedAt).toLocaleString()}</div>
        <div>الإجمالي: ${currency(inv.total)} | المتبقي: ${currency(inv.remaining)} | الربح: ${currency(profit)}</div>
      </div>
      <div>
        <button type="button" data-id="${invoiceId}" class="btn-view">عرض</button>
        <button type="button" data-id="${invoiceId}" class="btn-print">طباعة</button>
        <button type="button" data-id="${invoiceId}" class="btn-archive">${inv.archived ? 'إلغاء الأرشفة' : 'أرشفة'}</button>
      </div>
    `;
    container.appendChild(card);
    console.log('Added invoice card for:', inv.customer?.name || 'Unknown');
  });
  
  console.log('All invoice cards added to container');
  } catch (error) {
    console.error('Error loading invoices:', error);
    const container = $('#invoice-list');
    if (container) {
      container.innerHTML = '<div class="muted" style="color: red;">خطأ في تحميل الفواتير</div>';
    }
  }
}

$('#refresh-invoices').addEventListener('click', loadInvoices);
$('#archive-filter').addEventListener('change', loadInvoices);
$('#invoice-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadInvoices(); });

// Invoice list button handlers
$('#invoice-list').addEventListener('click', async (e) => {
  console.log('Invoice list clicked:', e.target);
  const btn = e.target.closest('button');
  if (!btn) {
    console.log('No button found in click target');
    return;
  }
  
  const id = btn.getAttribute('data-id');
  console.log('Button clicked:', btn.className, 'ID:', id);
  
  if (btn.classList.contains('btn-print')) {
    console.log('Print button clicked');
    await window.api.print.invoice(id);
  } else if (btn.classList.contains('btn-archive')) {
    console.log('Archive button clicked');
    const invoices = await window.api.invoices.list({});
    const inv = invoices.find(x => String(x._id) === id);
    if (inv) {
      console.log('Archiving invoice with ID:', id, 'Type:', typeof id);
      await window.api.invoices.archive(String(id), !inv.archived);
      await loadInvoices();
    }
  } else if (btn.classList.contains('btn-view')) {
    console.log('View button clicked for invoice:', id);
    await showInvoiceDetail(id);
    const detailPanel = document.getElementById('invoice-detail');
    if (detailPanel) {
      detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

// Utility: debounce
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Product page: live search and edit/delete per row
$('#product-search-btn')?.addEventListener('click', async () => {
  const q = $('#product-search').value.trim();
  const list = q ? await window.api.products.search(q) : await window.api.products.list();
  renderProductList(list);
});

$('#product-search')?.addEventListener('input', debounce(async (e) => {
  const q = e.target.value.trim();
  const list = q ? await window.api.products.search(q) : await window.api.products.list();
  renderProductList(list);
}, 250));

function mountProductRow(product) {
  const row = document.createElement('div');
  row.className = 'list-card';

  function setViewMode(p) {
    row.innerHTML = `
      <div><strong>${p.name}</strong> — [${p.category || '—'}] — شراء ${currency(p.buyingPrice ?? 0)} | بيع ${currency(p.sellingPrice ?? p.price ?? 0)} | ربح/وحدة ${currency((p.sellingPrice ?? p.price ?? 0) - (p.buyingPrice ?? 0))} | مخزون: ${p.stock}</div>
      <div>
        <button type="button" data-id="${p._id}" class="btn-edit">تعديل</button>
        <button type="button" data-id="${p._id}" class="btn-delete">حذف</button>
      </div>
    `;
  }

  function setEditMode(p) {
    row.innerHTML = `
      <div>
        <input value="${p.name}" class="edit-name" style="width:180px" />
        <input value="${p.category || ''}" class="edit-category" style="width:120px" />
        <input type="number" value="${p.buyingPrice ?? 0}" class="edit-buy" step="0.01" style="width:110px" />
        <input type="number" value="${p.sellingPrice ?? p.price ?? 0}" class="edit-sell" step="0.01" style="width:110px" />
        <input type="number" value="${p.stock}" class="edit-stock" style="width:90px" />
      </div>
      <div>
        <button type="button" data-id="${p._id}" class="btn-save">حفظ</button>
        <button type="button" data-id="${p._id}" class="btn-cancel">إلغاء</button>
      </div>
    `;
  }

  setViewMode(product);

  row.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = (e.target.getAttribute && e.target.getAttribute('data-id')) || product._id;
    if (e.target.classList.contains('btn-edit')) {
      setEditMode(product);
    } else if (e.target.classList.contains('btn-cancel')) {
      setViewMode(product);
    } else if (e.target.classList.contains('btn-save')) {
      const name = row.querySelector('.edit-name').value.trim();
      const category = row.querySelector('.edit-category').value.trim();
      const buyingPrice = Number(row.querySelector('.edit-buy').value || 0);
      const sellingPrice = Number(row.querySelector('.edit-sell').value || 0);
      const stock = Number(row.querySelector('.edit-stock').value || 0);
      const updated = await window.api.products.update(id, { name, category, buyingPrice, sellingPrice, stock });
      product = updated;
      setViewMode(product);
      const msg = $('#product-message');
      if (msg) { msg.textContent = 'تم التحديث'; setTimeout(() => (msg.textContent = ''), 1500); }
    } else if (e.target.classList.contains('btn-delete')) {
      await window.api.products.delete(id);
      row.remove();
      const msg = $('#product-message');
      if (msg) { msg.textContent = 'تم الحذف'; setTimeout(() => (msg.textContent = ''), 1500); }
    }
  });

  return row;
}

function renderProductList(list) {
  const container = $('#product-list');
  container.innerHTML = '';
  list.forEach(p => container.appendChild(mountProductRow(p)));
}

// Update existing loadProducts to use new renderer
async function loadProducts() {
  const list = await window.api.products.list();
  renderProductList(list);
}

// Customers & Plumbers page
const customerForm = $('#customer-form');
if (customerForm) {
  customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.api.customers.upsert({ name: $('#new-cust-name').value.trim(), phone: $('#new-cust-phone').value.trim() });
      $('#new-cust-name').value = '';
      $('#new-cust-phone').value = '';
      await loadCustomers();
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  });
}

const plumberForm = $('#plumber-form');
if (plumberForm) {
  plumberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.api.plumbers.upsert({ name: $('#new-plumber-name').value.trim(), phone: $('#new-plumber-phone').value.trim() });
      $('#new-plumber-name').value = '';
      $('#new-plumber-phone').value = '';
      await loadPlumbers();
    } catch (error) {
      console.error('Error creating plumber:', error);
    }
  });
}

const refreshPeopleBtn = $('#refresh-people');
if (refreshPeopleBtn) {
  refreshPeopleBtn.addEventListener('click', async () => { 
    try {
      await loadCustomers(); 
      await loadPlumbers(); 
    } catch (error) {
      console.error('Error refreshing people:', error);
    }
  });
}

async function loadCustomers() {
  const list = await window.api.customers.list();
  const container = $('#customer-list');
  if (!container) return;
  container.innerHTML = '';
  list.forEach(c => {
    const row = document.createElement('div');
    row.className = 'list-card';
    row.textContent = `${c.name} — ${c.phone}`;
    container.appendChild(row);
  });
}

async function loadPlumbers() {
  const list = await window.api.plumbers.list();
  const container = $('#plumber-list');
  if (!container) return;
  container.innerHTML = '';
  list.forEach(p => {
    const row = document.createElement('div');
    row.className = 'list-card';
    row.textContent = `${p.name}${p.phone ? ' — ' + p.phone : ''}`;
    container.appendChild(row);
  });
}

// Search page
const searchBtn = $('#search-btn');
if (searchBtn) {
  searchBtn.addEventListener('click', async () => {
    try {
      $('#invoice-search').value = $('#search-input').value;
      $$('.tab').find(t => t.getAttribute('data-tab') === 'الفواتير' || t.getAttribute('data-tab') === 'invoices')?.click();
      await loadInvoices();
    } catch (error) {
      console.error('Error searching:', error);
    }
  });
}

// Products creation form: stay on products tab and show status
const productForm = $('#product-form');
if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const created = await window.api.products.create({
        name: $('#prod-name').value.trim(),
        category: $('#prod-category').value.trim(),
        buyingPrice: Number($('#prod-buy').value || 0),
        sellingPrice: Number($('#prod-sell').value || 0),
        stock: Number($('#prod-stock').value || 0)
      });
      $('#prod-name').value = '';
      $('#prod-category').value = '';
      $('#prod-buy').value = '';
      $('#prod-sell').value = '';
      $('#prod-stock').value = '';
      const msg = $('#product-message');
      if (msg) { msg.textContent = `تم الحفظ: ${created.name}`; setTimeout(() => (msg.textContent = ''), 2000); }
      await loadProducts();
    } catch (error) {
      console.error('Error creating product:', error);
    }
  });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app...');
  
  // Test if basic elements exist
  const invoiceList = $('#invoice-list');
  const refreshBtn = $('#refresh-invoices');
  console.log('Invoice list element:', invoiceList ? 'Found' : 'NOT FOUND');
  console.log('Refresh button:', refreshBtn ? 'Found' : 'NOT FOUND');
  
  // Add visible indicator that frontend is working
  if (invoiceList) {
    invoiceList.innerHTML = '<div style="color: green; padding: 10px; border: 2px solid green;">✓ Frontend loaded successfully - Testing invoice loading...</div>';
  }
  
  // Initial boot
  try {
    $('#add-item')?.click();
    $('#add-payment')?.click();
    
    // Force load invoices with extra logging
    console.log('About to load invoices...');
    setTimeout(() => {
      loadInvoices().then(() => {
        console.log('loadInvoices completed');
      }).catch(error => {
        console.error('loadInvoices failed:', error);
        if (invoiceList) {
          invoiceList.innerHTML = '<div style="color: red; padding: 10px; border: 2px solid red;">✗ Error loading invoices: ' + error.message + '</div>';
        }
      });
    }, 1000);
    
    loadProducts();
    loadCustomers();
    loadPlumbers();
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Error initializing app:', error);
    if (invoiceList) {
      invoiceList.innerHTML = '<div style="color: red; padding: 10px; border: 2px solid red;">✗ Error initializing: ' + error.message + '</div>';
    }
  }
});
