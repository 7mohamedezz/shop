const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Debug mode flag - set to false to disable all console logging
const DEBUG_MODE = false;

function currency(n) { return (Number(n || 0)).toFixed(2); }

// Simple modal helper for editing a person's name/phone (customer/plumber)
async function openEditPersonModal({ title = 'تعديل', name = '', phone = '', requirePhone = false }) {
  const modal = document.getElementById('edit-person-modal');
  if (!modal) {
    // Fallback in case modal not present
    return null;
  }
  const titleEl = document.getElementById('edit-person-title');
  const nameEl = document.getElementById('edit-person-name');
  const phoneEl = document.getElementById('edit-person-phone');
  const errEl = document.getElementById('edit-person-error');
  const btnCancel = document.getElementById('edit-person-cancel');
  const btnSave = document.getElementById('edit-person-save');

  titleEl.textContent = title;
  nameEl.value = name || '';
  phoneEl.value = phone || '';
  errEl.textContent = '';

  // show
  modal.style.display = 'flex';

  return new Promise(resolve => {
    function cleanup() {
      btnCancel.removeEventListener('click', onCancel);
      btnSave.removeEventListener('click', onSave);
      modal.removeEventListener('click', onBackdrop);
    }
    function close(result) {
      modal.style.display = 'none';
      cleanup();
      resolve(result);
    }
    function onCancel() { close(null); }
    function onBackdrop(e) { if (e.target === modal) close(null); }
    function onSave() {
      const n = (nameEl.value || '').trim();
      const p = (phoneEl.value || '').trim();
      if (!n) { errEl.textContent = 'الاسم مطلوب'; return; }
      if (requirePhone && !p) { errEl.textContent = 'الهاتف مطلوب'; return; }
      close({ name: n, phone: p });
    }
    btnCancel.addEventListener('click', onCancel);
    btnSave.addEventListener('click', onSave);
    modal.addEventListener('click', onBackdrop);
  });
}


// Display invoices by explicit filters (customerId, plumberName, archived)
async function displayInvoicesWithFilters(filters = {}) {
  try {
    const list = await window.api.invoices.list(filters);
    const container = $('#search-results');
    if (!container) return;
    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = '<div class="muted">لا توجد فواتير</div>';
      return;
    }
    list.forEach(inv => {
      let invoiceId = inv._id;
      if (typeof invoiceId === 'object' && invoiceId.buffer) {
        invoiceId = Array.from(invoiceId.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (typeof invoiceId === 'object' && invoiceId.toString) {
        invoiceId = invoiceId.toString();
      }
      // Prefer numeric invoiceNumber when available for external actions
      const externalId = (inv.invoiceNumber != null) ? inv.invoiceNumber : invoiceId;
      const card = document.createElement('div');
      card.className = 'list-card';
      const discountInfo = (inv.discountAbogaliPercent > 0 || inv.discountBrPercent > 0)
        ? ` | خصم ابوغالي ${inv.discountAbogaliPercent}% | خصم BR ${inv.discountBrPercent}%`
        : '';
      card.innerHTML = `
        <div>
          <div><strong>${inv.customerName || inv.customer?.name || ''}</strong> — ${inv.customerPhone || inv.customer?.phone || ''}</div>
          <div class="muted">السباك: ${inv.plumberName || ''}${discountInfo}</div>
          <div class="muted">تاريخ الإنشاء: ${new Date(inv.createdAt).toLocaleString()} | آخر تحديث: ${new Date(inv.updatedAt).toLocaleString()}</div>
          <div class="muted">رقم الفاتورة: ${inv.invoiceNumber ? `#${inv.invoiceNumber}` : '—'} | ID: ${invoiceId}</div>
          <div>الإجمالي: ${currency(inv.total)} | المتبقي: ${currency(inv.remaining)}</div>
        </div>
        <div>
          <button type="button" data-id="${externalId}" class="btn-view">عرض</button>
          <button type="button" data-id="${externalId}" class="btn-print">طباعة</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Ensure a single click handler is attached
    container.onclick = async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (btn.classList.contains('btn-print')) {
        try {
          await window.api.print.invoice(id, { fontSize: getCurrentFontSize() });
          showErrorMessage('تم إرسال الفاتورة للطباعة', 'success');
        } catch (error) { showErrorMessage('خطأ في الطباعة: ' + error.message); }
      } else if (btn.classList.contains('btn-view')) {
        try {
          await showInvoiceDetail(id);
          const invoicesTab = $$('.tab').find(t => t.getAttribute('data-tab') === 'invoices');
          if (invoicesTab) invoicesTab.click();
        } catch (error) {
          showErrorMessage('خطأ في عرض الفاتورة: ' + error.message);
        }
      }
    };
  } catch (error) {
    const container = $('#search-results');
    if (container) container.innerHTML = '<div class="muted" style="color: red;">خطأ في تحميل النتائج</div>';
  }
}
// Ensure Gregorian date formatting regardless of locale default calendar
function formatGregorian(date, withTime = false) {
  try {
    const d = new Date(date);
    const opts = withTime
      ? { calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
      : { calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit' };
    // Use Arabic numerals/labels but force Gregorian calendar
    return new Intl.DateTimeFormat('ar-EG-u-ca-gregory', opts).format(d);
  } catch (e) {
    // Fallback to ISO-like
    const d = new Date(date);
    const iso = d.toISOString();
    return withTime ? iso.replace('T', ' ').slice(0, 16) : iso.slice(0, 10);
  }
}

// Global error handler for the renderer process
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
  console.error('Stack trace:', event.error?.stack);
  showErrorMessage(`خطأ في التطبيق: ${event.error?.message || 'خطأ غير معروف'}`);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
  showErrorMessage(`خطأ في العملية: ${event.reason?.message || event.reason || 'خطأ غير معروف'}`);
});

// Enhanced error display function with modern styling
function showErrorMessage(message, type = 'error') {
  if (DEBUG_MODE) console.log(`${type === 'error' ? '❌' : '✅'} ${message}`);
  
  // Create or update error display element
  let errorDiv = $('#global-error-display');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'global-error-display';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 400px;
      padding: 16px 20px;
      border-radius: 12px;
      z-index: 10000;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      transform: translateX(100%);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(errorDiv);
  }
  
  // Set colors based on type
  if (type === 'error') {
    errorDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    errorDiv.style.color = '#dc2626';
    errorDiv.style.borderColor = 'rgba(239, 68, 68, 0.2)';
  } else if (type === 'success') {
    errorDiv.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
    errorDiv.style.color = '#16a34a';
    errorDiv.style.borderColor = 'rgba(34, 197, 94, 0.2)';
  } else {
    errorDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    errorDiv.style.color = '#2563eb';
    errorDiv.style.borderColor = 'rgba(59, 130, 246, 0.2)';
  }
  
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  // Animate in
  setTimeout(() => {
    errorDiv.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto-hide after 5 seconds with animation
  setTimeout(() => {
    if (errorDiv) {
      errorDiv.style.transform = 'translateX(100%)';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 300);
    }
  }, 5000);
}

// Loading state management
function showLoadingState(element, text = 'جاري التحميل...') {
  if (!element) return;
  
  const originalContent = element.innerHTML;
  element.dataset.originalContent = originalContent;
  element.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
      <div class="spinner"></div>
      <span>${text}</span>
    </div>
  `;
  element.classList.add('loading');
  element.disabled = true;
}

function hideLoadingState(element) {
  if (!element) return;
  
  if (element.dataset.originalContent) {
    element.innerHTML = element.dataset.originalContent;
    delete element.dataset.originalContent;
  }
  element.classList.remove('loading');
  element.disabled = false;
}

// Enhanced API call wrapper with loading states
async function safeApiCall(apiCall, errorContext = '', loadingElement = null) {
  try {
    if (DEBUG_MODE) console.log(`🔄 API Call: ${errorContext}`);
    
    if (loadingElement) {
      showLoadingState(loadingElement, `جاري ${errorContext}...`);
    }
    
    const result = await apiCall();
    
    // Check if result contains error
    if (result && result.error) {
      throw new Error(result.message || 'API returned error');
    }
    
    if (DEBUG_MODE) console.log(`✅ API Success: ${errorContext}`);
    return result;
  } catch (error) {
    console.error(`❌ API Error in ${errorContext}:`, error);
    showErrorMessage(`خطأ في ${errorContext}: ${error.message}`);
    throw error;
  } finally {
    if (loadingElement) {
      hideLoadingState(loadingElement);
    }
  }
}

// ===================== UI Font Size Control =====================
function getStoredFontSize() {
  const v = localStorage.getItem('app-font-size') || localStorage.getItem('uiFontSize');
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(24, Math.max(12, n)) : 16;
}
function applyUiFontSize(px) {
  // Apply base font size for the whole app
  document.body.style.fontSize = px + 'px';
}
function getCurrentFontSize() {
  return getStoredFontSize();
}


// Enhanced API call wrapper with error handling
async function safeApiCall(apiCall, errorContext = '') {
  try {
    if (DEBUG_MODE) console.log(`🔄 API Call: ${errorContext}`);
    const result = await apiCall();
    
    // Check if result contains error
    if (result && result.error) {
      throw new Error(result.message || 'API returned error');
    }
    
    if (DEBUG_MODE) console.log(`✅ API Success: ${errorContext}`);
    return result;
  } catch (error) {
    console.error(`❌ API Error in ${errorContext}:`, error);
    showErrorMessage(`خطأ في ${errorContext}: ${error.message}`);
    throw error;
  }
}

// Tabs
$$('.tab').forEach(btn => btn.addEventListener('click', async () => {
  $$('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.getAttribute('data-tab');
  $$('.page').forEach(p => p.classList.remove('active'));
  $('#' + tab).classList.add('active');
  // Lazy-load data for specific tabs
  try {
    if (tab === 'products') await loadProducts();
    if (tab === 'low-stock') await loadLowStockProducts();
    if (tab === 'create-invoice') loadDefaultDiscounts();
    if (tab === 'settings') loadSettings();
    
    // Ensure font size is maintained across tab switches
    const currentFontSize = getStoredFontSize();
    applyUiFontSize(currentFontSize);
  } catch {}
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
  const rowNumber = $('#items-body').children.length + 1;
  tr.innerHTML = `
    <td style="text-align:center; font-weight:bold; color:var(--primary-600)">#${rowNumber}</td>
    <td>
      <div class="autocomplete">
        <input type="text" class="item-name" placeholder="اسم المنتج" />
        <div class="suggestions" style="display:none"></div>
      </div>
    </td>
    <td><input type="text" class="item-category" placeholder="الفئة" readonly /></td>
    <td><input type="number" class="item-qty" placeholder="الكمية" value="1" step="0.01" min="0" /></td>
    <td><input type="number" class="item-price" placeholder="سعر البيع" step="0.01" min="0" /></td>
    <td class="item-subtotal" style="text-align:center">0.00</td>
    <td style="text-align:center"><input type="checkbox" class="item-delivered" /></td>
    <td><button type="button" class="remove-item">✕</button></td>
  `;

  const nameInput = tr.querySelector('.item-name');
  const categoryInput = tr.querySelector('.item-category');
  const priceInput = tr.querySelector('.item-price');
  const qtyInput = tr.querySelector('.item-qty');
  const subtotalCell = tr.querySelector('.item-subtotal');
  const sugg = tr.querySelector('.suggestions');

  let selectedProduct = null;
  nameInput.addEventListener('input', async () => {
    const q = nameInput.value.trim();
    if (!q) { sugg.style.display = 'none'; sugg.innerHTML=''; selectedProduct = null; tr.dataset.basePrice=''; tr.dataset.category=''; categoryInput.value=''; recomputeTotals(); return; }
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
    categoryInput.value = selectedProduct.category || '';
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
    updateRowNumbers();
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
    category: categoryInput.value.trim() || selectedProduct?.category || undefined,
    delivered: !!tr.querySelector('.item-delivered')?.checked
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

// Function to update row numbers when rows are added/removed
function updateRowNumbers() {
  const rows = $('#items-body').children;
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 1;
    const numberCell = rows[i].querySelector('td:first-child');
    if (numberCell) {
      numberCell.textContent = `#${rowNumber}`;
    }
  }
}

