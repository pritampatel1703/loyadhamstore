/* ============================================
   STOCK TRANSFERS MODULE
   ============================================ */

const TransfersModule = {
  async render(container) {
    const transfers = await LoyDB.getAll('stock_transfers');
    const branches = await LoyDB.getAll('branches');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Stock Transfers</h1>
          <p class="page-subtitle">Transfer stock between branches</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="TransfersModule.showForm()">➕ New Transfer</button>` : ''}
        </div>
      </div>

      <div id="transfers-table" class="animate-fadeInUp"></div>
    `;

    document.getElementById('transfers-table').innerHTML = DataTable.render({
      id: 'trf-tbl',
      columns: [
        { key: 'transfer_no', label: 'Transfer No.', render: (row) => `<span class="font-mono font-semibold">${row.transfer_no}</span>` },
        { key: 'date', label: 'Date', render: (row) => Utils.formatDate(row.date) },
        { key: 'from_branch', label: 'From', render: (row) => { const b = branches.find(x => x.id === row.from_branch); return b ? Utils.escapeHtml(b.name) : '-'; }},
        { key: 'to_branch', label: 'To', render: (row) => { const b = branches.find(x => x.id === row.to_branch); return b ? Utils.escapeHtml(b.name) : '-'; }},
        { key: 'items', label: 'Items', render: (row) => `${(row.items || []).length} items` },
        { key: 'status', label: 'Status', render: (row) => Utils.statusBadge(row.status) },
      ],
      data: transfers.sort((a, b) => new Date(b.date) - new Date(a.date)),
      pagination: true,
      perPage: 15,
      emptyMessage: 'No stock transfers found',
      emptyIcon: '🔄',
      actions: [
        { icon: '👁️', title: 'View', class: 'view', onclick: 'TransfersModule.viewTransfer' },
        ...(Auth.canApprove() ? [{ icon: '✅', title: 'Approve', class: 'edit', onclick: 'TransfersModule.approveTransfer' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'TransfersModule.deleteTransfer' }] : []),
      ],
    });
  },

  async viewTransfer(id) {
    const transfer = await LoyDB.get('stock_transfers', id);
    if (!transfer) return;
    const branches = await LoyDB.getAll('branches');
    const from = branches.find(b => b.id === transfer.from_branch);
    const to = branches.find(b => b.id === transfer.to_branch);

    const body = `
      <table class="data-table"><tbody>
        <tr><td class="text-secondary">Transfer No.</td><td class="font-mono font-semibold">${transfer.transfer_no}</td></tr>
        <tr><td class="text-secondary">Date</td><td>${Utils.formatDate(transfer.date, 'full')}</td></tr>
        <tr><td class="text-secondary">From</td><td>${from ? Utils.escapeHtml(from.name) : '-'}</td></tr>
        <tr><td class="text-secondary">To</td><td>${to ? Utils.escapeHtml(to.name) : '-'}</td></tr>
        <tr><td class="text-secondary">Status</td><td>${Utils.statusBadge(transfer.status)}</td></tr>
        <tr><td class="text-secondary">Requested By</td><td>${transfer.requested_by || '-'}</td></tr>
        <tr><td class="text-secondary">Approved By</td><td>${transfer.approved_by || '-'}</td></tr>
        <tr><td class="text-secondary">Notes</td><td>${transfer.notes || '-'}</td></tr>
      </tbody></table>
      <h4 class="mt-4 mb-2">Items</h4>
      <table class="data-table"><thead><tr><th>Product</th><th>Qty</th></tr></thead><tbody>
        ${(transfer.items || []).map(i => `<tr><td>${Utils.escapeHtml(i.product_name)}</td><td>${i.qty}</td></tr>`).join('')}
      </tbody></table>
    `;
    Modal.show('Transfer Details', body, 'md');
  },

  async approveTransfer(id) {
    const transfer = await LoyDB.get('stock_transfers', id);
    if (!transfer || transfer.status !== 'pending') {
      Toast.show('Info', 'Only pending transfers can be approved', 'info');
      return;
    }
    const confirmed = await Modal.confirm('Approve Transfer', 'Approve this stock transfer?', 'info');
    if (confirmed) {
      transfer.status = 'approved';
      transfer.approved_by = Auth.getUser().name;
      await LoyDB.put('stock_transfers', transfer);
      Toast.show('Approved', 'Transfer approved', 'success');
      App.navigate('transfers');
    }
  },

  async deleteTransfer(id) {
    const confirmed = await Modal.confirm('Delete Transfer', 'Delete this transfer?', 'danger');
    if (confirmed) {
      await LoyDB.delete('stock_transfers', id);
      Toast.show('Deleted', 'Transfer deleted', 'success');
      App.navigate('transfers');
    }
  },

  async showForm() {
    const branches = await LoyDB.getAll('branches');
    const products = await LoyDB.getAll('products');
    const trfCount = (await LoyDB.getAll('stock_transfers')).length;

    const body = `
      <form id="transfer-form">
        <div class="form-group"><label class="form-label">Transfer No.</label><input type="text" class="form-control" name="transfer_no" value="LY-TRF-${String(trfCount + 1).padStart(3, '0')}" readonly style="background:var(--bg-secondary)"></div>
        <div class="form-group"><label class="form-label">From Branch <span class="required">*</span></label>
          <select class="form-control" name="from_branch" required>${branches.map(b => `<option value="${b.id}">${Utils.escapeHtml(b.name)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">To Branch <span class="required">*</span></label>
          <select class="form-control" name="to_branch" required>${branches.map(b => `<option value="${b.id}">${Utils.escapeHtml(b.name)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">Product <span class="required">*</span></label>
          <select class="form-control" id="trf-product">${products.map(p => `<option value="${p.id}" data-name="${Utils.escapeHtml(p.name)}">${Utils.escapeHtml(p.name)} (Stock: ${p.current_stock})</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">Quantity <span class="required">*</span></label><input type="number" class="form-control" id="trf-qty" min="1" value="1"></div>
        <div class="form-group"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="2"></textarea></div>
      </form>
    `;

    Modal.show('New Stock Transfer', body, 'md', `
      <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="TransfersModule.saveTransfer()">Create Transfer</button>
    `);
  },

  async saveTransfer() {
    const form = document.getElementById('transfer-form');
    const data = Object.fromEntries(new FormData(form));
    const productSelect = document.getElementById('trf-product');
    const qty = parseInt(document.getElementById('trf-qty').value) || 0;
    const productName = productSelect.options[productSelect.selectedIndex].dataset.name;

    if (data.from_branch === data.to_branch) {
      Toast.show('Error', 'From and To branches must be different', 'error');
      return;
    }
    if (qty <= 0) {
      Toast.show('Error', 'Enter a valid quantity', 'error');
      return;
    }

    const transfer = {
      transfer_no: data.transfer_no,
      from_branch: parseInt(data.from_branch),
      to_branch: parseInt(data.to_branch),
      date: new Date().toISOString(),
      status: 'pending',
      items: [{ product_id: parseInt(productSelect.value), product_name: productName, qty }],
      requested_by: Auth.getUser().name,
      approved_by: '',
      notes: data.notes || ''
    };

    try {
      await LoyDB.add('stock_transfers', transfer);
      Toast.show('Created', 'Stock transfer created', 'success');
      Modal.close();
      App.navigate('transfers');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  }
};
