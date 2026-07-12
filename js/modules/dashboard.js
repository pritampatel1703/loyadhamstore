/* ============================================
   DASHBOARD MODULE
   Stats, Charts, Activities, Alerts
   ============================================ */

const DashboardModule = {
  async render(container) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div><p class="page-loader-text">Loading dashboard...</p></div>';

    const [products, sales, purchases, notifications, activities, transfers] = await Promise.all([
      LoyDB.getAll('products'),
      LoyDB.getAll('sales'),
      LoyDB.getAll('purchases'),
      LoyDB.getAll('notifications'),
      LoyDB.getAll('activities'),
      LoyDB.getAll('stock_transfers'),
    ]);

    // Filter by branch
    const branchProducts = Auth.filterByBranch(products);
    const branchSales = Auth.filterByBranch(sales);

    // Calculate stats
    const today = new Date();
    const todaySales = branchSales.filter(s => Utils.isToday(s.date));
    const thisMonth = branchSales.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });

    const todayTotal = Utils.sumBy(todaySales, 'total');
    const monthTotal = Utils.sumBy(thisMonth, 'total');
    const totalRevenue = Utils.sumBy(branchSales, 'total');
    const inventoryValue = branchProducts.reduce((sum, p) => sum + (p.current_stock * p.purchase_price), 0);
    const totalProducts = branchProducts.length;
    const lowStock = branchProducts.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock);
    const outOfStock = branchProducts.filter(p => p.current_stock <= 0);
    const pendingTransfers = transfers.filter(t => t.status === 'pending');

    // Sales data for charts
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const daySales = branchSales.filter(s => new Date(s.date).toDateString() === dayStr);
      last7Days.push({
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        total: Utils.sumBy(daySales, 'total'),
        count: daySales.length,
      });
    }

    // Category-wise sales
    const saleItems = await LoyDB.getAll('sale_items');
    const catSales = {};
    for (const item of saleItems) {
      const prod = products.find(p => p.id === item.product_id);
      if (prod) {
        catSales[prod.category] = (catSales[prod.category] || 0) + item.total;
      }
    }
    const topCategories = Object.entries(catSales).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Top selling products
    const productSales = {};
    saleItems.forEach(item => {
      productSales[item.product_id] = (productSales[item.product_id] || 0) + item.qty;
    });
    const topProducts = Object.entries(productSales)
      .map(([id, qty]) => ({ product: products.find(p => p.id === parseInt(id)), qty }))
      .filter(x => x.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back, ${Utils.escapeHtml(Auth.getUser().name)} · ${Utils.formatDate(new Date(), 'full')}</p>
        </div>
        <div class="page-header-right">
          <select class="form-control form-control-sm" style="width:auto" onchange="DashboardModule.render(document.getElementById('app-content'))">
            <option>Today</option>
            <option>This Week</option>
            <option selected>This Month</option>
            <option>This Year</option>
          </select>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stats-grid animate-fadeInUp">
        <div class="stat-card saffron">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">💰</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Today's Sales</div>
              <div class="stat-card-value">${Utils.currency(todayTotal)}</div>
              <div class="stat-card-trend up">↑ ${todaySales.length} transactions</div>
            </div>
          </div>
        </div>

        <div class="stat-card maroon">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">📊</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Monthly Sales</div>
              <div class="stat-card-value">${Utils.currency(monthTotal)}</div>
              <div class="stat-card-trend up">↑ ${thisMonth.length} transactions</div>
            </div>
          </div>
        </div>

        <div class="stat-card green">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">💎</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Total Revenue</div>
              <div class="stat-card-value">${Utils.currency(totalRevenue)}</div>
              <div class="stat-card-trend up">↑ All time</div>
            </div>
          </div>
        </div>

        <div class="stat-card blue">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">🏪</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Inventory Value</div>
              <div class="stat-card-value">${Utils.currency(inventoryValue)}</div>
              <div class="stat-card-trend up">${totalProducts} products</div>
            </div>
          </div>
        </div>

        <div class="stat-card purple">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">📦</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Total Products</div>
              <div class="stat-card-value">${Utils.number(totalProducts)}</div>
            </div>
          </div>
        </div>

        <div class="stat-card orange">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">⚠️</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Low Stock Items</div>
              <div class="stat-card-value">${lowStock.length}</div>
              <div class="stat-card-trend down">Needs attention</div>
            </div>
          </div>
        </div>

        <div class="stat-card red">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">🚫</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Out of Stock</div>
              <div class="stat-card-value">${outOfStock.length}</div>
              <div class="stat-card-trend down">${outOfStock.length > 0 ? 'Urgent restock needed' : 'All good'}</div>
            </div>
          </div>
        </div>

        <div class="stat-card teal">
          <div class="d-flex items-center gap-4">
            <div class="stat-card-icon">🔄</div>
            <div class="stat-card-content">
              <div class="stat-card-label">Pending Transfers</div>
              <div class="stat-card-value">${pendingTransfers.length}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="dashboard-charts mt-6 animate-fadeInUp stagger-2">
        <div class="card">
          <div class="card-header">
            <h4>📈 Sales Trend (Last 7 Days)</h4>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="salesChart"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h4>🏷️ Category Sales</h4>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="categoryChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="dashboard-charts mt-6 animate-fadeInUp stagger-3">
        <!-- Top Selling Products -->
        <div class="card">
          <div class="card-header">
            <h4>🏆 Top Selling Products</h4>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('reports/sales')">View All</button>
          </div>
          <div class="card-body p-0">
            <table class="data-table">
              <thead><tr><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead>
              <tbody>
                ${topProducts.map((tp, i) => `
                  <tr>
                    <td>
                      <div class="product-info">
                        <div class="product-image-thumb">${tp.product.emoji || '📦'}</div>
                        <div>
                          <div class="product-name">${Utils.escapeHtml(tp.product.name)}</div>
                          <div class="product-code">${tp.product.code}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="font-semibold">${tp.qty}</span> units</td>
                    <td class="font-semibold">${Utils.currency(tp.qty * tp.product.selling_price)}</td>
                  </tr>
                `).join('')}
                ${topProducts.length === 0 ? '<tr><td colspan="3" class="text-center text-secondary p-4">No sales data yet</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Activities & Alerts -->
        <div class="card">
          <div class="card-header">
            <h4>🕐 Recent Activity</h4>
          </div>
          <div class="card-body p-0">
            <div class="activity-list">
              ${activities.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map(a => `
                <div class="activity-item">
                  <div class="activity-icon ${a.type}">${a.type === 'sale' ? '💰' : a.type === 'purchase' ? '🛍️' : a.type === 'transfer' ? '🔄' : a.type === 'alert' ? '⚠️' : '👤'}</div>
                  <div class="activity-content">
                    <div class="activity-text">${Utils.escapeHtml(a.text)}</div>
                    <div class="activity-time">${Utils.timeAgo(a.date)} · ${Utils.escapeHtml(a.user)}</div>
                  </div>
                </div>
              `).join('')}
              ${activities.length === 0 ? '<div class="p-4 text-center text-secondary">No recent activities</div>' : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Stock Alerts & Low Stock -->
      <div class="dashboard-charts mt-6 animate-fadeInUp stagger-4">
        <div class="card">
          <div class="card-header">
            <h4>⚠️ Stock Alerts</h4>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('inventory')">View Inventory</button>
          </div>
          <div class="card-body p-0">
            <div class="alert-list">
              ${[...outOfStock, ...lowStock].slice(0, 8).map(p => `
                <div class="alert-item">
                  <span style="font-size:20px">${p.emoji || '📦'}</span>
                  <div style="flex:1">
                    <div class="font-medium text-sm">${Utils.escapeHtml(p.name)}</div>
                    <div class="text-xs text-secondary">${p.code} · Min: ${p.min_stock}</div>
                  </div>
                  <span class="stock-level ${p.current_stock <= 0 ? 'out' : 'low'}">${p.current_stock} left</span>
                  ${Utils.stockBadge(p)}
                </div>
              `).join('')}
              ${outOfStock.length === 0 && lowStock.length === 0 ? '<div class="p-4 text-center text-secondary">All stock levels are healthy ✅</div>' : ''}
            </div>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="card">
          <div class="card-header">
            <h4>🧾 Recent Transactions</h4>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('sales')">View All</button>
          </div>
          <div class="card-body p-0">
            <div class="activity-list">
              ${branchSales.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map(s => `
                <div class="activity-item">
                  <div class="activity-icon sale">🧾</div>
                  <div class="activity-content">
                    <div class="activity-text">${s.invoice_no} · ${Utils.paymentBadge(s.payment_method)}</div>
                    <div class="activity-time">${Utils.formatDate(s.date, 'time')}</div>
                  </div>
                  <div class="font-semibold text-sm">${Utils.currency(s.total)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Render charts
    this.renderCharts(last7Days, topCategories);
  },

  renderCharts(salesData, categoryData) {
    // Sales trend chart
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx && typeof Chart !== 'undefined') {
      new Chart(salesCtx, {
        type: 'line',
        data: {
          labels: salesData.map(d => d.label),
          datasets: [{
            label: 'Revenue',
            data: salesData.map(d => d.total),
            borderColor: '#FF9933',
            backgroundColor: 'rgba(255,153,51,0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#FF9933',
            pointBorderWidth: 2,
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => '₹' + ctx.raw.toLocaleString('en-IN')
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: v => '₹' + (v / 1000).toFixed(0) + 'K'
              },
              grid: { color: 'rgba(0,0,0,0.04)' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // Category chart
    const catCtx = document.getElementById('categoryChart');
    if (catCtx && typeof Chart !== 'undefined') {
      const colors = ['#FF9933', '#8B1E3F', '#10B981', '#3B82F6', '#F59E0B', '#7C3AED'];
      new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: categoryData.map(c => c[0]),
          datasets: [{
            data: categoryData.map(c => c[1]),
            backgroundColor: colors.slice(0, categoryData.length),
            borderWidth: 2,
            borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#16213E' : '#fff',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ctx.label + ': ₹' + ctx.raw.toLocaleString('en-IN')
              }
            }
          },
          cutout: '65%',
        }
      });
    }
  }
};