$('#add-item').addEventListener('click', () => { 
  $('#items-body').appendChild(newItemRow()); 
  updateRowNumbers();
});
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
  $('#remaining').textContent = currency(total - paid);
}

$('#invoice-form').addEventListener('input', recomputeTotals);

$('#invoice-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = $$('#items-body tr').map(tr => tr.getData()).filter(it => it.name && it.price >= 0 && it.qty >= 0);
  if (!items.length) { 
    showErrorMessage('أضف بندًا واحدًا على الأقل.'); 
    return; 
  }
  if (!$('#cust-name').value.trim() || !$('#cust-phone').value.trim()) { 
    showErrorMessage('اسم العميل ورقم الهاتف مطلوبان.'); 
    return; 
  }
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

  const submitButton = e.target.querySelector('button[type="submit"]');
  
  try {
    showLoadingState(submitButton, 'جاري إنشاء الفاتورة...');
    const result = await window.api.invoices.create(payload);
    
    if (result && result.error) { 
      showErrorMessage(result.message || 'فشل إنشاء الفاتورة.'); 
      return; 
    }
    
    // Success! Show message and refresh invoice list
    showErrorMessage('تم إنشاء الفاتورة بنجاح!', 'success');
    
    // Clear form
    $('#items-body').innerHTML = '';
    $('#payments-body').innerHTML = '';
    $('#invoice-form').reset();
    recomputeTotals();
    
    // Refresh invoice list to show the new invoice
    await loadInvoices();
    
    // Switch to invoices tab to show the new invoice
    $$('.tab').forEach(b => b.classList.remove('active'));
    $$('.page').forEach(p => p.classList.remove('active'));
    $('#invoices').classList.add('active');
    const invoicesTab = $$('.tab').find(t => t.getAttribute('data-tab') === 'invoices');
    if (invoicesTab) invoicesTab.classList.add('active');
    
  } catch (error) {
    showErrorMessage('خطأ في إنشاء الفاتورة: ' + (error.message || 'خطأ غير معروف'));
  } finally {
    hideLoadingState(submitButton);
  }
});

