/* ============================================
   REPORTS MODULE
   Sales reports, inventory reports, analytics
   ============================================ */

const ReportsModule = {
  async render(container, subpage) {
    if (subpage === 'sales') return this.renderSalesReport(container);
    if (subpage === 'inventory') return this.renderInventoryReport(container);
    if (subpage === 'purchases') return this.renderPurchasesReport(container);
    return this.renderOverview(container);
  },

  async renderOverview(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Reports & Analytics</h1>
          <p class="page-subtitle">View detailed reports</p>
        </div>
      </div>

      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        <div class="card" style="cursor:pointer" onclick="App.navigate('reports/sales')">
          <div class="card-body d-flex items-center gap-4">
            <div style="font-size:40px">📊</div>
            <div>
              <div class="font-semibold text-lg">Sales Report</div>
              <div class="text-sm text-secondary">Daily, weekly, monthly sales analysis</div>
            </div>
          </div>
        </div>
        <div class="card" style="cursor:pointer" onclick="App.navigate('reports/inventory')">
          <div class="card-body d-flex items-center gap-4">
            <div style="font-size:40px">📦</div>
            <div>
              <div class="font-semibold text-lg">Inventory Report</div>
              <div class="text-sm text-secondary">Stock levels, valuation, low stock alerts</div>
            </div>
          </div>
        </div>
        <div class="card" style="cursor:pointer" onclick="App.navigate('reports/purchases')">
          <div class="card-body d-flex items-center gap-4">
            <div style="font-size:40px">🛍️</div>
            <div>
              <div class="font-semibold text-lg">Purchase Report</div>
              <div class="text-sm text-secondary">Supplier-wise purchase analysis</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async renderSalesReport(container) {
    const sales = await LoyDB.getAll('sales');
    const filtered = Auth.filterByBranch(sales);
    const today = new Date();

    const todaySales = filtered.filter(s => Utils.isToday(s.date));
    const thisMonth = filtered.filter(s => { const d = new Date(s.date); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); });
    const lastMonth = filtered.filter(s => { const d = new Date(s.date); const lm = new Date(); lm.setMonth(lm.getMonth() - 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); });

    const todayTotal = Utils.sumBy(todaySales, 'total');
    const monthTotal = Utils.sumBy(thisMonth, 'total');
    const lastMonthTotal = Utils.sumBy(lastMonth, 'total');
    const growth = lastMonthTotal > 0 ? (((monthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : 0;

    // Payment method breakdown
    const paymentBreakdown = {};
    thisMonth.forEach(s => { paymentBreakdown[s.payment_method] = (paymentBreakdown[s.payment_method] || 0) + s.total; });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Sales Report</h1>
          <p class="page-subtitle">Sales analytics and trends</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('reports')">← Back</button>
          ${Auth.canExport() ? `<button class="btn btn-primary" onclick="ReportsModule.exportSalesCSV()">📥 Export</button>` : ''}
        </div>
      </div>

      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(4,1fr); margin-bottom: 24px;">
        <div class="stat-card saffron"><div class="d-flex items-center gap-4"><div class="stat-card-icon">💰</div><div class="stat-card-content"><div class="stat-card-label">Today's Sales</div><div class="stat-card-value">${Utils.currency(todayTotal)}</div><div class="stat-card-trend">${todaySales.length} transactions</div></div></div></div>
        <div class="stat-card maroon"><div class="d-flex items-center gap-4"><div class="stat-card-icon">📊</div><div class="stat-card-content"><div class="stat-card-label">This Month</div><div class="stat-card-value">${Utils.currency(monthTotal)}</div><div class="stat-card-trend">${thisMonth.length} transactions</div></div></div></div>
        <div class="stat-card green"><div class="d-flex items-center gap-4"><div class="stat-card-icon">📈</div><div class="stat-card-content"><div class="stat-card-label">Last Month</div><div class="stat-card-value">${Utils.currency(lastMonthTotal)}</div></div></div></div>
        <div class="stat-card ${growth >= 0 ? 'blue' : 'red'}"><div class="d-flex items-center gap-4"><div class="stat-card-icon">${growth >= 0 ? '📈' : '📉'}</div><div class="stat-card-content"><div class="stat-card-label">Growth</div><div class="stat-card-value">${growth}%</div></div></div></div>
      </div>

      <div class="dashboard-charts animate-fadeInUp stagger-2">
        <div class="card">
          <div class="card-header"><h4>💳 Payment Methods (This Month)</h4></div>
          <div class="card-body">
            <table class="data-table"><thead><tr><th>Method</th><th>Amount</th><th>%</th></tr></thead><tbody>
              ${Object.entries(paymentBreakdown).map(([method, amount]) => `
                <tr><td>${Utils.paymentBadge(method)}</td><td class="font-semibold">${Utils.currency(amount)}</td>
                <td>${monthTotal > 0 ? ((amount / monthTotal) * 100).toFixed(1) : 0}%</td></tr>
              `).join('')}
            </tbody></table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h4>📅 Daily Sales (This Month)</h4></div>
          <div class="card-body">
            <table class="data-table"><thead><tr><th>Date</th><th>Transactions</th><th>Total</th></tr></thead><tbody>
              ${(() => {
                const days = {};
                thisMonth.forEach(s => {
                  const day = new Date(s.date).toLocaleDateString('en-IN');
                  if (!days[day]) days[day] = { count: 0, total: 0 };
                  days[day].count++;
                  days[day].total += s.total;
                });
                return Object.entries(days).sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 15).map(([day, data]) =>
                  `<tr><td>${day}</td><td>${data.count}</td><td class="font-semibold">${Utils.currency(data.total)}</td></tr>`
                ).join('');
              })()}
            </tbody></table>
          </div>
        </div>
      </div>
    `;
  },

  async renderInventoryReport(container) {
    const products = await LoyDB.getAll('products');
    const filtered = Auth.filterByBranch(products);
    const totalValue = filtered.reduce((sum, p) => sum + (p.current_stock * p.purchase_price), 0);
    const sellingValue = filtered.reduce((sum, p) => sum + (p.current_stock * p.selling_price), 0);
    const lowStock = filtered.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock);
    const outOfStock = filtered.filter(p => p.current_stock <= 0);

    // Category-wise breakdown
    const catBreakdown = {};
    filtered.forEach(p => {
      if (!catBreakdown[p.category]) catBreakdown[p.category] = { count: 0, stock: 0, value: 0 };
      catBreakdown[p.category].count++;
      catBreakdown[p.category].stock += p.current_stock;
      catBreakdown[p.category].value += p.current_stock * p.purchase_price;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">Inventory Report</h1></div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('reports')">← Back</button>
          ${Auth.canExport() ? `<button class="btn btn-primary" onclick="InventoryModule.exportExcel()">📥 Export</button>` : ''}
        </div>
      </div>

      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(4,1fr); margin-bottom: 24px;">
        <div class="stat-card blue"><div class="d-flex items-center gap-4"><div class="stat-card-icon">📦</div><div class="stat-card-content"><div class="stat-card-label">Total Products</div><div class="stat-card-value">${filtered.length}</div></div></div></div>
        <div class="stat-card green"><div class="d-flex items-center gap-4"><div class="stat-card-icon">💰</div><div class="stat-card-content"><div class="stat-card-label">Cost Value</div><div class="stat-card-value">${Utils.currency(totalValue)}</div></div></div></div>
        <div class="stat-card orange"><div class="d-flex items-center gap-4"><div class="stat-card-icon">⚠️</div><div class="stat-card-content"><div class="stat-card-label">Low Stock</div><div class="stat-card-value">${lowStock.length}</div></div></div></div>
        <div class="stat-card red"><div class="d-flex items-center gap-4"><div class="stat-card-icon">🚫</div><div class="stat-card-content"><div class="stat-card-label">Out of Stock</div><div class="stat-card-value">${outOfStock.length}</div></div></div></div>
      </div>

      <div class="dashboard-charts animate-fadeInUp stagger-2">
        <div class="card">
          <div class="card-header"><h4>🏷️ Category Breakdown</h4></div>
          <div class="card-body p-0">
            <table class="data-table"><thead><tr><th>Category</th><th>Products</th><th>Stock</th><th>Value</th></tr></thead><tbody>
              ${Object.entries(catBreakdown).sort((a, b) => b[1].value - a[1].value).map(([cat, data]) =>
                `<tr><td class="font-semibold">${cat}</td><td>${data.count}</td><td>${data.stock}</td><td class="font-semibold">${Utils.currency(data.value)}</td></tr>`
              ).join('')}
            </tbody></table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h4>⚠️ Low & Out of Stock Items</h4></div>
          <div class="card-body p-0">
            <table class="data-table"><thead><tr><th>Product</th><th>Stock</th><th>Min</th><th>Status</th></tr></thead><tbody>
              ${[...outOfStock, ...lowStock].map(p =>
                `<tr><td>${Utils.escapeHtml(p.name)}</td><td class="font-bold">${p.current_stock}</td><td>${p.min_stock}</td><td>${Utils.stockBadge(p)}</td></tr>`
              ).join('')}
              ${outOfStock.length === 0 && lowStock.length === 0 ? '<tr><td colspan="4" class="text-center text-secondary p-4">All stock levels healthy ✅</td></tr>' : ''}
            </tbody></table>
          </div>
        </div>
      </div>
    `;
  },

  async renderPurchasesReport(container) {
    const purchases = await LoyDB.getAll('purchases');
    const suppliers = await LoyDB.getAll('suppliers');
    const filtered = Auth.filterByBranch(purchases);
    const totalSpent = Utils.sumBy(filtered, 'total');
    const unpaid = filtered.filter(p => p.payment_status === 'unpaid' || p.payment_status === 'partial');
    const unpaidTotal = Utils.sumBy(unpaid, 'total');

    // Supplier-wise breakdown
    const supBreakdown = {};
    filtered.forEach(p => {
      const sup = suppliers.find(s => s.id === p.supplier_id);
      const name = sup ? sup.name : 'Unknown';
      if (!supBreakdown[name]) supBreakdown[name] = { count: 0, total: 0 };
      supBreakdown[name].count++;
      supBreakdown[name].total += p.total;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">Purchase Report</h1></div>
        <div class="page-header-right"><button class="btn btn-outline" onclick="App.navigate('reports')">← Back</button></div>
      </div>

      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(3,1fr); margin-bottom: 24px;">
        <div class="stat-card blue"><div class="d-flex items-center gap-4"><div class="stat-card-icon">🛍️</div><div class="stat-card-content"><div class="stat-card-label">Total Purchases</div><div class="stat-card-value">${Utils.currency(totalSpent)}</div><div class="stat-card-trend">${filtered.length} orders</div></div></div></div>
        <div class="stat-card red"><div class="d-flex items-center gap-4"><div class="stat-card-icon">💳</div><div class="stat-card-content"><div class="stat-card-label">Unpaid / Partial</div><div class="stat-card-value">${Utils.currency(unpaidTotal)}</div><div class="stat-card-trend">${unpaid.length} orders</div></div></div></div>
        <div class="stat-card green"><div class="d-flex items-center gap-4"><div class="stat-card-icon">🏭</div><div class="stat-card-content"><div class="stat-card-label">Suppliers</div><div class="stat-card-value">${Object.keys(supBreakdown).length}</div></div></div></div>
      </div>

      <div class="card animate-fadeInUp stagger-2">
        <div class="card-header"><h4>🏭 Supplier-wise Breakdown</h4></div>
        <div class="card-body p-0">
          <table class="data-table"><thead><tr><th>Supplier</th><th>Orders</th><th>Total</th><th>% of Total</th></tr></thead><tbody>
            ${Object.entries(supBreakdown).sort((a, b) => b[1].total - a[1].total).map(([name, data]) =>
              `<tr><td class="font-semibold">${Utils.escapeHtml(name)}</td><td>${data.count}</td><td class="font-semibold">${Utils.currency(data.total)}</td><td>${totalSpent > 0 ? ((data.total / totalSpent) * 100).toFixed(1) : 0}%</td></tr>`
            ).join('')}
          </tbody></table>
        </div>
      </div>
    `;
  },

  async exportSalesCSV() {
    const sales = await LoyDB.getAll('sales');
    const filtered = Auth.filterByBranch(sales);
    let csv = 'Invoice,Date,Customer ID,Subtotal,GST,Discount,Total,Payment,Status\n';
    filtered.forEach(s => {
      csv += `${s.invoice_no},${s.date},${s.customer_id || ''},${s.subtotal},${s.gst_total || s.gst || 0},${s.discount},${s.total},${s.payment_method},${s.status}\n`;
    });
    Utils.downloadFile(csv, `sales_report_${Utils.today()}.csv`, 'text/csv');
    Toast.show('Exported', 'Sales report exported', 'success');
  }
};
