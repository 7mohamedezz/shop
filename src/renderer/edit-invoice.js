// Invoice editing functionality

async function showEditInvoiceForm(invoiceId) {
  console.log('Opening edit form for invoice:', invoiceId);

  try {
    const inv = await window.api.invoices.getById(invoiceId);
    if (!inv) {
      showErrorMessage('لم يتم العثور على الفاتورة');
      return;
    }

    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'edit-invoice-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
    `;

    // Build a display ID: prefer numeric invoiceNumber, else last 6 of _id
    let internalIdStr = inv._id;
    if (typeof internalIdStr === 'object' && internalIdStr?.buffer) {
      internalIdStr = Array.from(internalIdStr.buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } else if (typeof internalIdStr === 'object' && internalIdStr?.toString) {
      internalIdStr = internalIdStr.toString();
    } else {
      internalIdStr = String(internalIdStr);
    }
    const shortId = internalIdStr && typeof internalIdStr === 'string' ? internalIdStr.slice(-6) : '';
    const displayId =
      Number.isFinite(Number(inv.invoiceNumber)) && inv.invoiceNumber !== 0 ? inv.invoiceNumber : shortId || 'غير محدد';

    modal.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 12px; max-width: 960px; width: 95%; max-height: 90%; overflow-y: auto; direction: rtl; box-shadow: 0 10px 30px rgba(0,0,0,0.15)">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin:0; font-size:20px">تعديل الفاتورة #${displayId}</h2>
          <button id="close-edit-modal" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">إغلاق</button>
        </div>
        
        <form id="edit-invoice-form">
          <div class="row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <label style="display:flex; flex-direction:column; gap:6px">اسم العميل
              <input type="text" id="edit-cust-name" placeholder="اسم العميل" value="${inv.customer?.name || ''}" required/>
            </label>
            <label style="display:flex; flex-direction:column; gap:6px">الهاتف
              <input type="text" id="edit-cust-phone" placeholder="مثال: 01012345678" inputmode="tel" value="${inv.customer?.phone || ''}" required/>
            </label>
            <label style="display:flex; flex-direction:column; gap:6px">السباك
              <input type="text" id="edit-plumber-name" placeholder="اسم السباك" value="${inv.plumberName || ''}" />
            </label>
          </div>
          
          <div class="row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <label style="display:flex; flex-direction:column; gap:6px">خصم ابوغالي %
              <input type="number" id="edit-discount-abogali" min="0" max="100" step="1" value="${inv.discountAbogaliPercent || 0}" />
            </label>
            <label style="display:flex; flex-direction:column; gap:6px">خصم BR %
              <input type="number" id="edit-discount-br" min="0" max="100" step="1" value="${inv.discountBrPercent || 0}" />
            </label>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display:flex; flex-direction:column; gap:6px">ملاحظات
              <textarea id="edit-invoice-notes" rows="3" placeholder="ملاحظات الفاتورة...">${inv.notes || ''}</textarea>
            </label>
          </div>
          
          <div style="margin-bottom: 16px;">
            <h4>الأصناف</h4>
            <table class="items-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px; border: 1px solid #d1d5db;">المنتج</th>
                  <th style="padding: 8px; border: 1px solid #d1d5db;">الكمية</th>
                  <th style="padding: 8px; border: 1px solid #d1d5db;">سعر البيع</th>
                  <th style="padding: 8px; border: 1px solid #d1d5db;">الفئة</th>
                  <th style="padding: 8px; border: 1px solid #d1d5db; width: 90px; text-align:center;">تم التسليم</th>
                  <th style="padding: 8px; border: 1px solid #d1d5db;"></th>
                </tr>
              </thead>
              <tbody id="edit-items-body">
                ${(inv.items || [])
    .map(
      (item, index) => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #d1d5db; position: relative;">
                      <input type="text" data-index="${index}" class="edit-item-name" value="${item.product?.name || ''}" style="width: 100%; border: none; background: transparent;" />
                      <div class="edit-item-suggestions" style="display:none; position:absolute; right:0; left:0; top:100%; z-index:1001; background:#fff; border:1px solid #d1d5db; max-height:200px; overflow:auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"></div>
                    </td>
                    <td style="padding: 8px; border: 1px solid #d1d5db;">
                      <input type="number" data-index="${index}" class="edit-item-qty" value="${item.qty}" min="0" step="0.01" style="width: 100%; border: none; background: transparent;" />
                    </td>
                    <td style="padding: 8px; border: 1px solid #d1d5db;">
                      <input type="number" data-index="${index}" class="edit-item-price" value="${item.price}" min="0" step="0.01" style="width: 100%; border: none; background: transparent;" />
                    </td>
                    <td style="padding: 8px; border: 1px solid #d1d5db;">
                      <input type="text" data-index="${index}" class="edit-item-category" value="${item.category || ''}" style="width: 100%; border: none; background: transparent;" />
                    </td>
                    <td style="padding: 8px; border: 1px solid #d1d5db; text-align:center;">
                      <input type="checkbox" data-index="${index}" class="edit-item-delivered" ${item.delivered ? 'checked' : ''} />
                    </td>
                    <td style="padding: 8px; border: 1px solid #d1d5db;">
                      <button type="button" class="remove-item-btn" data-index="${index}" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">حذف</button>
                    </td>
                  </tr>
                `
    )
    .join('')}
              </tbody>
            </table>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
              <button type="button" id="add-edit-item" style="background: #16a34a; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">+ إضافة بند</button>
              <div id="edit-totals" style="font-weight:600; color:#111827">الإجمالي: <span id="edit-total-val">0</span></div>
            </div>
          </div>
          
          <div class="row" style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" id="cancel-edit" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer;">إلغاء</button>
            <button type="submit" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer;">حفظ التغييرات</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    $('#close-edit-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    $('#cancel-edit').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Add item functionality
    $('#add-edit-item').addEventListener('click', () => {
      const tbody = $('#edit-items-body');
      const newIndex = tbody.children.length;
      const newRow = document.createElement('tr');
      newRow.innerHTML = `
        <td style="padding: 8px; border: 1px solid #d1d5db; position: relative;">
          <input type="text" data-index="${newIndex}" class="edit-item-name" placeholder="اسم المنتج" style="width: 100%; border: none; background: transparent;" />
          <div class="edit-item-suggestions" style="display:none; position:absolute; right:0; left:0; top:100%; z-index:1001; background:#fff; border:1px solid #d1d5db; max-height:200px; overflow:auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"></div>
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">
          <input type="number" data-index="${newIndex}" class="edit-item-qty" value="1" min="0" step="0.01" inputmode="decimal" style="width: 100%; border: none; background: transparent;" />
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">
          <input type="number" data-index="${newIndex}" class="edit-item-price" value="0" min="0" step="0.01" inputmode="decimal" style="width: 100%; border: none; background: transparent;" />
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">
          <input type="text" data-index="${newIndex}" class="edit-item-category" placeholder="الفئة" style="width: 100%; border: none; background: transparent;" />
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db; text-align:center;">
          <input type="checkbox" data-index="${newIndex}" class="edit-item-delivered" />
        </td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">
          <button type="button" class="remove-item-btn" data-index="${newIndex}" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">حذف</button>
        </td>
      `;
      tbody.appendChild(newRow);
      attachLiveSearchToRow(newRow);
      recomputeEditTotals();
    });

    // Remove item functionality
    modal.addEventListener('click', e => {
      if (e.target.classList.contains('remove-item-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const row = e.target.closest('tr');
        if (row) {
          row.remove();
          recomputeEditTotals();
        }
      }
    });

    // Attach live search to all current rows
    $$('#edit-items-body tr').forEach(tr => attachLiveSearchToRow(tr));

    // Recompute totals on edit inputs to mirror create form UX
    function recomputeEditTotals() {
      let total = 0;
      $$('#edit-items-body tr').forEach(tr => {
        const qty = Number(tr.querySelector('.edit-item-qty')?.value || 0);
        const price = Number(tr.querySelector('.edit-item-price')?.value || 0);
        total += qty * price;
      });
      const el = document.getElementById('edit-total-val');
      if (el) {
        el.textContent = String(Number(total.toFixed(2)));
      }
    }

    // Make recomputeEditTotals globally accessible
    window.recomputeEditTotals = recomputeEditTotals;
    modal.addEventListener('input', e => {
      if (e.target.closest('#edit-items-body')) {
        recomputeEditTotals();
      }
    });
    // Initialize totals on open
    recomputeEditTotals();

    // Form submission
    $('#edit-invoice-form').addEventListener('submit', async e => {
      e.preventDefault();

      try {
        const updateData = {
          customer: {
            name: $('#edit-cust-name').value.trim(),
            phone: $('#edit-cust-phone').value.trim()
          },
          plumberName: $('#edit-plumber-name').value.trim(),
          discountAbogaliPercent: Number($('#edit-discount-abogali').value || 0),
          discountBrPercent: Number($('#edit-discount-br').value || 0),
          notes: $('#edit-invoice-notes').value.trim(),
          items: []
        };

        // Collect items
        const itemRows = $$('#edit-items-body tr');
        itemRows.forEach(row => {
          const name = row.querySelector('.edit-item-name').value.trim();
          const qty = Number(row.querySelector('.edit-item-qty').value || 0);
          const price = Number(row.querySelector('.edit-item-price').value || 0);
          const category = row.querySelector('.edit-item-category').value.trim();
          const delivered = !!row.querySelector('.edit-item-delivered')?.checked;

          if (name && qty > 0) {
            updateData.items.push({
              name,
              qty,
              price,
              category,
              delivered
            });
          }
        });

        if (updateData.items.length === 0) {
          showErrorMessage('يجب إضافة بند واحد على الأقل');
          return;
        }

        await window.api.invoices.update(invoiceId, updateData);

        // Close modal
        document.body.removeChild(modal);

        // Refresh displays
        await loadInvoices();
        await showInvoiceDetail(invoiceId);

        showErrorMessage('تم تحديث الفاتورة بنجاح', 'success');
      } catch (error) {
        console.error('Error updating invoice:', error);
        showErrorMessage('خطأ في تحديث الفاتورة: ' + error.message);
      }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  } catch (error) {
    console.error('Error opening edit form:', error);
    showErrorMessage('خطأ في فتح نموذج التعديل: ' + error.message);
  }
}

// Debounce utility for limiting rapid input calls
function debounce(fn, delay = 200) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Wire live search/autocomplete behavior for a given edit table row
function attachLiveSearchToRow(tr) {
  if (!tr) {
    return;
  }
  const nameInput = tr.querySelector('.edit-item-name');
  const priceInput = tr.querySelector('.edit-item-price');
  const categoryInput = tr.querySelector('.edit-item-category');
  const sugg = tr.querySelector('.edit-item-suggestions');
  if (!nameInput || !sugg) {
    return;
  }

  const hide = () => {
    sugg.style.display = 'none';
  };
  const show = () => {
    sugg.style.display = 'block';
  };

  const renderList = list => {
    if (!list || !list.length) {
      sugg.innerHTML = '';
      hide();
      return;
    }
    sugg.innerHTML = list
      .map(p => {
        const price = p.sellingPrice ?? p.price ?? 0;
        const cat = p.category || '';
        const safeName = (p.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="opt" data-name="${safeName}" data-price="${price}" data-category="${cat}" style="padding:6px 8px; cursor:pointer; border-bottom:1px solid #eee;">
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <span>${safeName}</span>
          <span style="color:#6b7280; font-size:12px;">${price}${cat ? ` • ${cat}` : ''}</span>
        </div>
      </div>`;
      })
      .join('');
    show();
  };

  const doSearch = debounce(async () => {
    const q = (nameInput.value || '').trim();
    if (!q) {
      sugg.innerHTML = '';
      hide();
      return;
    }
    try {
      const res = await window.api.products.search(q);
      renderList(res || []);
    } catch (e) {
      console.error('search error', e);
      sugg.innerHTML = '';
      hide();
    }
  }, 200);

  nameInput.addEventListener('input', doSearch);
  nameInput.addEventListener('focus', () => {
    if (sugg.innerHTML && nameInput.value.trim()) {
      show();
    }
  });

  // Handle suggestion click (event delegation on container)
  sugg.addEventListener('click', e => {
    const opt = e.target.closest('.opt');
    if (!opt) {
      return;
    }
    const n = opt.getAttribute('data-name') || '';
    const p = Number(opt.getAttribute('data-price') || 0);
    const c = opt.getAttribute('data-category') || '';
    nameInput.value = n;
    if (priceInput) {
      priceInput.value = String(p);
    }
    if (categoryInput) {
      categoryInput.value = c;
    }
    hide();
  });

  // Hide suggestions when clicking outside the row
  document.addEventListener('click', e => {
    if (!tr.contains(e.target)) {
      hide();
    }
  });
}