// Live search for customer in invoice
const custNameInput = $('#cust-name');
const custSug = $('#cust-suggestions');
if (custNameInput) {
  custNameInput.addEventListener('input', async () => {
    const q = custNameInput.value.trim();
    if (!q) { custSug.style.display = 'none'; custSug.innerHTML=''; return; }
    // Fetch customers and plumbers in parallel, then merge and dedupe
    const [custs, plumbs] = await Promise.all([
      window.api.customers.search(q).catch(() => []),
      window.api.plumbers.search(q).catch(() => [])
    ]);
    const seen = new Set();
    const merged = [];
    for (const c of (custs || [])) {
      const key = (c.phone ? String(c.phone).trim() : '') + '|' + String(c.name || '').trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ name: c.name, phone: c.phone, kind: 'customer' });
    }
    for (const p of (plumbs || [])) {
      const key = (p.phone ? String(p.phone).trim() : '') + '|' + String(p.name || '').trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ name: p.name, phone: p.phone || '', kind: 'plumber' });
    }
    if (!merged.length) { custSug.style.display='none'; custSug.innerHTML=''; return; }
    custSug.innerHTML = merged.map(x => {
      const tag = x.kind === 'plumber' ? '<span style="color:#10b981; margin-right:6px">[سباك]</span>' : '';
      const phone = x.phone ? ` — ${x.phone}` : '';
      return `<div data-name="${x.name}" data-phone="${x.phone}">${tag}${x.name}${phone}</div>`;
    }).join('');
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
  if (DEBUG_MODE) console.log('=== SHOW INVOICE DETAIL DEBUG ===');
  if (DEBUG_MODE) console.log('showInvoiceDetail called with id:', id, 'type:', typeof id);
  
  // Check if window.api is available
  if (!window.api) {
    console.error('❌ window.api is not available!');
    showErrorMessage('خطأ: واجهة التطبيق غير متاحة');
    return;
  }
  
  try {
    if (DEBUG_MODE) console.log('Calling window.api.invoices.getById...');
    const inv = await window.api.invoices.getById(id);
    if (DEBUG_MODE) console.log('Invoice data received:', inv);
    const panel = $('#invoice-detail');
    if (DEBUG_MODE) console.log('Detail panel element:', panel);
    
    if (!panel) {
      console.error('❌ Detail panel element not found!');
      showErrorMessage('خطأ: لم يتم العثور على لوحة التفاصيل');
      return;
    }
    
    if (!inv) { 
      if (DEBUG_MODE) console.log('❌ No invoice found, hiding panel');
      panel.style.display='none';
      showErrorMessage('لم يتم العثور على الفاتورة');
      return; 
    }
  
    // Calculate totals
    const itemsTotal = (inv.items || []).reduce((sum, it) => sum + (it.qty || 0) * (it.discountedPrice ?? it.price), 0);
    const allPayments = (inv.payments || []);
    const paidTotal = allPayments.filter(p => (p.note || '').trim() !== 'مرتجع').reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Normalize IDs: numeric external id = invoiceNumber; internal ObjectId kept for backend
    const invoiceNumberExt = inv.invoiceNumber;
    // Normalize ID and format dates (Gregorian)
    let idStr = inv._id;
    if (typeof idStr === 'object' && idStr?.buffer) {
      idStr = Array.from(idStr.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof idStr === 'object' && idStr?.toString) {
      idStr = idStr.toString();
    } else {
      idStr = String(idStr);
    }
    const createdDate = formatGregorian(inv.createdAt, false);
    const updatedDate = formatGregorian(inv.updatedAt, false);
    
    // Items table
    const itemsRows = (inv.items || []).map((it, idx) => {
      const itemTotal = (it.qty || 0) * (it.discountedPrice ?? it.price);
      const discountInfo = it.discountedPrice != null ? ` <span style="color:#16a34a">(-${(100 - (it.discountedPrice / it.price * 100)).toFixed(0)}%)</span>` : '';
      return `<tr>
        <td>${it.product?.name || it.productName || ''}</td>
        <td>${it.category || ''}</td>
        <td>${it.qty}</td>
        <td>${(it.discountedPrice ?? it.price).toFixed(2)}${discountInfo}</td>
        <td>${itemTotal.toFixed(2)}</td>
        <td style="text-align:center"><input type="checkbox" class="delivered-toggle" data-index="${idx}" ${it.delivered ? 'checked' : ''} disabled /></td>
      </tr>`;
    }).join('');
    
    // Payments table
    const paymentsRows = (inv.payments || []).map(p => {
      const paymentDate = formatGregorian(p.date, false);
      return `<tr>
        <td>${paymentDate}</td>
        <td>${p.note || ''}</td>
        <td>${Number(p.amount).toFixed(2)}</td>
        <td><button type="button" class="remove-payment-btn" data-payment-id="${p._id || 'temp'}">حذف</button></td>
      </tr>`;
    }).join('');

    // Return section (if any)
    const hasReturn = !!inv.returnInvoice;
    const returnRows = hasReturn ? (inv.returnInvoice.items || []).map(ri => {
      const t = Number(ri.qty || 0) * Number(ri.price || 0);
      return `<tr>
        <td>${ri.productName || ri.product || ''}</td>
        <td>${ri.qty || 0}</td>
        <td>${Number(ri.price || 0).toFixed(2)}</td>
        <td>${t.toFixed(2)}</td>
      </tr>`;
    }).join('') : '';
    const returnTotal = hasReturn ? (inv.returnInvoice.items || []).reduce((s, ri) => s + Number(ri.qty || 0) * Number(ri.price || 0), 0) : 0;
    const remaining = Number((itemsTotal - (paidTotal + returnTotal)).toFixed(2));
    
    // Discount info
    const discountInfo = (inv.discountAbogaliPercent > 0 || inv.discountBrPercent > 0)
      ? `<div style="margin:8px 0; padding:8px; background:#f0f9ff; border-radius:4px;">
           <strong>الخصومات:</strong> ابوغالي ${inv.discountAbogaliPercent}% | BR ${inv.discountBrPercent}%
         </div>`
      : '';
    
    const shortId = (idStr && typeof idStr === 'string') ? idStr.slice(-6) : '';
    panel.innerHTML = `
      <h3>تفاصيل الفاتورة #${invoiceNumberExt || shortId || 'غير محدد'}</h3>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
        <div>
          <div><strong>العميل:</strong> ${inv.customerName || inv.customer?.name || ''}</div>
          <div><strong>الهاتف:</strong> ${inv.customerPhone || inv.customer?.phone || ''}</div>
          <div><strong>السباك:</strong> ${inv.plumberName || ''}</div>
        </div>
        <div>
          <div><strong>تاريخ الإنشاء:</strong> ${createdDate}</div>
          <div><strong>آخر تحديث:</strong> ${updatedDate}</div>
          <div><strong>الحالة:</strong> ${inv.archived ? 'مؤرشف' : 'نشط'}</div>
          <div><strong>رقم الفاتورة:</strong> ${invoiceNumberExt ? `#${invoiceNumberExt}` : '—'}</div>
          <div><strong>معرف الفاتورة:</strong> ${idStr}</div>
        </div>
      </div>
      
      ${discountInfo}
      
      <h4>الأصناف</h4>
      <table class="items-table inv-items" style="margin-top:8px">
        <thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th><th style="width:48px; text-align:center">تم التسليم</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      
      
      
      ${hasReturn ? `
      <div style="margin-top:16px"></div>
      <h4>المرتجع</h4>
      <div class="muted">التاريخ: ${formatGregorian(inv.returnInvoice.createdAt, true)}</div>
      <table class="items-table inv-returns" style="margin-top:8px">
        <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${returnRows}</tbody>
      </table>
      <div style="margin-top:8px"><strong>إجمالي المرتجع:</strong> ${returnTotal.toFixed(2)}</div>
      ` : ''}

      <h4>المدفوعات</h4>
      <table class="items-table inv-payments" style="margin-top:8px">
        <thead><tr><th>التاريخ</th><th>ملاحظة</th><th>المبلغ</th><th></th></tr></thead>
        <tbody>${paymentsRows}</tbody>
      </table>
      
      <div style="margin:16px 0; padding:12px; background:#f0fdf4; border-radius:4px;">
        <h5>إضافة دفعة جديدة</h5>
        <div class="row" style="gap:8px; align-items:end;">
        <input type="text" id="new-payment-amount" placeholder="المبلغ" inputmode="decimal" pattern="[0-9٠-٩\.,٫٬]*" dir="ltr" style="width:120px" />
        <input type="date" id="new-payment-date" style="width:140px" />
        <input type="text" id="new-payment-note" placeholder="ملاحظة" style="width:200px" />
        <button type="button" id="add-payment-btn" data-invoice-id="${invoiceNumberExt ?? idStr}">إضافة دفعة</button>
      </div>
    </div>
    
    <div style="margin:16px 0">
      <div style="display:grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap:12px;">
        <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px">إجمالي الأصناف</div>
          <div style="font-size:20px; font-weight:700; color:#111827">${itemsTotal.toFixed(2)}</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px">إجمالي المدفوع</div>
          <div style="font-size:20px; font-weight:700; color:#111827">${paidTotal.toFixed(2)}</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px">إجمالي المرتجع</div>
          <div style="font-size:20px; font-weight:700; color:#111827">${returnTotal.toFixed(2)}</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px">المتبقي</div>
          <div style="font-size:20px; font-weight:700; color:${remaining > 0 ? '#dc2626' : '#16a34a'}">${remaining.toFixed(2)}</div>
        </div>
      </div>
    </div>
    
    <div class="invoice-actions">
      <button id="btn-edit-invoice" class="btn-edit" data-id="${invoiceNumberExt ?? idStr}">تعديل الفاتورة</button>
      <button id="btn-make-return" data-id="${invoiceNumberExt ?? idStr}">إرجاع</button>
      <button id="btn-print-invoice" data-id="${invoiceNumberExt ?? idStr}">طباعة الفاتورة</button>
      <button id="btn-delete-invoice" class="btn-delete" data-id="${invoiceNumberExt ?? idStr}">حذف الفاتورة</button>
    </div>
    
    <div id="return-form" style="display:none; margin-top:16px"></div>
  `;
  
  panel.style.display = 'block';
  // Ensure the invoice detail is shown at the top of the viewport
  try {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Fallback to window scroll in case the container handles scrolling
    setTimeout(() => { try { window.scrollTo({ top: panel.offsetTop || 0, behavior: 'smooth' }); } catch (_) {} }, 0);
  } catch (_) {}
  
  // Add event listeners
  // Delivered checkboxes are read-only in view mode

  $('#btn-edit-invoice').addEventListener('click', async () => {
    await showEditInvoiceForm(invoiceNumberExt ?? idStr);
  });
  $('#btn-make-return').addEventListener('click', () => buildReturnForm(inv));
  $('#btn-print-invoice').addEventListener('click', async () => {
    await window.api.print.invoice(invoiceNumberExt ?? idStr, { fontSize: getCurrentFontSize() });
  });
  $('#btn-delete-invoice').addEventListener('click', async () => {
    const externalId = invoiceNumberExt ?? idStr;
    const ok = confirm('هل أنت متأكد من حذف هذه الفاتورة؟ هذا الإجراء لا يمكن التراجع عنه.');
    if (!ok) return;
    try {
      const res = await window.api.invoices.delete(externalId);
      if (res && res.error) { alert('فشل حذف الفاتورة: ' + (res.message || '')); return; }
      // Refresh list and clear detail panel
      await loadInvoices();
      const panel = $('#invoice-detail');
      if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
      showErrorMessage('تم حذف الفاتورة بنجاح', 'success');
    } catch (e) {
      alert('خطأ في حذف الفاتورة: ' + (e.message || ''));
    }
  });
  $('#add-payment-btn').addEventListener('click', async () => {
    // Normalize Arabic-Indic digits and separators to parseable number
    const rawAmt = ($('#new-payment-amount').value || '').trim();
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    const normalizedDigits = rawAmt.replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)))
                                   .replace(/[٬,]/g, '') // remove thousand separators
                                   .replace(/[٫]/g, '.') // decimal separator to dot
                                   .replace(/\s+/g, '');
    const amount = Number(normalizedDigits || 0);
    const date = $('#new-payment-date').value || new Date().toISOString().split('T')[0];
    const note = $('#new-payment-note').value || '';
    
    if (amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }
    
    try {
      await window.api.invoices.addPayment(invoiceNumberExt ?? idStr, { amount, date, note });
      // Refresh the detail view to show the new payment
      await showInvoiceDetail(invoiceNumberExt ?? idStr);
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
    console.error('❌ Error showing invoice detail:', error);
    const panel = $('#invoice-detail');
    panel.innerHTML = `<div style="color: red; padding: 20px;">خطأ في عرض تفاصيل الفاتورة: ${error.message}</div>`;
    panel.style.display = 'block';
  }
  if (DEBUG_MODE) console.log('=== END SHOW INVOICE DETAIL DEBUG ===');
}

function buildReturnForm(inv) {
  const mount = $('#return-form');
  mount.innerHTML = `
    <h4>إنشاء مرتجع</h4>
    <table class="items-table">
      <thead>
        <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th></th></tr>
      </thead>
      <tbody id="return-body"></tbody>
    </table>
    <div style="margin-top:8px; text-align:left"><strong>الإجمالي:</strong> <span id="return-total">0.00</span></div>
    <div style="margin-top:8px; display:flex; gap:8px; align-items:center">
      <button id="add-return-row" type="button">إضافة صنف مرتجع</button>
      <button id="submit-return">حفظ المرتجع</button>
    </div>
  `;
  mount.style.display = 'block';
  
  // Auto-scroll to the return form
  setTimeout(() => {
    try {
      mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      // Fallback scroll
      window.scrollTo({ 
        top: mount.offsetTop - 100, 
        behavior: 'smooth' 
      });
    }
  }, 100);

  function recomputeReturnTotal() {
    let total = 0;
    $$('#return-body tr').forEach(tr => {
      const qty = Number(tr.querySelector('.ret-qty').value || 0);
      const price = Number(tr.querySelector('.ret-price').value || 0);
      total += qty * price;
    });
    $('#return-total').textContent = currency(total);
  }

  function newReturnRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="autocomplete">
          <input type="text" class="ret-name" placeholder="اسم المنتج" />
          <div class="suggestions" style="display:none"></div>
        </div>
      </td>
      <td><input type="number" class="ret-qty" placeholder="الكمية" value="1" step="0.01" min="0" /></td>
      <td><input type="number" class="ret-price" placeholder="السعر" step="0.01" min="0" /></td>
      <td><button type="button" class="ret-remove">✕</button></td>
    `;
    const nameInput = tr.querySelector('.ret-name');
    const qtyInput = tr.querySelector('.ret-qty');
    const priceInput = tr.querySelector('.ret-price');
    const sugg = tr.querySelector('.suggestions');
    let selected = null; // { id, name, price }

    function applySelection(sel) {
      selected = { id: sel.id, name: sel.name, price: Number(sel.price || 0) };
      nameInput.value = sel.name;
      priceInput.value = Number(selected.price || 0).toFixed(2);
      sugg.style.display = 'none';
      recomputeReturnTotal();
    }

    function updateSuggestionsAndMaybeAutofill() {
      const q = nameInput.value.trim().toLowerCase();
      const src = (inv.items || []).map(it => ({
        id: (it.product && it.product._id) ? it.product._id : (it.product || it.productId || it._id),
        name: (it.product && it.product.name) ? it.product.name : (it.productName || ''),
        price: (it.discountedPrice ?? it.price) // effective (after discount)
      }));
      const list = q ? src.filter(p => String(p.name || '').toLowerCase().includes(q)) : src;
      if (!list.length) { sugg.style.display='none'; sugg.innerHTML=''; selected=null; return; }
      sugg.innerHTML = list.map(p => `<div data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">${p.name} — ${currency(p.price)}</div>`).join('');
      sugg.style.display = 'block';

      // If the typed name exactly matches one item, auto-select it and fill discounted price
      if (q) {
        const exact = src.find(p => String(p.name || '').trim().toLowerCase() === q);
        if (exact) {
          applySelection(exact);
          return;
        }
      }

      // If only one suggestion remains, auto-select it
      if (list.length === 1) {
        applySelection(list[0]);
        return;
      }
    }

    nameInput.addEventListener('input', updateSuggestionsAndMaybeAutofill);
    nameInput.addEventListener('blur', updateSuggestionsAndMaybeAutofill);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateSuggestionsAndMaybeAutofill();
      }
    });
    sugg.addEventListener('click', (e) => {
      const d = e.target.closest('div');
      if (!d) return;
      applySelection({ id: d.getAttribute('data-id'), name: d.getAttribute('data-name'), price: Number(d.getAttribute('data-price')) });
    });
    tr.querySelector('.ret-remove').addEventListener('click', () => { tr.remove(); recomputeReturnTotal(); });
    qtyInput.addEventListener('input', recomputeReturnTotal);
    priceInput.addEventListener('input', recomputeReturnTotal);
    tr.getData = () => {
      const name = nameInput.value.trim() || (selected?.name || '');
      let id = selected?.id || null;
      return {
        product: name, // legacy
        productName: name,
        productId: id,
        qty: Number(qtyInput.value || 0),
        price: Number(priceInput.value || 0)
      };
    };
    return tr;
  }

  // Start empty (no auto rows)
  const body = $('#return-body');

  $('#add-return-row').addEventListener('click', () => { body.appendChild(newReturnRow()); });

  $('#submit-return').addEventListener('click', async () => {
    const items = $$('#return-body tr').map(tr => tr.getData()).filter(x => x.product && x.qty > 0);
    if (!items.length) { showErrorMessage('أضف صنفًا واحدًا على الأقل للمرتجع'); return; }
    // Prefer numeric invoiceNumber; fallback to normalized _id string
    let originalInvoice = inv.invoiceNumber ?? inv._id;
    if (typeof originalInvoice === 'object' && originalInvoice?.buffer) {
      originalInvoice = Array.from(originalInvoice.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof originalInvoice === 'object' && originalInvoice?.toString) {
      originalInvoice = originalInvoice.toString();
    }
    await window.api.returns.create({ originalInvoice, items });
    $('#return-form').style.display = 'none';
    // Refresh the invoice detail to reflect deduction
    const externalId = inv.invoiceNumber ?? originalInvoice;
    await showInvoiceDetail(externalId);
    showErrorMessage('تم إنشاء المرتجع وخصم المبلغ من الفاتورة', 'success');
  });
}

