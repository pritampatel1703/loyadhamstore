/* ============================================
   LOYADHAM STORE MANAGEMENT SYSTEM
   Main Application Controller
   ============================================ */

const App = {
  currentPage: 'dashboard',
  activeBranch: null,
  theme: 'light',

  async init() {
    // Check authentication
    if (!Auth.restore()) {
      window.location.href = 'index.html';
      return;
    }

    // Init database
    await LoyDB.init();
    await LoyDB.seed();

    // Load theme
    this.theme = localStorage.getItem('loy_theme') || 'light';
    document.documentElement.setAttribute('data-theme', this.theme);

    // Set active branch
    this.activeBranch = Auth.getBranchId() || 1;

    // Render layout
    this.renderSidebar();
    this.renderHeader();

    // Toast container
    if (!document.getElementById('toast-container')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="toast-container" class="toast-container"></div>');
    }

    // Route
    this.handleRoute();

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggleSearch();
      }
      if (e.key === 'Escape') {
        this.closeSearch();
        this.closeNotifications();
        this.closeModals();
      }
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
      }
    });
  },

  // ---- Routing ----
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const parts = hash.split('/').filter(Boolean);
    const page = parts[0] || 'dashboard';
    const subpage = parts[1] || null;
    const id = parts[2] || null;

    // Check access
    if (!Auth.canAccess(page) && page !== 'dashboard') {
      Toast.show('Access Denied', 'You do not have permission to access this page', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    this.currentPage = page;
    this.updateSidebarActive(page);
    this.updateBreadcrumb(page, subpage);
    this.updateMobileNav(page);
    this.renderPage(page, subpage, id);
  },

  navigate(page) {
    window.location.hash = `#/${page}`;
  },

  renderPage(page, subpage, id) {
    const content = document.getElementById('app-content');
    if (!content) return;

    // Fade out then render
    content.style.opacity = '0';
    content.style.transform = 'translateY(8px)';

    setTimeout(() => {
      switch (page) {
        case 'dashboard': DashboardModule.render(content); break;
        case 'inventory': InventoryModule.render(content, subpage, id); break;
        case 'categories': CategoriesModule.render(content); break;
        case 'pos': POSModule.render(content); break;
        case 'sales': SalesModule.render(content, subpage, id); break;
        case 'purchases': PurchasesModule.render(content, subpage, id); break;
        case 'suppliers': SuppliersModule.render(content, subpage, id); break;
        case 'customers': CustomersModule.render(content, subpage, id); break;
        case 'accounts': AccountsModule.render(content, subpage); break;
        case 'branches': BranchesModule.render(content); break;
        case 'transfers': TransfersModule.render(content); break;
        case 'internal_issues': InternalIssuesModule.render(content); break;
        case 'festivals': FestivalsModule.render(content); break;
        case 'reports': ReportsModule.render(content, subpage); break;
        case 'users': UsersModule.render(content); break;
        case 'settings': SettingsModule.render(content, subpage); break;
        default:
          content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3 class="empty-state-title">Page Not Found</h3><p class="empty-state-desc">The page you're looking for doesn't exist.</p><button class="btn btn-primary" onclick="App.navigate('dashboard')">Go to Dashboard</button></div>`;
      }

      // Fade in
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
    }, 150);
  },

  // ---- Sidebar ----
  renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const menuItems = [
      { section: 'Main' },
      { id: 'dashboard', icon: '📊', label: 'Dashboard', route: 'dashboard' },
      { id: 'pos', icon: '🛒', label: 'POS / Billing', route: 'pos' },

      { section: 'Inventory' },
      { id: 'inventory', icon: '📦', label: 'Products', route: 'inventory' },
      { id: 'categories', icon: '🏷️', label: 'Categories', route: 'categories' },
      { id: 'transfers', icon: '🔄', label: 'Stock Transfers', route: 'transfers' },

      { section: 'Transactions' },
      { id: 'sales', icon: '💰', label: 'Sales', route: 'sales' },
      { id: 'purchases', icon: '🛍️', label: 'Purchases', route: 'purchases' },
      { id: 'customers', icon: '👥', label: 'Customers', route: 'customers' },
      { id: 'suppliers', icon: '🏭', label: 'Suppliers', route: 'suppliers' },

      { section: 'Organization' },
      { id: 'accounts', icon: '📒', label: 'Accounts', route: 'accounts' },
      { id: 'internal_issues', icon: '📋', label: 'Internal Issues', route: 'internal_issues' },
      { id: 'festivals', icon: '🎊', label: 'Festivals', route: 'festivals' },
      { id: 'branches', icon: '🏛️', label: 'Branches', route: 'branches' },

      { section: 'Analytics' },
      { id: 'reports', icon: '📈', label: 'Reports', route: 'reports' },

      { section: 'System' },
      { id: 'users', icon: '👤', label: 'Users', route: 'users' },
      { id: 'settings', icon: '⚙️', label: 'Settings', route: 'settings' },
    ];

    let html = `
      <div class="sidebar-brand">
        <div class="sidebar-brand-icon">🙏</div>
        <div class="sidebar-brand-text">
          <span class="sidebar-brand-name">Loyadham</span>
          <span class="sidebar-brand-sub">Store Management</span>
        </div>
      </div>
      <nav class="sidebar-nav">
    `;

    menuItems.forEach(item => {
      if (item.section) {
        html += `<div class="sidebar-section"><div class="sidebar-section-title">${item.section}</div>`;
      } else {
        if (!Auth.canAccess(item.id)) return;
        const active = this.currentPage === item.id ? 'active' : '';
        html += `
          <button class="sidebar-item ${active}" data-page="${item.route}" onclick="App.closeMobileSidebar();App.navigate('${item.route}')">
            <span class="sidebar-item-icon">${item.icon}</span>
            <span class="sidebar-item-text">${item.label}</span>
          </button>
        `;
      }
    });

    // Close all sections
    html += '</div>';

    html += `
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-toggle" onclick="App.toggleSidebar()" title="Toggle Sidebar">
          <span class="sidebar-item-icon">◀</span>
          <span class="sidebar-item-text">Collapse</span>
        </button>
      </div>
    `;

    sidebar.innerHTML = html;
  },

  updateSidebarActive(page) {
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  },

  toggleSidebar() {
    document.querySelector('.app-layout').classList.toggle('sidebar-collapsed');
    const collapsed = document.querySelector('.app-layout').classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', collapsed);
  },

  toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('show');
  },

  updateMobileNav(page) {
    const nav = document.getElementById('mobile-bottom-nav');
    if (!nav) return;
    nav.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('show');
  },

  // ---- Header ----
  renderHeader() {
    const header = document.getElementById('header');
    if (!header) return;

    const user = Auth.getUser();
    const roleLabel = Auth.getRoleLabel();

    header.innerHTML = `
      <div class="header-left">
        <button class="header-hamburger" onclick="App.toggleMobileSidebar()">☰</button>
        <div class="header-breadcrumb" id="breadcrumb">
          <a href="#/dashboard">Home</a>
          <span class="separator">›</span>
          <span class="current">Dashboard</span>
        </div>
      </div>

      <div class="header-search">
        <span class="header-search-icon">🔍</span>
        <input type="text" class="header-search-input" placeholder="Search products, customers, bills..."
               onfocus="App.openSearch()" readonly>
        <div class="header-search-shortcut">
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </div>
      </div>

      <div class="header-right">
        <div class="branch-selector" onclick="App.showBranchSelector()">
          🏛️ <span id="active-branch-name">Loading...</span>
        </div>

        <button class="theme-toggle" onclick="App.toggleTheme()" title="Toggle Theme">
          <span class="icon-moon">🌙</span>
          <span class="icon-sun">☀️</span>
        </button>

        <button class="header-icon-btn" onclick="App.toggleNotifications()" title="Notifications">
          🔔
          <span class="badge-count" id="notif-count" style="display:none">0</span>
        </button>

        <div class="dropdown">
          <div class="header-profile" onclick="this.parentElement.querySelector('.dropdown-menu').classList.toggle('show')">
            <div class="header-profile-info">
              <div class="header-profile-name">${Utils.escapeHtml(user.name)}</div>
              <div class="header-profile-role">${roleLabel}</div>
            </div>
            <div class="avatar">${user.avatar || user.name.charAt(0)}</div>
          </div>
          <div class="dropdown-menu">
            <button class="dropdown-item" onclick="App.navigate('settings')">⚙️ Settings</button>
            <button class="dropdown-item" onclick="Utils.exportBackup()">💾 Backup Data</button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" onclick="Auth.logout()">🚪 Logout</button>
          </div>
        </div>
      </div>
    `;

    this.loadBranchName();
    this.loadNotificationCount();
  },

  async loadBranchName() {
    const el = document.getElementById('active-branch-name');
    if (!el) return;
    if (Auth.isSuperAdmin()) {
      el.textContent = 'All Branches';
    } else {
      const branch = await LoyDB.get('branches', this.activeBranch);
      el.textContent = branch ? branch.name : 'Branch';
    }
  },

  async loadNotificationCount() {
    const notifications = await LoyDB.getAll('notifications');
    const unread = notifications.filter(n => !n.read).length;
    const el = document.getElementById('notif-count');
    if (el) {
      if (unread > 0) {
        el.textContent = unread > 9 ? '9+' : unread;
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    }
  },

  updateBreadcrumb(page, subpage) {
    const el = document.getElementById('breadcrumb');
    if (!el) return;
    const pageName = Utils.titleCase(page);
    let html = `<a href="#/dashboard">Home</a><span class="separator">›</span>`;
    if (subpage) {
      html += `<a href="#/${page}">${pageName}</a><span class="separator">›</span><span class="current">${Utils.titleCase(subpage)}</span>`;
    } else {
      html += `<span class="current">${pageName}</span>`;
    }
    el.innerHTML = html;
  },

  // ---- Theme ----
  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('loy_theme', this.theme);
  },

  // ---- Branch Selector ----
  async showBranchSelector() {
    if (!Auth.isSuperAdmin() && !Auth.canAccess('branches')) return;

    const branches = await LoyDB.getAll('branches');
    let html = '<div class="modal-body">';
    html += '<p class="mb-4 text-secondary">Select a branch to view its data:</p>';

    if (Auth.isSuperAdmin()) {
      html += `<button class="sidebar-item ${!this.activeBranch ? 'active' : ''} mb-2 w-full" 
                onclick="App.switchBranch(null)" style="background:var(--bg-secondary);border-radius:var(--radius-md);color:var(--text-primary);">
                <span class="sidebar-item-icon">🌐</span>
                <span class="sidebar-item-text">All Branches (Consolidated)</span>
              </button>`;
    }

    branches.forEach(b => {
      html += `<button class="sidebar-item ${this.activeBranch === b.id ? 'active' : ''} mb-2 w-full" 
                onclick="App.switchBranch(${b.id})" style="background:var(--bg-secondary);border-radius:var(--radius-md);color:var(--text-primary);">
                <span class="sidebar-item-icon">🏛️</span>
                <span class="sidebar-item-text">${Utils.escapeHtml(b.name)}</span>
              </button>`;
    });

    html += '</div>';
    Modal.show('Select Branch', html, 'sm');
  },

  switchBranch(branchId) {
    this.activeBranch = branchId;
    this.loadBranchName();
    Modal.close();
    this.handleRoute(); // Refresh current page
    Toast.show('Branch Switched', branchId ? 'Viewing branch data' : 'Viewing consolidated data', 'info');
  },

  // ---- Global Search ----
  openSearch() {
    this.renderSearchOverlay();
    const overlay = document.getElementById('search-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      setTimeout(() => {
        const input = overlay.querySelector('.search-modal-input');
        if (input) input.focus();
      }, 100);
    }
  },

  closeSearch() {
    const overlay = document.getElementById('search-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  toggleSearch() {
    const overlay = document.getElementById('search-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      this.closeSearch();
    } else {
      this.openSearch();
    }
  },

  renderSearchOverlay() {
    if (document.getElementById('search-overlay')) return;

    const html = `
      <div id="search-overlay" class="search-overlay hidden" onclick="if(event.target===this)App.closeSearch()">
        <div class="search-modal">
          <input type="text" class="search-modal-input" placeholder="Search products, customers, invoices..."
                 oninput="App.handleSearch(this.value)">
          <div class="search-modal-results" id="search-results"></div>
          <div class="search-modal-footer">
            <span>🔍 Search</span>
            <span>↵ Open</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  handleSearch: Utils.debounce(async function(term) {
    const results = document.getElementById('search-results');
    if (!results || !term || term.length < 2) {
      if (results) results.innerHTML = '';
      return;
    }

    const lower = term.toLowerCase();
    let html = '';

    // Search products
    const products = await LoyDB.getAll('products');
    const matchedProducts = products.filter(p =>
      p.name.toLowerCase().includes(lower) || p.code.toLowerCase().includes(lower) ||
      (p.gujarati_name && p.gujarati_name.includes(term)) || p.category.toLowerCase().includes(lower)
    ).slice(0, 5);

    if (matchedProducts.length) {
      html += `<div class="search-result-group"><div class="search-result-group-title">Products</div>`;
      matchedProducts.forEach(p => {
        html += `<div class="search-result-item" onclick="App.closeSearch();App.navigate('inventory/view/${p.id}')">
          <div class="search-result-icon">${p.emoji || '📦'}</div>
          <div><div class="search-result-text">${Utils.escapeHtml(p.name)}</div>
          <div class="search-result-meta">${p.code} · ${Utils.currency(p.selling_price)} · Stock: ${p.current_stock}</div></div>
        </div>`;
      });
      html += '</div>';
    }

    // Search customers
    const customers = await LoyDB.getAll('customers');
    const matchedCustomers = customers.filter(c =>
      c.name.toLowerCase().includes(lower) || (c.phone && c.phone.includes(term))
    ).slice(0, 3);

    if (matchedCustomers.length) {
      html += `<div class="search-result-group"><div class="search-result-group-title">Customers</div>`;
      matchedCustomers.forEach(c => {
        html += `<div class="search-result-item" onclick="App.closeSearch();App.navigate('customers')">
          <div class="search-result-icon">👤</div>
          <div><div class="search-result-text">${Utils.escapeHtml(c.name)}</div>
          <div class="search-result-meta">${c.phone || 'No phone'} · ${c.city || ''}</div></div>
        </div>`;
      });
      html += '</div>';
    }

    // Search sales
    const sales = await LoyDB.getAll('sales');
    const matchedSales = sales.filter(s =>
      s.invoice_no.toLowerCase().includes(lower)
    ).slice(0, 3);

    if (matchedSales.length) {
      html += `<div class="search-result-group"><div class="search-result-group-title">Sales / Invoices</div>`;
      matchedSales.forEach(s => {
        html += `<div class="search-result-item" onclick="App.closeSearch();App.navigate('sales')">
          <div class="search-result-icon">🧾</div>
          <div><div class="search-result-text">${s.invoice_no}</div>
          <div class="search-result-meta">${Utils.currency(s.total)} · ${Utils.formatDate(s.date)}</div></div>
        </div>`;
      });
      html += '</div>';
    }

    // Search suppliers
    const suppliers = await LoyDB.getAll('suppliers');
    const matchedSuppliers = suppliers.filter(s =>
      s.name.toLowerCase().includes(lower) || (s.phone && s.phone.includes(term))
    ).slice(0, 3);

    if (matchedSuppliers.length) {
      html += `<div class="search-result-group"><div class="search-result-group-title">Suppliers</div>`;
      matchedSuppliers.forEach(s => {
        html += `<div class="search-result-item" onclick="App.closeSearch();App.navigate('suppliers')">
          <div class="search-result-icon">🏭</div>
          <div><div class="search-result-text">${Utils.escapeHtml(s.name)}</div>
          <div class="search-result-meta">${s.phone || ''} · ${s.city || ''}</div></div>
        </div>`;
      });
      html += '</div>';
    }

    if (!html) {
      html = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon" style="width:48px;height:48px;font-size:24px">🔍</div><p class="text-secondary text-sm">No results found</p></div>';
    }

    results.innerHTML = html;
  }, 250),

  // ---- Notifications Panel ----
  toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
      panel.classList.toggle('open');
    } else {
      this.renderNotificationPanel();
    }
  },

  closeNotifications() {
    const panel = document.getElementById('notification-panel');
    if (panel) panel.classList.remove('open');
  },

  async renderNotificationPanel() {
    const notifications = await LoyDB.getAll('notifications');
    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = `
      <div id="notification-panel" class="notification-panel open">
        <div class="notification-panel-header">
          <h4>Notifications</h4>
          <button class="btn btn-ghost btn-sm" onclick="App.markAllRead()">Mark all read</button>
        </div>
        <div class="notification-list">
    `;

    if (notifications.length === 0) {
      html += '<div class="empty-state" style="padding:40px"><p class="text-secondary text-sm">No notifications</p></div>';
    } else {
      notifications.forEach(n => {
        const typeColors = {
          low_stock: 'warning', out_of_stock: 'danger', pending_transfer: 'info',
          payment: 'alert', festival: 'sale'
        };
        html += `
          <div class="notification-item ${n.read ? '' : 'unread'}" onclick="App.readNotification(${n.id})">
            <div class="notification-item-icon activity-icon ${typeColors[n.type] || 'info'}">${n.icon || '🔔'}</div>
            <div class="notification-item-content">
              <div class="notification-item-title">${Utils.escapeHtml(n.title)}</div>
              <div class="notification-item-text">${Utils.escapeHtml(n.message)}</div>
              <div class="notification-item-time">${Utils.timeAgo(n.date)}</div>
            </div>
          </div>
        `;
      });
    }

    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async markAllRead() {
    const notifications = await LoyDB.getAll('notifications');
    for (const n of notifications) {
      n.read = true;
      await LoyDB.put('notifications', n);
    }
    this.loadNotificationCount();
    // Re-render panel
    const panel = document.getElementById('notification-panel');
    if (panel) panel.remove();
    this.renderNotificationPanel();
    Toast.show('Done', 'All notifications marked as read', 'success');
  },

  async readNotification(id) {
    const n = await LoyDB.get('notifications', id);
    if (n && !n.read) {
      n.read = true;
      await LoyDB.put('notifications', n);
      this.loadNotificationCount();
    }
  },

  // ---- Modals ----
  closeModals() {
    Modal.close();
  },
};

// ---- Toast System ----
const Toast = {
  show(title, message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const id = 'toast-' + Date.now();

    const html = `
      <div class="toast ${type}" id="${id}">
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
          <div class="toast-title">${Utils.escapeHtml(title)}</div>
          <div class="toast-message">${Utils.escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="Toast.dismiss('${id}')">✕</button>
        <div class="toast-progress" style="animation-duration:${duration}ms"></div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);

    setTimeout(() => this.dismiss(id), duration);
  },

  dismiss(id) {
    const toast = document.getElementById(id);
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 300ms ease';
      setTimeout(() => toast.remove(), 300);
    }
  }
};

// ---- Modal System ----
const Modal = {
  stack: [],

  show(title, bodyHtml, size = 'md', footerHtml = '') {
    const id = 'modal-' + Date.now();

    const html = `
      <div class="modal-overlay" id="${id}" onclick="if(event.target===this)Modal.close()">
        <div class="modal ${size}">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="Modal.close()">✕</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';
    this.stack.push(id);
    return id;
  },

  close() {
    const id = this.stack.pop();
    if (id) {
      const el = document.getElementById(id);
      if (el) {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 200);
      }
    }
    if (this.stack.length === 0) {
      document.body.style.overflow = '';
    }
  },

  async confirm(title, message, type = 'warning') {
    return new Promise(resolve => {
      const icons = { warning: '⚠️', danger: '🗑️', info: 'ℹ️' };
      const body = `
        <div class="confirm-dialog">
          <div class="confirm-icon ${type}">${icons[type]}</div>
          <div class="confirm-message">${message}</div>
        </div>
      `;
      const footer = `
        <button class="btn btn-outline" onclick="Modal.close();(${resolve})(false)">Cancel</button>
        <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" onclick="Modal.close();(${resolve})(true)">Confirm</button>
      `;

      // Use a different approach for confirm since we can't serialize the resolve function
      const id = this.show(title, body, 'sm');
      const modal = document.getElementById(id);
      const footer2 = `
        <button class="btn btn-outline" id="confirm-cancel-${id}">Cancel</button>
        <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" id="confirm-ok-${id}">Confirm</button>
      `;
      modal.querySelector('.modal').insertAdjacentHTML('beforeend', `<div class="modal-footer">${footer2}</div>`);

      document.getElementById(`confirm-cancel-${id}`).onclick = () => { Modal.close(); resolve(false); };
      document.getElementById(`confirm-ok-${id}`).onclick = () => { Modal.close(); resolve(true); };
    });
  }
};

// ---- DataTable Component ----
const DataTable = {
  render(config) {
    const {
      id = 'table-' + Date.now(),
      columns = [],
      data = [],
      searchable = true,
      searchKeys = [],
      actions = [],
      topActions = [],
      pagination = true,
      perPage = 10,
      emptyMessage = 'No data found',
      emptyIcon = '📋'
    } = config;

    let filteredData = [...data];
    let currentPage = 1;
    let sortKey = null;
    let sortOrder = 'asc';
    let searchTerm = '';

    function renderTable() {
      // Apply search
      if (searchTerm && searchKeys.length) {
        filteredData = Utils.searchFilter(data, searchTerm, searchKeys);
      } else {
        filteredData = [...data];
      }

      // Apply sort
      if (sortKey) {
        filteredData = Utils.sortBy(filteredData, sortKey, sortOrder);
      }

      // Apply pagination
      const paged = pagination ? Utils.paginate(filteredData, currentPage, perPage) : { data: filteredData, total: filteredData.length, totalPages: 1, page: 1, start: 1, end: filteredData.length };

      let html = '<div class="data-table-wrapper">';

      // Toolbar
      html += '<div class="data-table-toolbar">';
      if (searchable) {
        html += `<div class="data-table-search">
          <span class="search-icon">🔍</span>
          <input type="text" class="form-control" placeholder="Search..." value="${Utils.escapeHtml(searchTerm)}"
                 oninput="DataTable.instances['${id}'].search(this.value)" style="padding-left:36px">
        </div>`;
      }
      if (topActions.length) {
        html += '<div class="data-table-actions">';
        topActions.forEach(a => {
          html += `<button class="btn ${a.class || 'btn-outline'} btn-sm" onclick="${a.onclick}">${a.icon || ''} ${a.label}</button>`;
        });
        html += '</div>';
      }
      html += '</div>';

      // Table
      html += '<div style="overflow-x:auto"><table class="data-table">';

      // Header
      html += '<thead><tr>';
      columns.forEach(col => {
        const sorted = sortKey === col.key ? 'sorted' : '';
        const arrow = sorted ? (sortOrder === 'asc' ? '↑' : '↓') : '↕';
        html += `<th class="${sorted}" onclick="DataTable.instances['${id}'].sort('${col.key}')" style="${col.width ? 'width:'+col.width : ''}">
          ${col.label} <span class="sort-icon">${col.sortable !== false ? arrow : ''}</span>
        </th>`;
      });
      if (actions.length) html += '<th style="width:120px">Actions</th>';
      html += '</tr></thead>';

      // Body
      html += '<tbody>';
      if (paged.data.length === 0) {
        html += `<tr><td colspan="${columns.length + (actions.length ? 1 : 0)}" style="text-align:center;padding:40px">
          <div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="width:48px;height:48px;font-size:24px">${emptyIcon}</div>
          <p class="text-secondary text-sm">${emptyMessage}</p></div>
        </td></tr>`;
      } else {
        paged.data.forEach(row => {
          html += '<tr>';
          columns.forEach(col => {
            const val = col.render ? col.render(row) : (row[col.key] ?? '-');
            html += `<td>${val}</td>`;
          });
          if (actions.length) {
            html += '<td><div class="action-cell">';
            actions.forEach(a => {
              if (a.visible && !a.visible(row)) return;
              html += `<button class="action-btn ${a.class || ''}" title="${a.title || ''}" onclick="${a.onclick}(${row.id})">${a.icon}</button>`;
            });
            html += '</div></td>';
          }
          html += '</tr>';
        });
      }
      html += '</tbody></table></div>';

      // Footer / Pagination
      if (pagination && paged.totalPages > 1) {
        html += `<div class="data-table-footer">
          <span>Showing ${paged.start} to ${paged.end} of ${paged.total} entries</span>
          <div class="pagination">
            <button class="pagination-btn ${currentPage <= 1 ? 'disabled' : ''}" onclick="DataTable.instances['${id}'].goPage(${currentPage - 1})">‹</button>`;

        for (let p = 1; p <= paged.totalPages; p++) {
          if (paged.totalPages > 7 && p > 2 && p < paged.totalPages - 1 && Math.abs(p - currentPage) > 1) {
            if (p === 3 || p === paged.totalPages - 2) html += '<button class="pagination-btn disabled">…</button>';
            continue;
          }
          html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="DataTable.instances['${id}'].goPage(${p})">${p}</button>`;
        }

        html += `<button class="pagination-btn ${currentPage >= paged.totalPages ? 'disabled' : ''}" onclick="DataTable.instances['${id}'].goPage(${currentPage + 1})">›</button>
          </div>
        </div>`;
      }

      html += '</div>';
      return html;
    }

    // Store instance for callbacks
    if (!DataTable.instances) DataTable.instances = {};
    DataTable.instances[id] = {
      search(term) {
        searchTerm = term;
        currentPage = 1;
        const container = document.getElementById(id);
        if (container) container.innerHTML = renderTable();
      },
      sort(key) {
        if (sortKey === key) sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortOrder = 'asc'; }
        const container = document.getElementById(id);
        if (container) container.innerHTML = renderTable();
      },
      goPage(p) {
        if (p < 1) return;
        currentPage = p;
        const container = document.getElementById(id);
        if (container) container.innerHTML = renderTable();
      },
      refresh(newData) {
        data.length = 0;
        data.push(...newData);
        const container = document.getElementById(id);
        if (container) container.innerHTML = renderTable();
      }
    };

    return `<div id="${id}">${renderTable()}</div>`;
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
