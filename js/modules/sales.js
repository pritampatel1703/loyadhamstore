/* ============================================
   SALES MODULE
   View and manage past invoices
   ============================================ */

const SalesModule = {
  async render(container, subpage, id) {
    if (subpage === 'view' && id) return this.renderDetail(container, parseInt(id));
    return this.renderList(container);
  },

  async renderList(container) {
    const sales = await LoyDB.getAll('sales');
    const filtered = Auth.filterByBranch(sales);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Sales History</h1>
          <p class="page-subtitle">View and manage past invoices</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? '<button class="btn btn-primary" onclick="App.navigate(\'pos\')">🛒 New Sale (POS)</button>' : ''}
          ${Auth.canExport() ? '<button class="btn btn-outline" onclick="SalesModule.exportExcel()">📥 Export</button>' : ''}
        </div>
      </div>

      <div class="card mb-6 animate-fadeInUp">
        <div class="card-body">
          <div class="inventory-filters">
            <div class="data-table-search" style="max-width:280px">
              <span class="search-icon">🔍</span>
              <input type="text" class="form-control" placeholder="Search Invoice No..." id="sales-search" oninput="SalesModule.filterSales()" style="padding-left:36px">
            </div>
            <select class="form-control filter-select" id="sales-date-filter" onchange="SalesModule.filterSales()">
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
            <select class="form-control filter-select" id="sales-payment-filter" onchange="SalesModule.filterSales()">
              <option value="">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>
      </div>

      <div id="sales-table" class="animate-fadeInUp stagger-2"></div>
    `;

    this.allSales = filtered;
    this.renderTable(filtered);
  },

  renderTable(sales) {
    const tableContainer = document.getElementById('sales-table');
    if (!tableContainer) return;

    // Sort by date descending
    sales.sort((a, b) => new Date(b.date) - new Date(a.date));

    tableContainer.innerHTML = DataTable.render({
      id: 'sales-tbl',
      columns: [
        { key: 'invoice_no', label: 'Invoice No.', render: (row) => '<span class="font-mono font-semibold">' + row.invoice_no + '</span>' },
        { key: 'date', label: 'Date & Time', render: (row) => Utils.formatDate(row.date, 'full') },
        { key: 'customer', label: 'Customer', render: (row) => row.customer_id ? 'Customer ID: ' + row.customer_id : '<span class="text-secondary">Walk-in Customer</span>' },
        { key: 'payment_method', label: 'Payment', render: (row) => Utils.paymentBadge(row.payment_method) },
        { key: 'total', label: 'Total Amount', render: (row) => '<span class="font-bold text-primary">' + Utils.currency(row.total) + '</span>' },
      ],
      data: sales,
      searchable: false, // Handled custom
      pagination: true,
      perPage: 15,
      emptyMessage: 'No sales found',
      emptyIcon: '🧾',
      actions: [
        { icon: '👁️', title: 'View Invoice', class: 'view', onclick: 'SalesModule.viewSale' },
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'SalesModule.deleteSale' }] : []),
      ],
    });
  },

  filterSales() {
    const search = document.getElementById('sales-search')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('sales-date-filter')?.value || '';
    const payment = document.getElementById('sales-payment-filter')?.value || '';

    let filtered = [...this.allSales];

    if (search) {
      filtered = filtered.filter(s => s.invoice_no.toLowerCase().includes(search));
    }

    if (payment) {
      filtered = filtered.filter(s => s.payment_method === payment);
    }

    if (dateFilter) {
      const today = new Date();
      filtered = filtered.filter(s => {
        const d = new Date(s.date);
        switch (dateFilter) {
          case 'today': return Utils.isToday(s.date);
          case 'yesterday': {
            const y = new Date(); y.setDate(y.getDate() - 1);
            return d.toDateString() === y.toDateString();
          }
          case 'this_week': {
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            return d >= weekAgo;
          }
          case 'this_month': return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
          default: return true;
        }
      });
    }

    this.renderTable(filtered);
  },

  viewSale(id) {
    App.navigate('sales/view/' + id);
  },

  async deleteSale(id) {
    const confirmed = await Modal.confirm('Delete Sale', 'Are you sure you want to delete this sale? This will NOT restore stock automatically.', 'danger');
    if (confirmed) {
      // Find sale items to delete as well
      const items = await LoyDB.getAll('sale_items');
      const saleItems = items.filter(i => i.sale_id === id);
      
      for (const item of saleItems) {
        await LoyDB.delete('sale_items', item.id);
      }
      
      await LoyDB.delete('sales', id);
      await Auth.logActivity('sale', 'Sale ID ' + id + ' deleted');
      Toast.show('Deleted', 'Sale record deleted successfully', 'success');
      App.navigate('sales');
    }
  },

  async renderDetail(container, id) {
    const sale = await LoyDB.get('sales', id);
    if (!sale) { App.navigate('sales'); return; }

    const items = await LoyDB.getAll('sale_items');
    const saleItems = items.filter(i => i.sale_id === id);
    
    // Fetch products for names
    const products = await LoyDB.getAll('products');
    saleItems.forEach(item => {
      const p = products.find(p => p.id === item.product_id);
      item.product = p;
    });

    let customerName = 'Walk-in Customer';
    if (sale.customer_id) {
      const cust = await LoyDB.get('customers', sale.customer_id);
      if (cust) customerName = cust.name;
    }

    const branchObj = await LoyDB.get('branches', sale.branch_id);
    const branchName = branchObj ? branchObj.name : 'Main Branch';

    // Build sale items rows
    let itemRows = '';
    saleItems.forEach(item => {
      itemRows += '<tr>'
        + '<td style="text-align:left">' + (item.product ? Utils.escapeHtml(item.product.name) : 'Unknown Product') + '</td>'
        + '<td style="text-align:right">' + item.qty + '</td>'
        + '<td style="text-align:right">' + Utils.currency(item.price) + '</td>'
        + '<td style="text-align:right">' + Utils.currency(item.total) + '</td>'
        + '</tr>';
    });

    // Build discount row
    const discountRow = sale.discount > 0
      ? '<div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--danger)"><span>Discount:</span><span>-' + Utils.currency(sale.discount) + '</span></div>'
      : '';

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Invoice: ${sale.invoice_no}</h1>
          <p class="page-subtitle">${Utils.formatDate(sale.date, 'full')}</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('sales')">← Back</button>
          <button class="btn btn-primary" onclick="window.print()">🖨️ Print Invoice</button>
        </div>
      </div>

      <div class="animate-fadeInUp">
        <div class="invoice-preview" id="printable-invoice">
          <div class="invoice-header">
            <div class="invoice-org-name">Loyadham Store</div>
            <div class="invoice-branch">${Utils.escapeHtml(branchName)}</div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">GSTIN: 24XXXXX1234X1ZX</div>
          </div>
          
          <div class="invoice-meta">
            <div>
              <strong>Invoice No:</strong> <br>${sale.invoice_no}<br>
              <strong>Date:</strong> <br>${new Date(sale.date).toLocaleDateString('en-IN')} ${new Date(sale.date).toLocaleTimeString('en-IN')}
            </div>
            <div style="text-align:right">
              <strong>Customer:</strong> <br>${Utils.escapeHtml(customerName)}<br>
              <strong>Cashier:</strong> <br>${Utils.escapeHtml(sale.user)}
            </div>
          </div>
          
          <table class="invoice-items" cellspacing="0">
            <thead>
              <tr>
                <th style="text-align:left">Item</th>
                <th style="text-align:right">Qty</th>
                <th style="text-align:right">Price</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
          
          <div class="invoice-totals">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Subtotal:</span>
              <span>${Utils.currency(sale.subtotal)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>GST:</span>
              <span>${Utils.currency(sale.gst_total)}</span>
            </div>
            ${discountRow}
            <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid #ddd; font-weight:bold; font-size:16px;">
              <span>Total:</span>
              <span>${Utils.currency(sale.total)}</span>
            </div>
          </div>
          
          <div style="text-align:center; margin-top:16px; font-weight:bold;">
            Payment: ${Utils.paymentBadge(sale.payment_method)}
          </div>
          
          <div class="invoice-footer">
            Thank you for shopping with us!<br>
            🙏 Jay Swaminarayan 🙏
          </div>
        </div>
      </div>
      
      <!-- Print Styles -->
      <style>
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; border: none; box-shadow: none; }
          .app-layout { display: block; }
          .sidebar, .header { display: none; }
        }
      </style>
    `;
  },

  async exportExcel() {
    const sales = this.allSales || [];
    let csv = 'Invoice No,Date,Customer ID,Branch ID,User,Subtotal,GST,Discount,Total,Payment Method,Status\n';
    
    sales.forEach(s => {
      csv += s.invoice_no + ',' + s.date + ',' + (s.customer_id || '') + ',' + s.branch_id + ',' + s.user + ',' + s.subtotal + ',' + s.gst_total + ',' + s.discount + ',' + s.total + ',' + s.payment_method + ',' + s.status + '\n';
    });

    Utils.downloadFile(csv, 'sales_export_' + Utils.today() + '.csv', 'text/csv');
    Toast.show('Exported', 'Sales data exported as CSV', 'success');
  }
};