async function loadInvoices() {
  if (DEBUG_MODE) console.log('🔄 Loading invoices...');
  const search = $('#invoice-search')?.value?.trim() || '';
  const showDeletedOnly = $('#show-deleted-only')?.checked || false;
  const filters = {};
  if (search) filters.search = normalizeDigits(search);
  if (showDeletedOnly) filters.deleted = true; // only deleted
  
  if (DEBUG_MODE) console.log('📋 Invoice filters:', filters);
  
  const container = $('#invoice-list');
  if (!container) {
    console.error('❌ Invoice list container not found!');
    showErrorMessage('خطأ: لم يتم العثور على حاوية قائمة الفواتير');
    return;
  }
  
  // Show loading state
  showLoadingState(container, 'جاري تحميل الفواتير...');
  
  try {
    const list = await window.api.invoices.list(filters);
    if (DEBUG_MODE) console.log('✅ Invoices loaded:', list.length);
    if (DEBUG_MODE) console.log('📊 First invoice sample:', list[0]);
    
    container.innerHTML = '';
    
    if (list.length === 0) {
      container.innerHTML = `
        <div style="
          padding: 40px 20px; 
          text-align: center; 
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border: 2px dashed #cbd5e1; 
          border-radius: 16px;
          color: #64748b;
          font-size: 16px;
          font-weight: 500;
        ">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📄</div>
          لا توجد فواتير متاحة
        </div>
      `;
      if (DEBUG_MODE) console.log('ℹ️ No invoices found, showing empty message');
      return;
    }
    
    if (DEBUG_MODE) console.log('Rendering', list.length, 'invoices');
    
    list.forEach(inv => {
      // Prefer numeric external id
      const invoiceNumberExt = inv.invoiceNumber;
      // Fallback to internal _id string if needed
      let internalId = inv._id;
      if (typeof internalId === 'object' && internalId.buffer) {
        internalId = Array.from(internalId.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (typeof internalId === 'object' && internalId.toString) {
        internalId = internalId.toString();
      } else {
        internalId = String(internalId);
      }
      const externalId = (Number.isFinite(Number(invoiceNumberExt)) ? String(invoiceNumberExt) : internalId);
      if (!externalId) { console.error('❌ Missing invoice identifier', inv); return; }
      const card = document.createElement('div');
      card.className = 'list-card';
      if (inv.deleted) {
        card.style.opacity = '0.7';
        card.style.border = '1px dashed #ef4444';
        card.style.background = '#fff7ed';
      }
      const discountInfo = (inv.discountAbogaliPercent > 0 || inv.discountBrPercent > 0)
        ? ` | خصم ابوغالي ${inv.discountAbogaliPercent}% | خصم BR ${inv.discountBrPercent}%`
        : '';
      const returnTotal = (inv.payments || []).filter(p => (p.note || '').trim() === 'مرتجع').reduce((s, p) => s + Number(p.amount || 0), 0);
      card.innerHTML = `
        <div>
          <div><strong>${inv.customerName || inv.customer?.name || ''}</strong> — ${inv.customerPhone || inv.customer?.phone || ''}</div>
          <div class="muted">السباك: ${inv.plumberName || ''}${discountInfo}</div>
          <div class="muted">${inv.deleted ? 'محذوفة' : (inv.archived ? 'مؤرشفة' : 'نشطة')} | تاريخ الإنشاء: ${formatGregorian(inv.createdAt, true)} | آخر تحديث: ${formatGregorian(inv.updatedAt, true)}</div>
          <div class="muted">رقم الفاتورة: ${invoiceNumberExt ?? '—'} | ID: ${internalId}</div>
          <div class="muted">الإجمالي: ${currency(inv.total)} | المرتجع: ${currency(returnTotal)} | المتبقي: ${currency(inv.remaining)}</div>
        </div>
        <div>
          ${inv.deleted ? `
            <button type="button" data-id="${externalId}" class="btn-restore">استعادة</button>
            <button type="button" data-id="${externalId}" class="btn-delete btn-hard-delete">حذف نهائي</button>
          ` : `
            <button type="button" data-id="${externalId}" class="btn-view">عرض</button>
            <button type="button" data-id="${externalId}" class="btn-print">طباعة</button>
            <button type="button" data-id="${externalId}" class="btn-delete">حذف</button>
          `}
        </div>
      `;
      container.appendChild(card);
      if (DEBUG_MODE) console.log('Added invoice card for:', inv.customer?.name || 'Unknown');
    });
    
    if (DEBUG_MODE) console.log('All invoice cards added to container');
  } catch (error) {
    console.error('Error loading invoices:', error);
    const container = $('#invoice-list');
    if (container) {
      container.innerHTML = '<div class="muted" style="color: red;">خطأ في تحميل الفواتير</div>';
    }
  }
}

$('#refresh-invoices').addEventListener('click', loadInvoices);
$('#show-deleted-only')?.addEventListener('change', loadInvoices);
$('#invoice-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadInvoices(); });
// Live search invoices as the user types (debounced)
$('#invoice-search')?.addEventListener('input', debounce(() => {
  loadInvoices();
}, 250));


// Invoice list button handlers
$('#invoice-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  // Accept either numeric invoiceNumber or 24-hex ObjectId
  const isNumericId = (v) => /^\d+$/.test(String(v).trim());
  const isHex24 = (v) => /^[a-f0-9]{24}$/i.test(String(v).trim());
  if (!id || !(isNumericId(id) || isHex24(id))) {
    console.error('❌ Invalid invoice ID clicked:', id);
    showErrorMessage('خطأ: رقم الفاتورة غير صالح');
    return;
  }
  
  if (DEBUG_MODE) console.log('=== INVOICE LIST CLICK DEBUG ===');
  if (DEBUG_MODE) console.log('Click target:', e.target);
  if (DEBUG_MODE) console.log('Target tagName:', e.target.tagName);
  if (DEBUG_MODE) console.log('Target className:', e.target.className);
  if (DEBUG_MODE) console.log('✅ Button found:', btn.className, 'ID:', id, 'Type:', typeof id);
  
  if (btn.classList.contains('btn-print')) {
    if (DEBUG_MODE) console.log('🖨️ Print button clicked');
    try {
      await window.api.print.invoice(id);
      if (DEBUG_MODE) console.log('✅ Print completed');
    } catch (error) {
      console.error('❌ Print error:', error);
    }
  } else if (btn.classList.contains('btn-edit')) {
    if (DEBUG_MODE) console.log('✏️ Edit button clicked for invoice:', id);
    try {
      await showEditInvoiceForm(isNumericId(id) ? Number(id) : String(id));
    } catch (error) {
      console.error('❌ Edit error:', error);
      showErrorMessage('خطأ في تعديل الفاتورة: ' + error.message);
    }
  } else if (btn.classList.contains('btn-view')) {
    if (DEBUG_MODE) console.log('👁️ View button clicked for invoice:', id);
    try {
      if (DEBUG_MODE) console.log('Calling showInvoiceDetail with ID:', id);
      await showInvoiceDetail(isNumericId(id) ? Number(id) : String(id));
      if (DEBUG_MODE) console.log('✅ showInvoiceDetail completed');
      const detailPanel = document.getElementById('invoice-detail');
      if (detailPanel) {
        if (DEBUG_MODE) console.log('📜 Scrolling to detail panel');
        detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        if (DEBUG_MODE) console.log('❌ Detail panel not found');
      }
    } catch (error) {
      console.error('❌ View error:', error);
    }
  } else if (btn.classList.contains('btn-delete')) {
    // Soft delete invoice
    try {
      const ok = confirm('هل تريد حذف الفاتورة؟ يمكن استعادتها لاحقًا من قائمة المحذوفة.');
      if (!ok) return;
      const res = await window.api.invoices.delete(isNumericId(id) ? Number(id) : String(id));
      if (res && res.error) throw new Error(res.message || 'فشل حذف الفاتورة');
      await loadInvoices();
      const panel = $('#invoice-detail');
      if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
      showErrorMessage('تم حذف الفاتورة', 'success');
    } catch (error) {
      console.error('❌ Delete error:', error);
      showErrorMessage('خطأ في حذف الفاتورة: ' + (error.message || ''));
    }
  } else if (btn.classList.contains('btn-restore')) {
    try {
      const res = await window.api.invoices.restore(isNumericId(id) ? Number(id) : String(id));
      if (res && res.error) throw new Error(res.message || 'فشل استعادة الفاتورة');
      await loadInvoices();
      showErrorMessage('تمت الاستعادة', 'success');
    } catch (error) {
      console.error('❌ Restore error:', error);
      showErrorMessage('خطأ في الاستعادة: ' + (error.message || ''));
    }
  } else if (btn.classList.contains('btn-hard-delete')) {
    try {
      const ok = confirm('تحذير: حذف نهائي لا يمكن التراجع عنه. هل أنت متأكد؟');
      if (!ok) return;
      const res = await window.api.invoices.hardDelete(isNumericId(id) ? Number(id) : String(id));
      if (res && res.error) throw new Error(res.message || 'فشل الحذف النهائي');
      await loadInvoices();
      showErrorMessage('تم الحذف النهائي', 'success');
    } catch (error) {
      console.error('❌ Hard delete error:', error);
      showErrorMessage('خطأ في الحذف النهائي: ' + (error.message || ''));
    }
  } else {
    if (DEBUG_MODE) console.log('❓ Unknown button type:', btn.className);
  }
  if (DEBUG_MODE) console.log('=== END CLICK DEBUG ===');
});

// Utility: debounce
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Utility: normalize Arabic-Indic digits to ASCII for reliable numeric searches
function normalizeDigits(str) {
  if (!str) return '';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return String(str)
    .replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)))
    .replace(/[٬,]/g, '') // remove thousand separators
    .replace(/[٫]/g, '.') // normalize decimal separator
    .trim();
}

