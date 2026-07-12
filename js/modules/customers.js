/* ============================================
   CUSTOMERS MODULE
   ============================================ */

const CustomersModule = {
  async render(container, subpage, id) {
    if (subpage === 'add') return this.renderForm(container);
    if (subpage === 'edit' && id) return this.renderForm(container, parseInt(id));
    if (subpage === 'view' && id) return this.renderDetail(container, parseInt(id));
    return this.renderList(container);
  },

  async renderList(container) {
    const customers = await LoyDB.getAll('customers');
    const filtered = Auth.filterByBranch(customers);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Customers</h1>
          <p class="page-subtitle">${filtered.length} customers registered</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="App.navigate('customers/add')">➕ Add Customer</button>` : ''}
        </div>
      </div>
      <div id="customers-table" class="animate-fadeInUp"></div>
    `;

    document.getElementById('customers-table').innerHTML = DataTable.render({
      id: 'cust-tbl',
      columns: [
        { key: 'name', label: 'Customer', render: (row) => `<div class="font-semibold">${Utils.escapeHtml(row.name)}</div>` },
        { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
        { key: 'city', label: 'City', render: (row) => row.city || '-' },
        { key: 'loyalty_points', label: 'Points', render: (row) => `<span class="font-semibold text-primary">${row.loyalty_points || 0}</span>` },
        { key: 'balance', label: 'Balance', render: (row) => `<span class="${row.balance > 0 ? 'text-danger font-semibold' : ''}">${Utils.currency(row.balance)}</span>` },
      ],
      data: filtered,
      searchable: true,
      searchKeys: ['name', 'phone', 'city'],
      pagination: true,
      perPage: 15,
      emptyMessage: 'No customers found',
      emptyIcon: '👥',
      actions: [
        { icon: '👁️', title: 'View', class: 'view', onclick: 'CustomersModule.viewCustomer' },
        ...(Auth.canUpdate() ? [{ icon: '✏️', title: 'Edit', class: 'edit', onclick: 'CustomersModule.editCustomer' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'CustomersModule.deleteCustomer' }] : []),
      ],
    });
  },

  viewCustomer(id) { App.navigate(`customers/view/${id}`); },
  editCustomer(id) { App.navigate(`customers/edit/${id}`); },

  async deleteCustomer(id) {
    const confirmed = await Modal.confirm('Delete Customer', 'Are you sure?', 'danger');
    if (confirmed) {
      await LoyDB.delete('customers', id);
      Toast.show('Deleted', 'Customer deleted', 'success');
      App.navigate('customers');
    }
  },

  async renderForm(container, editId = null) {
    let customer = null;
    if (editId) {
      customer = await LoyDB.get('customers', editId);
      if (!customer) { App.navigate('customers'); return; }
    }
    const isEdit = !!customer;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">${isEdit ? 'Edit' : 'Add'} Customer</h1></div>
        <div class="page-header-right"><button class="btn btn-outline" onclick="App.navigate('customers')">← Back</button></div>
      </div>
      <form id="customer-form" onsubmit="CustomersModule.saveCustomer(event, ${editId || 'null'})" class="animate-fadeInUp">
        <div class="card mb-6">
          <div class="card-header"><h4>👤 Customer Information</h4></div>
          <div class="card-body">
            <div class="product-form-grid">
              <div class="form-group"><label class="form-label">Name <span class="required">*</span></label><input type="text" class="form-control" name="name" value="${customer?.name || ''}" required></div>
              <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" name="phone" value="${customer?.phone || ''}"></div>
              <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-control" name="address" value="${customer?.address || ''}"></div>
              <div class="form-group"><label class="form-label">City</label><input type="text" class="form-control" name="city" value="${customer?.city || ''}"></div>
              <div class="form-group"><label class="form-label">State</label><input type="text" class="form-control" name="state" value="${customer?.state || 'Gujarat'}"></div>
              <div class="form-group"><label class="form-label">Opening Balance</label><input type="number" class="form-control" name="balance" value="${customer?.balance || 0}" step="0.01"></div>
              <div class="form-group"><label class="form-label">Loyalty Points</label><input type="number" class="form-control" name="loyalty_points" value="${customer?.loyalty_points || 0}" min="0"></div>
            </div>
            <div class="form-group mt-4"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="2">${customer?.notes || ''}</textarea></div>
          </div>
        </div>
        <div class="d-flex gap-3 justify-end">
          <button type="button" class="btn btn-outline" onclick="App.navigate('customers')">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '💾 Update' : '➕ Add'} Customer</button>
        </div>
      </form>
    `;
  },

  async saveCustomer(e, editId) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.balance = parseFloat(data.balance) || 0;
    data.loyalty_points = parseInt(data.loyalty_points) || 0;
    data.branch_id = App.activeBranch || 1;
    try {
      if (editId) {
        const existing = await LoyDB.get('customers', editId);
        Object.assign(existing, data);
        await LoyDB.put('customers', existing);
        Toast.show('Updated', 'Customer updated', 'success');
      } else {
        await LoyDB.add('customers', data);
        Toast.show('Added', 'Customer added', 'success');
      }
      App.navigate('customers');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  },

  async renderDetail(container, id) {
    const customer = await LoyDB.get('customers', id);
    if (!customer) { App.navigate('customers'); return; }
    const sales = (await LoyDB.getAll('sales')).filter(s => s.customer_id === id);
    const totalSpent = Utils.sumBy(sales, 'total');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">${Utils.escapeHtml(customer.name)}</h1><p class="page-subtitle">${customer.city || ''}, ${customer.state || ''}</p></div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('customers')">← Back</button>
          ${Auth.canUpdate() ? `<button class="btn btn-primary" onclick="App.navigate('customers/edit/${id}')">✏️ Edit</button>` : ''}
        </div>
      </div>
      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(3,1fr); margin-bottom:24px;">
        <div class="stat-card saffron"><div class="d-flex items-center gap-4"><div class="stat-card-icon">💰</div><div class="stat-card-content"><div class="stat-card-label">Total Spent</div><div class="stat-card-value">${Utils.currency(totalSpent)}</div></div></div></div>
        <div class="stat-card blue"><div class="d-flex items-center gap-4"><div class="stat-card-icon">🧾</div><div class="stat-card-content"><div class="stat-card-label">Total Orders</div><div class="stat-card-value">${sales.length}</div></div></div></div>
        <div class="stat-card purple"><div class="d-flex items-center gap-4"><div class="stat-card-icon">⭐</div><div class="stat-card-content"><div class="stat-card-label">Loyalty Points</div><div class="stat-card-value">${customer.loyalty_points || 0}</div></div></div></div>
      </div>
      <div class="two-column-layout animate-fadeInUp stagger-2">
        <div class="card">
          <div class="card-header"><h4>👤 Details</h4></div>
          <div class="card-body">
            <table class="data-table"><tbody>
              <tr><td class="text-secondary">Phone</td><td>${customer.phone || '-'}</td></tr>
              <tr><td class="text-secondary">Address</td><td>${customer.address || '-'}</td></tr>
              <tr><td class="text-secondary">City</td><td>${customer.city || '-'}</td></tr>
              <tr><td class="text-secondary">Balance</td><td class="${customer.balance > 0 ? 'text-danger font-semibold' : ''}">${Utils.currency(customer.balance)}</td></tr>
              <tr><td class="text-secondary">Notes</td><td>${customer.notes || '-'}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h4>🧾 Purchase History</h4></div>
          <div class="card-body p-0">
            <table class="data-table"><thead><tr><th>Invoice</th><th>Date</th><th>Amount</th></tr></thead><tbody>
              ${sales.length === 0 ? '<tr><td colspan="3" class="text-center text-secondary p-4">No purchases yet</td></tr>' :
                sales.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(s => `
                  <tr><td class="font-mono">${s.invoice_no}</td><td>${Utils.formatDate(s.date)}</td><td class="font-semibold">${Utils.currency(s.total)}</td></tr>
                `).join('')}
            </tbody></table>
          </div>
        </div>
      </div>
    `;
  }
};
