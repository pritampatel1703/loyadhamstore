/* ============================================
   SUPPLIERS MODULE
   ============================================ */

const SuppliersModule = {
  async render(container, subpage, id) {
    if (subpage === 'add') return this.renderForm(container);
    if (subpage === 'edit' && id) return this.renderForm(container, parseInt(id));
    if (subpage === 'view' && id) return this.renderDetail(container, parseInt(id));
    return this.renderList(container);
  },

  async renderList(container) {
    const suppliers = await LoyDB.getAll('suppliers');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Suppliers</h1>
          <p class="page-subtitle">${suppliers.length} suppliers registered</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="App.navigate('suppliers/add')">➕ Add Supplier</button>` : ''}
        </div>
      </div>
      <div id="suppliers-table" class="animate-fadeInUp"></div>
    `;

    document.getElementById('suppliers-table').innerHTML = DataTable.render({
      id: 'sup-tbl',
      columns: [
        { key: 'name', label: 'Supplier', render: (row) => `<div><div class="font-semibold">${Utils.escapeHtml(row.name)}</div><div class="text-xs text-secondary">${Utils.escapeHtml(row.contact || '')}</div></div>` },
        { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
        { key: 'city', label: 'City', render: (row) => row.city || '-' },
        { key: 'gst', label: 'GSTIN', render: (row) => `<span class="font-mono text-xs">${row.gst || '-'}</span>` },
        { key: 'balance', label: 'Balance', render: (row) => `<span class="font-semibold ${row.balance > 0 ? 'text-danger' : ''}">${Utils.currency(row.balance)}</span>` },
        { key: 'status', label: 'Status', render: (row) => Utils.statusBadge(row.status) },
      ],
      data: suppliers,
      searchable: true,
      searchKeys: ['name', 'phone', 'city', 'contact'],
      pagination: true,
      perPage: 15,
      emptyMessage: 'No suppliers found',
      emptyIcon: '🏭',
      actions: [
        { icon: '👁️', title: 'View', class: 'view', onclick: 'SuppliersModule.viewSupplier' },
        ...(Auth.canUpdate() ? [{ icon: '✏️', title: 'Edit', class: 'edit', onclick: 'SuppliersModule.editSupplier' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'SuppliersModule.deleteSupplier' }] : []),
      ],
    });
  },

  viewSupplier(id) { App.navigate(`suppliers/view/${id}`); },
  editSupplier(id) { App.navigate(`suppliers/edit/${id}`); },

  async deleteSupplier(id) {
    const confirmed = await Modal.confirm('Delete Supplier', 'Are you sure?', 'danger');
    if (confirmed) {
      await LoyDB.delete('suppliers', id);
      Toast.show('Deleted', 'Supplier deleted', 'success');
      App.navigate('suppliers');
    }
  },

  async renderForm(container, editId = null) {
    let supplier = null;
    if (editId) {
      supplier = await LoyDB.get('suppliers', editId);
      if (!supplier) { App.navigate('suppliers'); return; }
    }
    const isEdit = !!supplier;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">${isEdit ? 'Edit' : 'Add'} Supplier</h1></div>
        <div class="page-header-right"><button class="btn btn-outline" onclick="App.navigate('suppliers')">← Back</button></div>
      </div>
      <form id="supplier-form" onsubmit="SuppliersModule.saveSupplier(event, ${editId || 'null'})" class="animate-fadeInUp">
        <div class="card mb-6">
          <div class="card-header"><h4>🏭 Supplier Information</h4></div>
          <div class="card-body">
            <div class="product-form-grid">
              <div class="form-group"><label class="form-label">Name <span class="required">*</span></label><input type="text" class="form-control" name="name" value="${supplier?.name || ''}" required></div>
              <div class="form-group"><label class="form-label">Contact Person</label><input type="text" class="form-control" name="contact" value="${supplier?.contact || ''}"></div>
              <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" name="phone" value="${supplier?.phone || ''}"></div>
              <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${supplier?.email || ''}"></div>
              <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-control" name="gst" value="${supplier?.gst || ''}"></div>
              <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-control" name="address" value="${supplier?.address || ''}"></div>
              <div class="form-group"><label class="form-label">City</label><input type="text" class="form-control" name="city" value="${supplier?.city || ''}"></div>
              <div class="form-group"><label class="form-label">State</label><input type="text" class="form-control" name="state" value="${supplier?.state || ''}"></div>
              <div class="form-group"><label class="form-label">Opening Balance</label><input type="number" class="form-control" name="balance" value="${supplier?.balance || 0}" step="0.01"></div>
              <div class="form-group"><label class="form-label">Status</label>
                <select class="form-control" name="status">
                  <option value="active" ${supplier?.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="inactive" ${supplier?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="d-flex gap-3 justify-end">
          <button type="button" class="btn btn-outline" onclick="App.navigate('suppliers')">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '💾 Update' : '➕ Add'} Supplier</button>
        </div>
      </form>
    `;
  },

  async saveSupplier(e, editId) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.balance = parseFloat(data.balance) || 0;
    try {
      if (editId) {
        const existing = await LoyDB.get('suppliers', editId);
        Object.assign(existing, data);
        await LoyDB.put('suppliers', existing);
        Toast.show('Updated', 'Supplier updated', 'success');
      } else {
        await LoyDB.add('suppliers', data);
        Toast.show('Added', 'Supplier added', 'success');
      }
      App.navigate('suppliers');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  },

  async renderDetail(container, id) {
    const supplier = await LoyDB.get('suppliers', id);
    if (!supplier) { App.navigate('suppliers'); return; }
    const purchases = (await LoyDB.getAll('purchases')).filter(p => p.supplier_id === id);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">${Utils.escapeHtml(supplier.name)}</h1><p class="page-subtitle">${supplier.city || ''}, ${supplier.state || ''}</p></div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('suppliers')">← Back</button>
          ${Auth.canUpdate() ? `<button class="btn btn-primary" onclick="App.navigate('suppliers/edit/${id}')">✏️ Edit</button>` : ''}
        </div>
      </div>
      <div class="two-column-layout animate-fadeInUp">
        <div class="card">
          <div class="card-header"><h4>🏭 Supplier Details</h4></div>
          <div class="card-body">
            <table class="data-table"><tbody>
              <tr><td class="text-secondary">Contact</td><td>${supplier.contact || '-'}</td></tr>
              <tr><td class="text-secondary">Phone</td><td>${supplier.phone || '-'}</td></tr>
              <tr><td class="text-secondary">Email</td><td>${supplier.email || '-'}</td></tr>
              <tr><td class="text-secondary">GSTIN</td><td class="font-mono">${supplier.gst || '-'}</td></tr>
              <tr><td class="text-secondary">Address</td><td>${supplier.address || '-'}</td></tr>
              <tr><td class="text-secondary">Balance</td><td class="font-bold ${supplier.balance > 0 ? 'text-danger' : 'text-success'}">${Utils.currency(supplier.balance)}</td></tr>
              <tr><td class="text-secondary">Status</td><td>${Utils.statusBadge(supplier.status)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h4>🛍️ Purchase History (${purchases.length})</h4></div>
          <div class="card-body p-0">
            <table class="data-table"><thead><tr><th>PO No.</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>
              ${purchases.length === 0 ? '<tr><td colspan="4" class="text-center text-secondary p-4">No purchases yet</td></tr>' :
                purchases.sort((a,b) => new Date(b.date) - new Date(a.date)).map(p => `
                  <tr style="cursor:pointer" onclick="App.navigate('purchases/view/${p.id}')">
                    <td class="font-mono">${p.po_number}</td><td>${Utils.formatDate(p.date)}</td>
                    <td class="font-semibold">${Utils.currency(p.total)}</td><td>${Utils.statusBadge(p.status)}</td>
                  </tr>`).join('')}
            </tbody></table>
          </div>
        </div>
      </div>
    `;
  }
};