// Product page: live search and edit/delete per row
$('#product-search-btn')?.addEventListener('click', async () => {
  const q = $('#product-search').value.trim();
  const list = q ? await window.api.products.search(q) : await window.api.products.list();
  renderProductList(list);
});

// Refresh products list (respects current search query if present)
$('#refresh-products')?.addEventListener('click', async () => {
  const q = $('#product-search')?.value.trim();
  const list = q ? await window.api.products.search(q) : await window.api.products.list();
  renderProductList(list);
});

$('#product-search')?.addEventListener('input', debounce(async (e) => {
  const q = e.target.value.trim();
  const list = q ? await window.api.products.search(q) : await window.api.products.list();
  renderProductList(list);
}, 250));

function mountProductRow(product) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${product.name}</td>
    <td>${product.category || ''}</td>
    <td>${currency(product.buyingPrice ?? 0)}</td>
    <td>${currency(product.sellingPrice ?? product.price ?? 0)}</td>
    <td>${product.stock ?? 0}</td>
    <td>${product.reorderLevel ?? 0}</td>
    <td style="width:160px">
      <button type="button" class="btn-edit">تعديل</button>
      <button type="button" class="btn-delete">حذف</button>
    </td>
  `;

  // Add event listeners for edit and delete
  const editBtn = row.querySelector('.btn-edit');
  const deleteBtn = row.querySelector('.btn-delete');
  
  editBtn.addEventListener('click', () => setEditMode(product));
  deleteBtn.addEventListener('click', async () => {
    const ok = confirm('هل تريد حذف هذا المنتج؟ سيؤثر ذلك على إضافته مستقبلاً في الفواتير، ولن يحذف الفواتير السابقة.');
    if (!ok) return;
    try {
      const res = await window.api.products.delete(product._id);
      if (res && res.error) throw new Error(res.message || 'فشل حذف المنتج');
      row.remove();
      const msg = $('#product-message');
      if (msg) { msg.textContent = 'تم الحذف'; setTimeout(() => (msg.textContent = ''), 1500); }
      try { await loadLowStockProducts(); } catch {}
    } catch (err) {
      showErrorMessage('تعذر حذف المنتج: ' + (err.message || ''));
    }
  });

  function setEditMode(p) {
    row.innerHTML = `
      <td>
        <div style="display:flex; flex-direction:column; gap:4px">
          <span class="muted" style="font-size:12px">الاسم</span>
          <input value="${p.name}" class="edit-name" style="width:100%" />
        </div>
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:4px">
          <span class="muted" style="font-size:12px">الفئة</span>
          <input value="${p.category || ''}" class="edit-category" style="width:100%" />
        </div>
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:4px">
          <span class="muted" style="font-size:12px">سعر الشراء</span>
          <input type="number" value="${p.buyingPrice ?? 0}" class="edit-buy" step="0.01" style="width:100%" />
        </div>
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:4px">
          <span class="muted" style="font-size:12px">السعر</span>
          <input type="number" value="${p.sellingPrice ?? p.price ?? 0}" class="edit-sell" step="0.01" style="width:100%" />
        </div>
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:4px">
          <span class="muted" style="font-size:12px">المخزون</span>
          <input type="number" value="${p.stock ?? 0}" class="edit-stock" style="width:100%" />
        </div>
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:4px">
          <span class="muted" style="font-size:12px">حد إعادة الطلب</span>
          <input type="number" value="${p.reorderLevel ?? 0}" class="edit-reorder" step="1" style="width:100%" />
        </div>
      </td>
      <td>
        <button type="button" data-id="${p._id}" class="btn-save">حفظ</button>
        <button type="button" data-id="${p._id}" class="btn-cancel">إلغاء</button>
      </td>
    `;

    const saveBtn = row.querySelector('.btn-save');
    const cancelBtn = row.querySelector('.btn-cancel');
    
    saveBtn.addEventListener('click', async () => {
      const name = row.querySelector('.edit-name').value.trim();
      const category = row.querySelector('.edit-category').value.trim();
      const buyingPrice = Number(row.querySelector('.edit-buy').value || 0);
      const sellingPrice = Number(row.querySelector('.edit-sell').value || 0);
      const stock = Number(row.querySelector('.edit-stock').value || 0);
      const reorderLevel = Number(row.querySelector('.edit-reorder').value || 0);
      
      try {
        const updated = await window.api.products.update(p._id, { name, category, buyingPrice, sellingPrice, stock, reorderLevel });
        Object.assign(p, updated);
        setViewMode(p);
        const msg = $('#product-message');
        if (msg) { msg.textContent = 'تم التحديث'; setTimeout(() => (msg.textContent = ''), 1500); }
        try { await loadLowStockProducts(); } catch {}
      } catch (err) {
        showErrorMessage('تعذر تحديث المنتج: ' + (err.message || ''));
      }
    });
    
    cancelBtn.addEventListener('click', () => setViewMode(p));
  }

  function setViewMode(p) {
    row.innerHTML = `
      <td>${p.name}</td>
      <td>${p.category || ''}</td>
      <td>${currency(p.buyingPrice ?? 0)}</td>
      <td>${currency(p.sellingPrice ?? p.price ?? 0)}</td>
      <td>${p.stock ?? 0}</td>
      <td>${p.reorderLevel ?? 0}</td>
      <td style="width:160px">
        <button type="button" class="btn-edit">تعديل</button>
        <button type="button" class="btn-delete">حذف</button>
      </td>
    `;
    
    // Re-add event listeners
    const editBtn = row.querySelector('.btn-edit');
    const deleteBtn = row.querySelector('.btn-delete');
    
    editBtn.addEventListener('click', () => setEditMode(p));
    deleteBtn.addEventListener('click', async () => {
      const ok = confirm('هل تريد حذف هذا المنتج؟ سيؤثر ذلك على إضافته مستقبلاً في الفواتير، ولن يحذف الفواتير السابقة.');
      if (!ok) return;
      try {
        const res = await window.api.products.delete(p._id);
        if (res && res.error) throw new Error(res.message || 'فشل حذف المنتج');
        row.remove();
        const msg = $('#product-message');
        if (msg) { msg.textContent = 'تم الحذف'; setTimeout(() => (msg.textContent = ''), 1500); }
        try { await loadLowStockProducts(); } catch {}
      } catch (err) {
        showErrorMessage('تعذر حذف المنتج: ' + (err.message || ''));
      }
    });
  }

  return row;
}

function renderProductList(list) {
  const tbody = $('#product-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(p => tbody.appendChild(mountProductRow(p)));
}

// Update existing loadProducts to use new renderer
async function loadProducts() {
  const list = await window.api.products.list();
  renderProductList(list);
}

// Low stock rendering with edit functionality
function mountProductRowReadonly(p) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${p.name}</td>
    <td>${p.category || '—'}</td>
    <td>${currency(p.buyingPrice ?? 0)}</td>
    <td>${currency(p.sellingPrice ?? p.price ?? 0)}</td>
    <td>${p.stock ?? 0}</td>
    <td>${p.reorderLevel ?? 0}</td>
    <td style="width:160px">
      <button type="button" class="btn-edit">تعديل</button>
      <button type="button" class="btn-delete">حذف</button>
    </td>
  `;
  
  // Add event listeners for edit and delete
  const editBtn = row.querySelector('.btn-edit');
  const deleteBtn = row.querySelector('.btn-delete');
  
  editBtn.addEventListener('click', () => setEditMode(p));
  deleteBtn.addEventListener('click', async () => {
        const ok = confirm('هل تريد حذف هذا المنتج؟ سيؤثر ذلك على إضافته مستقبلاً في الفواتير، ولن يحذف الفواتير السابقة.');
        if (!ok) return;
        try {
          const res = await window.api.products.delete(p._id);
          if (res && res.error) throw new Error(res.message || 'فشل حذف المنتج');
          row.remove();
          // Show success message
          const msg = $('#lowstock-message');
          if (msg) { msg.textContent = 'تم حذف المنتج بنجاح'; setTimeout(() => (msg.textContent = ''), 2000); }
          // Refresh the low stock list
          try { await loadLowStockProducts(); } catch {}
        } catch (err) {
          showErrorMessage('تعذر حذف المنتج: ' + (err.message || ''));
        }
      });
  
  function setEditMode(product) {
    row.innerHTML = `
      <td><input type="text" class="edit-name" value="${product.name}" style="width:100%; border:none; background:transparent" /></td>
      <td><input type="text" class="edit-category" value="${product.category || ''}" style="width:100%; border:none; background:transparent" /></td>
      <td><input type="number" class="edit-buy" value="${product.buyingPrice ?? 0}" step="0.01" min="0" style="width:100%; border:none; background:transparent" /></td>
      <td><input type="number" class="edit-sell" value="${product.sellingPrice ?? product.price ?? 0}" step="0.01" min="0" style="width:100%; border:none; background:transparent" /></td>
      <td><input type="number" class="edit-stock" value="${product.stock ?? 0}" step="0.01" min="0" style="width:100%; border:none; background:transparent" /></td>
      <td><input type="number" class="edit-reorder" value="${product.reorderLevel ?? 0}" step="0.01" min="0" style="width:100%; border:none; background:transparent" /></td>
      <td style="width:160px">
        <button type="button" class="btn-save" style="background:#10b981; color:#fff; margin-right:4px">حفظ</button>
        <button type="button" class="btn-cancel" style="background:#6b7280; color:#fff">إلغاء</button>
      </td>
    `;
    
    // Add event listeners for save and cancel
    const saveBtn = row.querySelector('.btn-save');
    const cancelBtn = row.querySelector('.btn-cancel');
    
    saveBtn.addEventListener('click', async () => {
      const name = row.querySelector('.edit-name').value.trim();
      const category = row.querySelector('.edit-category').value.trim();
      const buyingPrice = Number(row.querySelector('.edit-buy').value || 0);
      const sellingPrice = Number(row.querySelector('.edit-sell').value || 0);
      const stock = Number(row.querySelector('.edit-stock').value || 0);
      const reorderLevel = Number(row.querySelector('.edit-reorder').value || 0);
      
      try {
        const updated = await window.api.products.update(p._id, { name, category, buyingPrice, sellingPrice, stock, reorderLevel });
        // Update the product object with new data
        Object.assign(p, updated);
        setViewMode(p);
        // Show success message
        const msg = $('#lowstock-message');
        if (msg) { msg.textContent = `تم تحديث المنتج: ${updated.name}`; setTimeout(() => (msg.textContent = ''), 2000); }
        // Refresh the low stock list to reflect changes
        try { await loadLowStockProducts(); } catch {}
      } catch (err) {
        showErrorMessage('تعذر تحديث المنتج: ' + (err.message || ''));
      }
    });
    
    cancelBtn.addEventListener('click', () => setViewMode(product));
  }
  
  function setViewMode(product) {
    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.category || '—'}</td>
      <td>${currency(product.buyingPrice ?? 0)}</td>
      <td>${currency(product.sellingPrice ?? product.price ?? 0)}</td>
      <td>${product.stock ?? 0}</td>
      <td>${product.reorderLevel ?? 0}</td>
      <td style="width:160px">
        <button type="button" class="btn-edit">تعديل</button>
        <button type="button" class="btn-delete">حذف</button>
      </td>
    `;
    
    // Re-attach event listeners
    const editBtn = row.querySelector('.btn-edit');
    const deleteBtn = row.querySelector('.btn-delete');
    
    editBtn.addEventListener('click', () => setEditMode(product));
    deleteBtn.addEventListener('click', async () => {
      const ok = confirm('هل تريد حذف هذا المنتج؟ سيؤثر ذلك على إضافته مستقبلاً في الفواتير، ولن يحذف الفواتير السابقة.');
      if (!ok) return;
      try {
        const res = await window.api.products.delete(p._id);
        if (res && res.error) throw new Error(res.message || 'فشل حذف المنتج');
        row.remove();
        // Show success message
        const msg = $('#lowstock-message');
        if (msg) { msg.textContent = 'تم حذف المنتج بنجاح'; setTimeout(() => (msg.textContent = ''), 2000); }
        // Refresh the low stock list
        try { await loadLowStockProducts(); } catch {}
      } catch (err) {
        showErrorMessage('تعذر حذف المنتج: ' + (err.message || ''));
      }
    });
  }
  
  return row;
}

function renderLowStockList(list) {
  const tbody = $('#lowstock-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(p => tbody.appendChild(mountProductRowReadonly(p)));
}

async function loadLowStockProducts() {
  const list = await window.api.products.lowStock();
  renderLowStockList(list);
}

// Add refresh button functionality for low stock products
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = $('#refresh-lowstock');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        await loadLowStockProducts();
        const msg = $('#lowstock-message');
        if (msg) { msg.textContent = 'تم تحديث القائمة'; setTimeout(() => (msg.textContent = ''), 1500); }
      } catch (error) {
        console.error('Error refreshing low stock products:', error);
        showErrorMessage('تعذر تحديث قائمة المنتجات قرب النفاد');
      }
    });
  }
});

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

function normalizeObjId(id) {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id.buffer) {
    return Array.from(id.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  if (typeof id === 'object' && id.toString) return id.toString();
  return String(id);
}

async function loadCustomers() {
  const list = await window.api.customers.list();
  const container = $('#customer-list');
  if (!container) return;
  container.innerHTML = '';
  list.forEach(c => {
    const row = document.createElement('div');
    row.className = 'list-card';
    const cid = normalizeObjId(c._id);
    row.innerHTML = `
      <div>
        <strong>${c.name}</strong> — ${c.phone}
      </div>
      <div>
        <button type="button" class="btn-view-bills" data-id="${cid}">فواتير</button>
        <button type="button" class="btn-edit" data-id="${cid}" data-name="${c.name}" data-phone="${c.phone}">تعديل</button>
        <button type="button" class="btn-delete" data-id="${cid}">حذف</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Click actions
  container.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.classList.contains('btn-view-bills')) {
      const si = $('#search-input');
      if (si) si.value = '';
      // Defer filtered rendering to the search tab auto-loader
      window.pendingExplicitSearchFilters = { customerId: id, includeCustomerAsPlumber: true };
      // Switch to search tab to show results
      const tab = $$('.tab').find(t => t.getAttribute('data-tab') === 'search');
      if (tab) tab.click();
    } else if (btn.classList.contains('btn-edit')) {
      const curName = btn.getAttribute('data-name') || '';
      const curPhone = btn.getAttribute('data-phone') || '';
      const result = await openEditPersonModal({ title: 'تعديل العميل', name: curName, phone: curPhone, requirePhone: true });
      if (!result) return;
      try {
        const res = await window.api.customers.update(id, { name: result.name, phone: result.phone });
        if (res && !res.error) {
          showErrorMessage('تم التعديل', 'success');
          await loadCustomers();
        } else {
          showErrorMessage('تعذر التعديل: ' + (res?.message || '')); 
        }
      } catch (err) {
        showErrorMessage('خطأ في التعديل: ' + err.message);
      }
    } else if (btn.classList.contains('btn-delete')) {
      if (!confirm('حذف هذا العميل؟ سيبقى سجل الفواتير مرتبطاً بالمعرف.')) return;
      try {
        const res = await window.api.customers.delete(id);
        if (res && !res.error) {
          showErrorMessage('تم الحذف', 'success');
          await loadCustomers();
        } else {
          showErrorMessage('تعذر الحذف: ' + (res?.message || ''));
        }
      } catch (err) {
        showErrorMessage('خطأ في الحذف: ' + err.message);
      }
    }
  };
}

