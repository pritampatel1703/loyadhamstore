/* ============================================
   INTERNAL ISSUES MODULE
   Track items issued internally (temple, kitchen, etc.)
   ============================================ */

const InternalIssuesModule = {
  async render(container) {
    const issues = await LoyDB.getAll('internal_issues');
    const filtered = Auth.filterByBranch(issues);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Internal Issues</h1>
          <p class="page-subtitle">Track items issued to temple departments</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="InternalIssuesModule.showForm()">➕ New Issue</button>` : ''}
        </div>
      </div>
      <div id="issues-table" class="animate-fadeInUp"></div>
    `;

    document.getElementById('issues-table').innerHTML = DataTable.render({
      id: 'iss-tbl',
      columns: [
        { key: 'date', label: 'Date', render: (row) => Utils.formatDate(row.date) },
        { key: 'product_name', label: 'Product', render: (row) => `<span class="font-semibold">${Utils.escapeHtml(row.product_name)}</span>` },
        { key: 'quantity', label: 'Qty', render: (row) => `<span class="font-bold">${row.quantity}</span>` },
        { key: 'department', label: 'Department', render: (row) => `<span class="tag">${Utils.escapeHtml(row.department)}</span>` },
        { key: 'requested_by', label: 'Requested By', render: (row) => Utils.escapeHtml(row.requested_by) },
        { key: 'purpose', label: 'Purpose', render: (row) => Utils.escapeHtml(row.purpose) },
        { key: 'status', label: 'Status', render: (row) => Utils.statusBadge(row.status) },
      ],
      data: filtered.sort((a, b) => new Date(b.date) - new Date(a.date)),
      searchable: true,
      searchKeys: ['product_name', 'department', 'requested_by', 'purpose'],
      pagination: true,
      perPage: 15,
      emptyMessage: 'No internal issues found',
      emptyIcon: '📋',
      actions: [
        ...(Auth.canApprove() ? [{ icon: '✅', title: 'Approve', class: 'edit', onclick: 'InternalIssuesModule.approveIssue' }] : []),
        ...(Auth.canUpdate() ? [{ icon: '📦', title: 'Mark Issued', class: 'view', onclick: 'InternalIssuesModule.markIssued' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'InternalIssuesModule.deleteIssue' }] : []),
      ],
    });
  },

  async approveIssue(id) {
    const issue = await LoyDB.get('internal_issues', id);
    if (!issue || issue.status !== 'pending') {
      Toast.show('Info', 'Only pending issues can be approved', 'info');
      return;
    }
    issue.status = 'approved';
    issue.approved_by = Auth.getUser().name;
    await LoyDB.put('internal_issues', issue);
    Toast.show('Approved', 'Issue approved', 'success');
    App.navigate('internal_issues');
  },

  async markIssued(id) {
    const issue = await LoyDB.get('internal_issues', id);
    if (!issue || issue.status === 'issued') {
      Toast.show('Info', 'Already issued', 'info');
      return;
    }
    issue.status = 'issued';
    await LoyDB.put('internal_issues', issue);

    // Deduct stock
    const product = await LoyDB.get('products', issue.product_id);
    if (product) {
      product.current_stock = Math.max(0, product.current_stock - issue.quantity);
      await LoyDB.put('products', product);
    }

    await Auth.logActivity('internal_issue', `Issued ${issue.quantity} x ${issue.product_name} to ${issue.department}`);
    Toast.show('Issued', 'Items marked as issued & stock deducted', 'success');
    App.navigate('internal_issues');
  },

  async deleteIssue(id) {
    const confirmed = await Modal.confirm('Delete Issue', 'Delete this internal issue?', 'danger');
    if (confirmed) {
      await LoyDB.delete('internal_issues', id);
      Toast.show('Deleted', 'Issue deleted', 'success');
      App.navigate('internal_issues');
    }
  },

  async showForm() {
    const products = await LoyDB.getAll('products');

    const body = `
      <form id="issue-form">
        <div class="form-group"><label class="form-label">Product <span class="required">*</span></label>
          <select class="form-control" name="product_id" required id="issue-product">
            ${products.filter(p => p.status === 'active').map(p => `<option value="${p.id}" data-name="${Utils.escapeHtml(p.name)}">${Utils.escapeHtml(p.name)} (Stock: ${p.current_stock})</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Quantity <span class="required">*</span></label><input type="number" class="form-control" name="quantity" required min="1" value="1"></div>
        <div class="form-group"><label class="form-label">Department <span class="required">*</span></label>
          <select class="form-control" name="department" required>
            <option value="Temple">Temple</option><option value="Kitchen">Kitchen</option><option value="Guest House">Guest House</option>
            <option value="Office">Office</option><option value="Hostel">Hostel</option><option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Requested By <span class="required">*</span></label><input type="text" class="form-control" name="requested_by" required></div>
        <div class="form-group"><label class="form-label">Purpose</label><input type="text" class="form-control" name="purpose" placeholder="e.g., Daily Aarti, Sunday Sabha"></div>
      </form>
    `;

    Modal.show('New Internal Issue', body, 'md', `
      <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="InternalIssuesModule.saveIssue()">Create Issue</button>
    `);
  },

  async saveIssue() {
    const form = document.getElementById('issue-form');
    const data = Object.fromEntries(new FormData(form));
    const productSelect = document.getElementById('issue-product');

    data.product_id = parseInt(data.product_id);
    data.product_name = productSelect.options[productSelect.selectedIndex].dataset.name;
    data.quantity = parseInt(data.quantity) || 0;
    data.date = new Date().toISOString();
    data.status = 'pending';
    data.approved_by = '';
    data.branch_id = App.activeBranch || 1;

    try {
      await LoyDB.add('internal_issues', data);
      Toast.show('Created', 'Internal issue created', 'success');
      Modal.close();
      App.navigate('internal_issues');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  }
};
