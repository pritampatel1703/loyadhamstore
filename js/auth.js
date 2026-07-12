/* ============================================
   AUTHENTICATION & ROLE-BASED ACCESS
   ============================================ */

const Auth = {
  currentUser: null,

  ROLES: {
    super_admin: { label: 'Super Admin', level: 0 },
    store_manager: { label: 'Store Manager', level: 1 },
    branch_manager: { label: 'Branch Manager', level: 2 },
    cashier: { label: 'Cashier', level: 3 },
    inventory_manager: { label: 'Inventory Manager', level: 3 },
    accountant: { label: 'Accountant', level: 3 },
    read_only: { label: 'Read Only', level: 4 },
  },

  // Permission matrix: role -> allowed modules
  PERMISSIONS: {
    super_admin: ['*'], // All access
    store_manager: ['dashboard', 'inventory', 'categories', 'pos', 'sales', 'purchases', 'suppliers', 'customers', 'accounts', 'branches', 'transfers', 'internal_issues', 'festivals', 'reports', 'users', 'settings', 'notifications'],
    branch_manager: ['dashboard', 'inventory', 'categories', 'pos', 'sales', 'purchases', 'suppliers', 'customers', 'accounts', 'transfers', 'internal_issues', 'festivals', 'reports', 'notifications'],
    cashier: ['dashboard', 'pos', 'sales', 'customers', 'notifications'],
    inventory_manager: ['dashboard', 'inventory', 'categories', 'purchases', 'suppliers', 'transfers', 'internal_issues', 'festivals', 'reports', 'notifications'],
    accountant: ['dashboard', 'sales', 'purchases', 'accounts', 'reports', 'notifications'],
    read_only: ['dashboard', 'inventory', 'sales', 'reports'],
  },

  // Action-level permissions
  ACTIONS: {
    super_admin: ['create', 'read', 'update', 'delete', 'export', 'import', 'approve', 'manage_users', 'manage_branches', 'manage_settings'],
    store_manager: ['create', 'read', 'update', 'delete', 'export', 'import', 'approve', 'manage_users'],
    branch_manager: ['create', 'read', 'update', 'delete', 'export', 'approve'],
    cashier: ['create', 'read'],
    inventory_manager: ['create', 'read', 'update', 'export', 'import'],
    accountant: ['create', 'read', 'update', 'export'],
    read_only: ['read'],
  },

  async login(username, password) {
    const users = await LoyDB.getAll('users');
    const user = users.find(u => u.username === username && u.password === password && u.status === 'active');

    if (!user) {
      throw new Error('Invalid username or password');
    }

    this.currentUser = user;
    sessionStorage.setItem('loy_user', JSON.stringify(user));
    await this.logActivity('login', `${user.name} logged in`);
    return user;
  },

  logout() {
    if (this.currentUser) {
      this.logActivity('logout', `${this.currentUser.name} logged out`);
    }
    this.currentUser = null;
    sessionStorage.removeItem('loy_user');
    window.location.href = 'index.html';
  },

  restore() {
    const saved = sessionStorage.getItem('loy_user');
    if (saved) {
      this.currentUser = JSON.parse(saved);
      return true;
    }
    return false;
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  getUser() {
    return this.currentUser;
  },

  getRole() {
    return this.currentUser?.role || 'read_only';
  },

  getRoleLabel() {
    const role = this.getRole();
    return this.ROLES[role]?.label || role;
  },

  getBranchId() {
    return this.currentUser?.branch_id;
  },

  isSuperAdmin() {
    return this.getRole() === 'super_admin';
  },

  // Check if user can access a module
  canAccess(module) {
    const role = this.getRole();
    const perms = this.PERMISSIONS[role];
    if (!perms) return false;
    return perms.includes('*') || perms.includes(module);
  },

  // Check if user has a specific action permission
  hasPermission(action) {
    const role = this.getRole();
    const actions = this.ACTIONS[role];
    if (!actions) return false;
    return actions.includes(action);
  },

  // Check if user can perform CRUD on a module
  canCreate() { return this.hasPermission('create'); },
  canUpdate() { return this.hasPermission('update'); },
  canDelete() { return this.hasPermission('delete'); },
  canExport() { return this.hasPermission('export'); },
  canImport() { return this.hasPermission('import'); },
  canApprove() { return this.hasPermission('approve'); },

  // Filter data by branch for non-super-admin users
  filterByBranch(data) {
    if (this.isSuperAdmin()) return data;
    const branchId = this.getBranchId();
    return data.filter(item => !item.branch_id || item.branch_id === branchId);
  },

  async logActivity(type, text) {
    try {
      await LoyDB.add('activities', {
        type,
        text,
        user: this.currentUser?.name || 'System',
        branch_id: this.currentUser?.branch_id || 1,
        date: new Date().toISOString()
      });
    } catch (e) {
      // Silently fail for activity logging
    }
  }
};