async function loadPlumbers() {
  const list = await window.api.plumbers.list();
  const container = $('#plumber-list');
  if (!container) return;
  container.innerHTML = '';
  list.forEach(p => {
    const row = document.createElement('div');
    row.className = 'list-card';
    const pid = normalizeObjId(p._id);
    row.innerHTML = `
      <div>
        <strong>${p.name}</strong>${p.phone ? ' — ' + p.phone : ''}
      </div>
      <div>
        <button type="button" class="btn-view-bills" data-name="${p.name}">فواتير</button>
        <button type="button" class="btn-edit" data-id="${pid}" data-name="${p.name}" data-phone="${p.phone || ''}">تعديل</button>
        <button type="button" class="btn-delete" data-id="${pid}">حذف</button>
      </div>
    `;
    container.appendChild(row);
  });

  container.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('btn-view-bills')) {
      const name = btn.getAttribute('data-name') || '';
      const si = $('#search-input');
      if (si) si.value = '';
      // Defer filtered rendering to the search tab auto-loader
      window.pendingExplicitSearchFilters = { plumberName: name, includePlumberAsCustomer: true };
      const tab = $$('.tab').find(t => t.getAttribute('data-tab') === 'search');
      if (tab) tab.click();
    } else if (btn.classList.contains('btn-edit')) {
      const id = btn.getAttribute('data-id');
      const curName = btn.getAttribute('data-name') || '';
      const curPhone = btn.getAttribute('data-phone') || '';
      const result = await openEditPersonModal({ title: 'تعديل السباك', name: curName, phone: curPhone, requirePhone: false });
      if (!result) return;
      try {
        const res = await window.api.plumbers.update(id, { name: result.name, phone: result.phone });
        if (res && !res.error) {
          showErrorMessage('تم التعديل', 'success');
          await loadPlumbers();
        } else {
          showErrorMessage('تعذر التعديل: ' + (res?.message || ''));
        }
      } catch (err) {
        showErrorMessage('خطأ في التعديل: ' + err.message);
      }
    } else if (btn.classList.contains('btn-delete')) {
      const id = btn.getAttribute('data-id');
      if (!confirm('حذف هذا السباك؟')) return;
      try {
        const res = await window.api.plumbers.delete(id);
        if (res && !res.error) {
          showErrorMessage('تم الحذف', 'success');
          await loadPlumbers();
        } else {
          showErrorMessage('تعذر الحذف: ' + (res?.message || ''));
        }
      } catch (err) {
        showErrorMessage('خطأ في الحذف: ' + err.message);
      }
    }
  };
}

