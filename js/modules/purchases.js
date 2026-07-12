/* ============================================
   PURCHASES MODULE
   Purchase orders, supplier purchases
   ============================================ */

const PurchasesModule = {
  async render(container, subpage, id) {
    if (subpage === 'add') return this.renderForm(container);
    if (subpage === 'edit' && id) return this.renderForm(container, parseInt(id));
    if (subpage === 'view' && id) return this.renderDetail(container, parseInt(id));
    return this.renderList(container);
  },

  async renderList(container) {
    const purchases = await LoyDB.getAll('purchases');
    const filtered = Auth.filterByBranch(purchases);
    const suppliers = await LoyDB.getAll('suppliers');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Purchases</h1>
          <p class="page-subtitle">Manage purchase orders and supplier invoices</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="App.navigate('purchases/add')">➕ New Purchase Order</button>` : ''}
        </div>
      </div>

      <div id="purchases-table" class="animate-fadeInUp"></div>
    `;

    const tableContainer = document.getElementById('purchases-table');
    tableContainer.innerHTML = DataTable.render({
      id: 'pur-tbl',
      columns: [
        { key: 'po_number', label: 'PO Number', render: (row) => `<span class="font-mono font-semibold">${row.po_number}</span>` },
        { key: 'date', label: 'Date', render: (row) => Utils.formatDate(row.date) },
        { key: 'supplier_id', label: 'Supplier', render: (row) => {
          const sup = suppliers.find(s => s.id === row.supplier_id);
          return sup ? Utils.escapeHtml(sup.name) : '-';
        }},
        { key: 'total', label: 'Total', render: (row) => `<span class="font-bold">${Utils.currency(row.total)}</span>` },
        { key: 'status', label: 'Status', render: (row) => Utils.statusBadge(row.status) },
        { key: 'payment_status', label: 'Payment', render: (row) => Utils.statusBadge(row.payment_status) },
      ],
      data: filtered.sort((a, b) => new Date(b.date) - new Date(a.date)),
      pagination: true,
      perPage: 15,
      emptyMessage: 'No purchase orders found',
      emptyIcon: '🛍️',
      actions: [
        { icon: '👁️', title: 'View', class: 'view', onclick: 'PurchasesModule.viewPurchase' },
        ...(Auth.canUpdate() ? [{ icon: '✏️', title: 'Edit', class: 'edit', onclick: 'PurchasesModule.editPurchase' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'PurchasesModule.deletePurchase' }] : []),
      ],
    });
  },

  viewPurchase(id) { App.navigate(`purchases/view/${id}`); },
  editPurchase(id) { App.navigate(`purchases/edit/${id}`); },

  async deletePurchase(id) {
    const confirmed = await Modal.confirm('Delete Purchase', 'Delete this purchase order?', 'danger');
    if (confirmed) {
      await LoyDB.delete('purchases', id);
      Toast.show('Deleted', 'Purchase order deleted', 'success');
      App.navigate('purchases');
    }
  },

  async renderForm(container, editId = null) {
    const suppliers = await LoyDB.getAll('suppliers');
    let purchase = null;
    if (editId) {
      purchase = await LoyDB.get('purchases', editId);
      if (!purchase) { App.navigate('purchases'); return; }
    }
    const isEdit = !!purchase;
    const poNum = purchase?.po_number || `LY-PO-${String((await LoyDB.getAll('purchases')).length + 1).padStart(5, '0')}`;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${isEdit ? 'Edit' : 'New'} Purchase Order</h1>
        </div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('purchases')">← Back</button>
        </div>
      </div>

      <form id="purchase-form" onsubmit="PurchasesModule.savePurchase(event, ${editId || 'null'})" class="animate-fadeInUp">
        <div class="card mb-6">
          <div class="card-header"><h4>📋 Purchase Details</h4></div>
          <div class="card-body">
            <div class="product-form-grid">
              <div class="form-group">
                <label class="form-label">PO Number</label>
                <input type="text" class="form-control" name="po_number" value="${poNum}" readonly style="background:var(--bg-secondary)">
              </div>
              <div class="form-group">
                <label class="form-label">Date <span class="required">*</span></label>
                <input type="date" class="form-control" name="date" value="${purchase ? new Date(purchase.date).toISOString().split('T')[0] : Utils.today()}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Supplier <span class="required">*</span></label>
                <select class="form-control" name="supplier_id" required>
                  <option value="">Select Supplier</option>
                  ${suppliers.map(s => `<option value="${s.id}" ${purchase?.supplier_id == s.id ? 'selected' : ''}>${Utils.escapeHtml(s.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-control" name="status">
                  ${['ordered', 'received', 'partial', 'cancelled'].map(s => `<option value="${s}" ${purchase?.status === s ? 'selected' : ''}>${Utils.capitalize(s)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Status</label>
                <select class="form-control" name="payment_status">
                  ${['unpaid', 'partial', 'paid'].map(s => `<option value="${s}" ${purchase?.payment_status === s ? 'selected' : ''}>${Utils.capitalize(s)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Subtotal <span class="required">*</span></label>
                <input type="number" class="form-control" name="subtotal" value="${purchase?.subtotal || ''}" required min="0" step="0.01">
              </div>
              <div class="form-group">
                <label class="form-label">GST Amount</label>
                <input type="number" class="form-control" name="gst" value="${purchase?.gst || 0}" min="0" step="0.01">
              </div>
              <div class="form-group">
                <label class="form-label">Total <span class="required">*</span></label>
                <input type="number" class="form-control" name="total" value="${purchase?.total || ''}" required min="0" step="0.01">
              </div>
            </div>
            <div class="form-group mt-4">
              <label class="form-label">Notes</label>
              <textarea class="form-control" name="notes" rows="3">${purchase?.notes || ''}</textarea>
            </div>
          </div>
        </div>
        <div class="d-flex gap-3 justify-end">
          <button type="button" class="btn btn-outline" onclick="App.navigate('purchases')">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '💾 Update' : '➕ Create'} Purchase</button>
        </div>
      </form>
    `;
  },

  async savePurchase(e, editId) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    ['subtotal', 'gst', 'total'].forEach(k => data[k] = parseFloat(data[k]) || 0);
    data.supplier_id = parseInt(data.supplier_id);
    data.date = new Date(data.date).toISOString();
    data.branch_id = App.activeBranch || 1;

    try {
      if (editId) {
        const existing = await LoyDB.get('purchases', editId);
        Object.assign(existing, data);
        await LoyDB.put('purchases', existing);
        Toast.show('Updated', 'Purchase order updated', 'success');
      } else {
        await LoyDB.add('purchases', data);
        Toast.show('Created', 'Purchase order created', 'success');
      }
      await Auth.logActivity('purchase', `${editId ? 'Updated' : 'Created'} PO: ${data.po_number}`);
      App.navigate('purchases');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  },

  async renderDetail(container, id) {
    const purchase = await LoyDB.get('purchases', id);
    if (!purchase) { App.navigate('purchases'); return; }
    const suppliers = await LoyDB.getAll('suppliers');
    const supplier = suppliers.find(s => s.id === purchase.supplier_id);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${purchase.po_number}</h1>
          <p class="page-subtitle">${Utils.formatDate(purchase.date, 'full')}</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('purchases')">← Back</button>
          ${Auth.canUpdate() ? `<button class="btn btn-primary" onclick="App.navigate('purchases/edit/${id}')">✏️ Edit</button>` : ''}
        </div>
      </div>
      <div class="two-column-layout animate-fadeInUp">
        <div class="card">
          <div class="card-header"><h4>📋 Order Details</h4></div>
          <div class="card-body">
            <table class="data-table">
              <tbody>
                <tr><td class="text-secondary">PO Number</td><td class="font-mono font-semibold">${purchase.po_number}</td></tr>
                <tr><td class="text-secondary">Date</td><td>${Utils.formatDate(purchase.date, 'full')}</td></tr>
                <tr><td class="text-secondary">Supplier</td><td>${supplier ? Utils.escapeHtml(supplier.name) : '-'}</td></tr>
                <tr><td class="text-secondary">Status</td><td>${Utils.statusBadge(purchase.status)}</td></tr>
                <tr><td class="text-secondary">Notes</td><td>${purchase.notes || '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h4>💰 Payment</h4></div>
          <div class="card-body">
            <table class="data-table">
              <tbody>
                <tr><td class="text-secondary">Subtotal</td><td>${Utils.currency(purchase.subtotal)}</td></tr>
                <tr><td class="text-secondary">GST</td><td>${Utils.currency(purchase.gst)}</td></tr>
                <tr><td class="text-secondary">Total</td><td class="font-bold text-primary" style="font-size:1.25rem">${Utils.currency(purchase.total)}</td></tr>
                <tr><td class="text-secondary">Payment Status</td><td>${Utils.statusBadge(purchase.payment_status)}</td></tr>
                ${purchase.paid_amount ? `<tr><td class="text-secondary">Paid Amount</td><td>${Utils.currency(purchase.paid_amount)}</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
};
