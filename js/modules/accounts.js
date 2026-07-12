/* ============================================
   ACCOUNTS MODULE
   Income/Expense tracking
   ============================================ */

const AccountsModule = {
  async render(container, subpage) {
    if (subpage === 'add') return this.renderForm(container);
    return this.renderList(container);
  },

  async renderList(container) {
    const accounts = await LoyDB.getAll('accounts');
    const filtered = Auth.filterByBranch(accounts);
    const income = filtered.filter(a => a.type === 'income');
    const expenses = filtered.filter(a => a.type === 'expense');
    const totalIncome = Utils.sumBy(income, 'amount');
    const totalExpense = Utils.sumBy(expenses, 'amount');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Accounts</h1>
          <p class="page-subtitle">Income & Expense Management</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="App.navigate('accounts/add')">➕ Add Entry</button>` : ''}
        </div>
      </div>

      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(3,1fr); margin-bottom: 24px;">
        <div class="stat-card green">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">📈</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Total Income</div>
              <div class="stat-card-value">${Utils.currency(totalIncome)}</div>
            </div>
          </div>
        </div>
        <div class="stat-card red">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">📉</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Total Expenses</div>
              <div class="stat-card-value">${Utils.currency(totalExpense)}</div>
            </div>
          </div>
        </div>
        <div class="stat-card ${totalIncome - totalExpense >= 0 ? 'blue' : 'orange'}">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">💰</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Net Balance</div>
              <div class="stat-card-value">${Utils.currency(totalIncome - totalExpense)}</div>
            </div>
          </div>
        </div>
      </div>

      <div id="accounts-table" class="animate-fadeInUp stagger-2"></div>
    `;

    document.getElementById('accounts-table').innerHTML = DataTable.render({
      id: 'acc-tbl',
      columns: [
        { key: 'date', label: 'Date', render: (row) => Utils.formatDate(row.date) },
        { key: 'type', label: 'Type', render: (row) => `<span class="badge ${row.type === 'income' ? 'badge-success' : 'badge-danger'}">${Utils.capitalize(row.type)}</span>` },
        { key: 'category', label: 'Category', render: (row) => `<span class="tag">${row.category}</span>` },
        { key: 'description', label: 'Description', render: (row) => Utils.escapeHtml(row.description) },
        { key: 'payment_mode', label: 'Payment', render: (row) => Utils.paymentBadge(row.payment_mode) },
        { key: 'amount', label: 'Amount', render: (row) => `<span class="font-bold ${row.type === 'income' ? 'text-success' : 'text-danger'}">${row.type === 'expense' ? '-' : '+'}${Utils.currency(row.amount)}</span>` },
      ],
      data: filtered.sort((a, b) => new Date(b.date) - new Date(a.date)),
      searchable: true,
      searchKeys: ['category', 'description', 'reference'],
      pagination: true,
      perPage: 15,
      emptyMessage: 'No entries found',
      emptyIcon: '📒',
      actions: [
        ...(Auth.canUpdate() ? [{ icon: '✏️', title: 'Edit', class: 'edit', onclick: 'AccountsModule.editEntry' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'AccountsModule.deleteEntry' }] : []),
      ],
    });
  },

  editEntry(id) {
    // Quick modal edit
    AccountsModule.showEditModal(id);
  },

  async showEditModal(id) {
    const entry = await LoyDB.get('accounts', id);
    if (!entry) return;

    const body = `
      <form id="edit-acc-form">
        <div class="form-group"><label class="form-label">Type</label>
          <select class="form-control" name="type"><option value="income" ${entry.type === 'income' ? 'selected' : ''}>Income</option><option value="expense" ${entry.type === 'expense' ? 'selected' : ''}>Expense</option></select>
        </div>
        <div class="form-group"><label class="form-label">Category</label><input type="text" class="form-control" name="category" value="${Utils.escapeHtml(entry.category)}" required></div>
        <div class="form-group"><label class="form-label">Amount</label><input type="number" class="form-control" name="amount" value="${entry.amount}" required min="0" step="0.01"></div>
        <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" name="description" rows="2">${Utils.escapeHtml(entry.description)}</textarea></div>
        <div class="form-group"><label class="form-label">Payment Mode</label>
          <select class="form-control" name="payment_mode">
            ${['cash', 'upi', 'card', 'bank_transfer'].map(m => `<option value="${m}" ${entry.payment_mode === m ? 'selected' : ''}>${Utils.capitalize(m.replace('_', ' '))}</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    Modal.show('Edit Entry', body, 'md', `
      <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="AccountsModule.saveEdit(${id})">Save</button>
    `);
  },

  async saveEdit(id) {
    const form = document.getElementById('edit-acc-form');
    const data = Object.fromEntries(new FormData(form));
    data.amount = parseFloat(data.amount) || 0;
    const entry = await LoyDB.get('accounts', id);
    Object.assign(entry, data);
    await LoyDB.put('accounts', entry);
    Modal.close();
    Toast.show('Updated', 'Entry updated', 'success');
    App.navigate('accounts');
  },

  async deleteEntry(id) {
    const confirmed = await Modal.confirm('Delete Entry', 'Delete this account entry?', 'danger');
    if (confirmed) {
      await LoyDB.delete('accounts', id);
      Toast.show('Deleted', 'Entry deleted', 'success');
      App.navigate('accounts');
    }
  },

  async renderForm(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">Add Account Entry</h1></div>
        <div class="page-header-right"><button class="btn btn-outline" onclick="App.navigate('accounts')">← Back</button></div>
      </div>
      <form id="acc-form" onsubmit="AccountsModule.saveEntry(event)" class="animate-fadeInUp">
        <div class="card mb-6">
          <div class="card-header"><h4>📒 Entry Details</h4></div>
          <div class="card-body">
            <div class="product-form-grid">
              <div class="form-group"><label class="form-label">Type <span class="required">*</span></label>
                <select class="form-control" name="type" required><option value="income">Income</option><option value="expense">Expense</option></select>
              </div>
              <div class="form-group"><label class="form-label">Category <span class="required">*</span></label>
                <input type="text" class="form-control" name="category" required list="cat-list" placeholder="e.g., Store Sales, Electricity">
                <datalist id="cat-list"><option value="Store Sales"><option value="Donation"><option value="Electricity"><option value="Salary"><option value="Transport"><option value="Maintenance"><option value="Stationery"><option value="Other"></datalist>
              </div>
              <div class="form-group"><label class="form-label">Amount <span class="required">*</span></label><input type="number" class="form-control" name="amount" required min="0" step="0.01"></div>
              <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-control" name="date" value="${Utils.today()}"></div>
              <div class="form-group"><label class="form-label">Payment Mode</label>
                <select class="form-control" name="payment_mode">
                  ${['cash', 'upi', 'card', 'bank_transfer'].map(m => `<option value="${m}">${Utils.capitalize(m.replace('_', ' '))}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label class="form-label">Reference</label><input type="text" class="form-control" name="reference" placeholder="Reference / Receipt No."></div>
            </div>
            <div class="form-group mt-4"><label class="form-label">Description</label><textarea class="form-control" name="description" rows="2"></textarea></div>
          </div>
        </div>
        <div class="d-flex gap-3 justify-end">
          <button type="button" class="btn btn-outline" onclick="App.navigate('accounts')">Cancel</button>
          <button type="submit" class="btn btn-primary">➕ Add Entry</button>
        </div>
      </form>
    `;
  },

  async saveEntry(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.amount = parseFloat(data.amount) || 0;
    data.date = new Date(data.date).toISOString();
    data.branch_id = App.activeBranch || 1;
    try {
      await LoyDB.add('accounts', data);
      Toast.show('Added', 'Account entry added', 'success');
      App.navigate('accounts');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  }
};