// Search page functionality
async function displaySearchResults(searchTerm = '') {
  try {
    const filters = {};
    const term = normalizeDigits(searchTerm || '');
    if (term) {
      filters.search = term;
    }
    
    const list = await window.api.invoices.list(filters);
    const container = $('#search-results');
    
    if (!container) {
      console.error('Search results container not found!');
      return;
    }
    
    container.innerHTML = '';
    
    if (list.length === 0) {
      container.innerHTML = '<div class="muted">لا توجد فواتير</div>';
      return;
    }
    
    list.forEach(inv => {
      // Convert ObjectId buffer to string if needed
      let invoiceId = inv._id;
      if (typeof invoiceId === 'object' && invoiceId.buffer) {
        // Convert buffer to hex string
        invoiceId = Array.from(invoiceId.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
        if (DEBUG_MODE) console.log('🔄 Converted buffer ID to string in search:', invoiceId);
      } else if (typeof invoiceId === 'object' && invoiceId.toString) {
        invoiceId = invoiceId.toString();
      }
      
      if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.length < 8) {
        console.error('❌ Invalid invoice _id:', invoiceId, inv);
        return;
      }
      
      const card = document.createElement('div');
      card.className = 'list-card';
      const discountInfo = (inv.discountAbogaliPercent > 0 || inv.discountBrPercent > 0)
        ? ` | خصم ابوغالي ${inv.discountAbogaliPercent}% | خصم BR ${inv.discountBrPercent}%`
        : '';
        
      card.innerHTML = `
        <div>
          <div><strong>${inv.customer?.name || ''}</strong> — ${inv.customer?.phone || ''}</div>
          <div class="muted">السباك: ${inv.plumberName || ''}${discountInfo}</div>
          <div class="muted">تاريخ الإنشاء: ${new Date(inv.createdAt).toLocaleString()} | آخر تحديث: ${new Date(inv.updatedAt).toLocaleString()}</div>
          <div class="muted">رقم الفاتورة: ${inv.invoiceNumber ? `#${inv.invoiceNumber}` : '—'} | ID: ${invoiceId}</div>
          <div>الإجمالي: ${currency(inv.total)} | المتبقي: ${currency(inv.remaining)}</div>
        </div>
        <div>
          <button type="button" data-id="${invoiceId}" class="btn-view">عرض</button>
          <button type="button" data-id="${invoiceId}" class="btn-print">طباعة</button>
        </div>
      `;
      container.appendChild(card);
    });
    
    // Add event listeners for the buttons in search results
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      
      if (!id || typeof id !== 'string' || id.length < 8) {
        console.error('❌ Invalid invoice ID clicked:', id);
        showErrorMessage('خطأ: رقم الفاتورة غير صالح');
        return;
      }
      
      if (btn.classList.contains('btn-print')) {
        try {
          await window.api.print.invoice(id);
          showErrorMessage('تم إرسال الفاتورة للطباعة', 'success');
        } catch (error) {
          console.error('❌ Print error:', error);
          showErrorMessage('خطأ في الطباعة: ' + error.message);
        }
      } else if (btn.classList.contains('btn-edit')) {
        try {
          await showEditInvoiceForm(id);
        } catch (error) {
          console.error('❌ Edit error:', error);
          showErrorMessage('خطأ في تعديل الفاتورة: ' + error.message);
        }
      } else if (btn.classList.contains('btn-view')) {
        try {
          await showInvoiceDetail(id);
          // Switch to invoices tab to show the detail
          const invoicesTab = $$('.tab').find(t => t.getAttribute('data-tab') === 'invoices');
          if (invoicesTab) {
            invoicesTab.click();
          }
        } catch (error) {
          console.error('❌ View error:', error);
          showErrorMessage('خطأ في عرض الفاتورة: ' + error.message);
        }
      }
    });
    
  } catch (error) {
    console.error('Error displaying search results:', error);
    const container = $('#search-results');
    if (container) {
      container.innerHTML = '<div class="muted" style="color: red;">خطأ في تحميل النتائج</div>';
    }
  }
}

// Search button functionality
const searchBtn = $('#search-btn');
if (searchBtn) {
  searchBtn.addEventListener('click', async () => {
    try {
      const searchTerm = normalizeDigits($('#search-input').value.trim());
      if (DEBUG_MODE) console.log('Search button clicked with term:', searchTerm);
      await displaySearchResults(searchTerm);
      
      if (searchTerm) {
        showErrorMessage(`تم البحث عن: ${searchTerm}`, 'success');
      } else {
        showErrorMessage('تم عرض جميع الفواتير', 'success');
      }
    } catch (error) {
      console.error('Error searching:', error);
      showErrorMessage('خطأ في البحث: ' + error.message);
    }
  });
}

// Clear search button
const clearSearchBtn = $('#clear-search-btn');
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', async () => {
    try {
      $('#search-input').value = '';
      await displaySearchResults('');
      showErrorMessage('تم عرض جميع الفواتير', 'success');
    } catch (error) {
      console.error('Error clearing search:', error);
      showErrorMessage('خطأ في عرض الفواتير: ' + error.message);
    }
  });
}

// Add Enter key support for search
const searchInput = $('#search-input');
if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const searchBtn = $('#search-btn');
      if (searchBtn) {
        searchBtn.click();
      }
    }
  });
  // Live search on search tab as user types (debounced)
  searchInput.addEventListener('input', debounce((e) => {
    const term = normalizeDigits(e.target.value.trim());
    displaySearchResults(term);
  }, 250));
}

// Load all invoices when search tab is opened
$$('.tab').forEach(tab => {
  if (tab.getAttribute('data-tab') === 'search') {
    tab.addEventListener('click', async () => {
      // Small delay to ensure tab is active
      setTimeout(async () => {
        const pending = window.pendingExplicitSearchFilters;
        if (pending) {
          try {
            await displayInvoicesWithFilters(pending);
          } finally {
            window.pendingExplicitSearchFilters = null;
          }
        } else {
          await displaySearchResults('');
        }
      }, 100);
    });
  }
});

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
        stock: Number($('#prod-stock').value || 0),
        reorderLevel: Number($('#prod-reorder').value || 0)
      });
      $('#prod-name').value = '';
      $('#prod-category').value = '';
      $('#prod-buy').value = '';
      $('#prod-sell').value = '';
      $('#prod-stock').value = '';
      $('#prod-reorder').value = '';
      const msg = $('#product-message');
      if (msg) { msg.textContent = `تم الحفظ: ${created.name}`; setTimeout(() => (msg.textContent = ''), 2000); }
      await loadProducts();
      try { await loadLowStockProducts(); } catch {}
    } catch (error) {
      console.error('Error creating product:', error);
    }
  });
}

// Function to check database status and show error if both are down
async function checkDatabaseStatus() {
  try {
    // Try to make a simple API call to test database connectivity
    await window.api.products.list();
    return true; // Database is working
  } catch (error) {
    console.error('Database connectivity check failed:', error);
    return false; // Database is down
  }
}

// Function to show big database error message
function showDatabaseError() {
  const errorHtml = `
    <div id="database-error-overlay" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    ">
      <div style="
        background: #dc2626;
        color: white;
        padding: 40px;
        border-radius: 16px;
        text-align: center;
        max-width: 600px;
        margin: 20px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
        <h1 style="font-size: 32px; margin: 0 0 20px 0; font-weight: bold;">خطأ في قاعدة البيانات</h1>
        <p style="font-size: 18px; margin: 0 0 20px 0; line-height: 1.6;">
          لا يمكن الاتصال بقاعدة البيانات المحلية أو السحابية.<br>
          يرجى التحقق من اتصال الإنترنت وإعادة تشغيل التطبيق.
        </p>
        <div style="
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          font-size: 14px;
        ">
          <strong>خطوات الحل:</strong><br>
          1. تحقق من اتصال الإنترنت<br>
          2. أعد تشغيل التطبيق<br>
          3. إذا استمرت المشكلة، اتصل بالدعم الفني
        </div>
        <button onclick="location.reload()" style="
          background: white;
          color: #dc2626;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 10px;
        ">إعادة المحاولة</button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', errorHtml);
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  if (DEBUG_MODE) console.log('DOM loaded, initializing app...');
  
  // Check database status first
  const dbWorking = await checkDatabaseStatus();
  if (!dbWorking) {
    showDatabaseError();
    return; // Don't continue with normal initialization
  }
  
  // Set up periodic database health check (every 30 seconds)
  setInterval(async () => {
    const dbWorking = await checkDatabaseStatus();
    if (!dbWorking) {
      // Only show error if it's not already showing
      if (!document.getElementById('database-error-overlay')) {
        showDatabaseError();
      }
    }
  }, 30000);
  
  // Initialize invoice form with first row
  const itemsBody = $('#items-body');
  if (itemsBody && itemsBody.children.length === 0) {
    itemsBody.appendChild(newItemRow());
    updateRowNumbers();
  }
  
  // Test if basic elements exist
  const invoiceList = $('#invoice-list');
  const refreshBtn = $('#refresh-invoices');
  if (DEBUG_MODE) console.log('Invoice list element:', invoiceList ? 'Found' : 'NOT FOUND');
  if (DEBUG_MODE) console.log('Refresh button:', refreshBtn ? 'Found' : 'NOT FOUND');
  
  // Add visible indicator that frontend is working
  if (invoiceList) {
    invoiceList.innerHTML = '<div style="color: green; padding: 10px; border: 2px solid green;">✓ Frontend loaded successfully - Testing invoice loading...</div>';
  }
  
  // Initialize font size
  initializeFontSize();
  
  // Load default discount values
  loadDefaultDiscounts();
  
  // Initial boot
  try {
    $('#add-item')?.click();
    $('#add-payment')?.click();
    
    // Force load invoices with extra logging
    if (DEBUG_MODE) console.log('About to load invoices...');
    setTimeout(() => {
      loadInvoices().then(() => {
        if (DEBUG_MODE) console.log('loadInvoices completed');
      }).catch(error => {
        console.error('loadInvoices failed:', error);
        const invoiceList = $('#invoice-list');
        if (invoiceList) {
          invoiceList.innerHTML = '<div style="color: red; padding: 10px; border: 2px solid red;">✗ Error loading invoices: ' + error.message + '</div>';
        }
      });
    }, 1000);
    
    loadProducts();
    loadCustomers();
    loadPlumbers();
    if (DEBUG_MODE) console.log('App initialized successfully');
  } catch (error) {
    console.error('Error initializing app:', error);
    if (invoiceList) {
      invoiceList.innerHTML = '<div style="color: red; padding: 10px; border: 2px solid red;">✗ Error initializing: ' + error.message + '</div>';
    }
  }
});

// Settings functionality
document.addEventListener('DOMContentLoaded', () => {
  // Settings tab functionality
  const settingsTab = $$('.tab').find(t => t.getAttribute('data-tab') === 'settings');
  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      loadSettings();
    });
  }

  // Settings backup button
  const settingsBackupBtn = $('#settings-backup-btn');
  if (settingsBackupBtn) {
    settingsBackupBtn.addEventListener('click', async () => {
      try {
        showLoadingState(settingsBackupBtn, 'جاري إنشاء النسخة...');
        const result = await window.api.backup.create();
        hideLoadingState(settingsBackupBtn, 'نسخة احتياطية');
        showErrorMessage('تم إنشاء النسخة الاحتياطية بنجاح', 'success');
      } catch (error) {
        hideLoadingState(settingsBackupBtn, 'نسخة احتياطية');
        showErrorMessage('خطأ في إنشاء النسخة الاحتياطية: ' + error.message);
      }
    });
  }

  // Settings restore button
  const settingsRestoreBtn = $('#settings-restore-btn');
  if (settingsRestoreBtn) {
    settingsRestoreBtn.addEventListener('click', async () => {
      try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          try {
            showLoadingState(settingsRestoreBtn, 'جاري الاستعادة...');
            const result = await window.api.backup.restore(file.path);
            hideLoadingState(settingsRestoreBtn, 'استعادة نسخة');
            showErrorMessage('تم استعادة النسخة الاحتياطية بنجاح', 'success');
            // Reload the application
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } catch (error) {
            hideLoadingState(settingsRestoreBtn, 'استعادة نسخة');
            showErrorMessage('خطأ في استعادة النسخة الاحتياطية: ' + error.message);
          }
        };
        fileInput.click();
      } catch (error) {
        showErrorMessage('خطأ في استعادة النسخة الاحتياطية: ' + error.message);
      }
    });
  }

  // Settings font size control
  const settingsFontSize = $('#settings-font-size');
  const settingsFontSizeValue = $('#settings-font-size-value');
  if (settingsFontSize && settingsFontSizeValue) {
    settingsFontSize.addEventListener('input', (e) => {
      const size = e.target.value;
      settingsFontSizeValue.textContent = size + 'px';
      applyUiFontSize(size);
      // Save to localStorage with consistent key
      localStorage.setItem('app-font-size', size);
      // Also save to old key for backward compatibility
      localStorage.setItem('uiFontSize', size);
    });
  }

  // Save discounts button
  const saveDiscountsBtn = $('#save-discounts-btn');
  if (saveDiscountsBtn) {
    saveDiscountsBtn.addEventListener('click', async () => {
      try {
        const brDiscount = $('#br-discount').value;
        const aboghaliDiscount = $('#aboghali-discount').value;
        
        // Save to localStorage
        localStorage.setItem('br-discount', brDiscount);
        localStorage.setItem('aboghali-discount', aboghaliDiscount);
        
        showErrorMessage('تم حفظ الخصومات بنجاح', 'success');
      } catch (error) {
        showErrorMessage('خطأ في حفظ الخصومات: ' + error.message);
      }
    });
  }
});

// Load settings function
async function loadSettings() {
  try {
    // Load font size
    const savedFontSize = getStoredFontSize();
    const settingsFontSize = $('#settings-font-size');
    const settingsFontSizeValue = $('#settings-font-size-value');
    if (settingsFontSize && settingsFontSizeValue) {
      settingsFontSize.value = savedFontSize;
      settingsFontSizeValue.textContent = savedFontSize + 'px';
    }

    // Load discounts
    const brDiscount = localStorage.getItem('br-discount') || '0';
    const aboghaliDiscount = localStorage.getItem('aboghali-discount') || '0';
    const brDiscountInput = $('#br-discount');
    const aboghaliDiscountInput = $('#aboghali-discount');
    if (brDiscountInput) brDiscountInput.value = brDiscount;
    if (aboghaliDiscountInput) aboghaliDiscountInput.value = aboghaliDiscount;
  } catch (error) {
    if (DEBUG_MODE) console.error('Error loading settings:', error);
  }
}

// Load default discount values into invoice form
function loadDefaultDiscounts() {
  try {
    const brDiscount = localStorage.getItem('br-discount') || '0';
    const aboghaliDiscount = localStorage.getItem('aboghali-discount') || '0';
    
    const brDiscountInput = $('#discount-br');
    const aboghaliDiscountInput = $('#discount-abogali');
    
    if (brDiscountInput) brDiscountInput.value = brDiscount;
    if (aboghaliDiscountInput) aboghaliDiscountInput.value = aboghaliDiscount;
    
    // Apply discounts to existing rows
    applyDiscountsToAllRows();
  } catch (error) {
    if (DEBUG_MODE) console.error('Error loading default discounts:', error);
  }
}

// Initialize font size on app startup
function initializeFontSize() {
  try {
    const savedFontSize = getStoredFontSize();
    applyUiFontSize(savedFontSize);
    
    // Update settings font size control if it exists
    const settingsFontSize = $('#settings-font-size');
    const settingsFontSizeValue = $('#settings-font-size-value');
    if (settingsFontSize && settingsFontSizeValue) {
      settingsFontSize.value = savedFontSize;
      settingsFontSizeValue.textContent = savedFontSize + 'px';
    }
    
    if (DEBUG_MODE) console.log('Font size initialized to:', savedFontSize + 'px');
  } catch (error) {
    if (DEBUG_MODE) console.error('Error initializing font size:', error);
  }
}
