/* ============================================
   USERS MODULE
   ============================================ */

const UsersModule = {
  async render(container) {
    const users = await LoyDB.getAll('users');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">User Management</h1>
          <p class="page-subtitle">${users.length} users registered</p>
        </div>
        <div class="page-header-right">
          ${Auth.hasPermission('manage_users') ? `<button class="btn btn-primary" onclick="UsersModule.showForm()">➕ Add User</button>` : ''}
        </div>
      </div>
      <div id="users-table" class="animate-fadeInUp"></div>
    `;

    const branches = await LoyDB.getAll('branches');
    document.getElementById('users-table').innerHTML = DataTable.render({
      id: 'usr-tbl',
      columns: [
        { key: 'name', label: 'User', render: (row) => `
          <div class="d-flex items-center gap-3">
            <div class="avatar" style="width:36px;height:36px;font-size:14px">${row.avatar || row.name.charAt(0)}</div>
            <div><div class="font-semibold">${Utils.escapeHtml(row.name)}</div><div class="text-xs text-secondary">@${row.username}</div></div>
          </div>
        `},
        { key: 'role', label: 'Role', render: (row) => `<span class="tag">${Auth.ROLES[row.role]?.label || row.role}</span>` },
        { key: 'branch_id', label: 'Branch', render: (row) => {
          if (!row.branch_id) return '<span class="text-secondary">All Branches</span>';
          const b = branches.find(x => x.id === row.branch_id);
          return b ? Utils.escapeHtml(b.name) : '-';
        }},
        { key: 'email', label: 'Email', render: (row) => row.email || '-' },
        { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
        { key: 'status', label: 'Status', render: (row) => Utils.statusBadge(row.status) },
      ],
      data: users,
      searchable: true,
      searchKeys: ['name', 'username', 'email', 'phone'],
      pagination: true,
      perPage: 15,
      emptyMessage: 'No users found',
      emptyIcon: '👤',
      actions: [
        ...(Auth.hasPermission('manage_users') ? [
          { icon: '✏️', title: 'Edit', class: 'edit', onclick: 'UsersModule.showForm' },
          { icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'UsersModule.deleteUser' },
        ] : []),
      ],
    });
  },

  async showForm(id = null) {
    let user = null;
    if (id) user = await LoyDB.get('users', id);
    const branches = await LoyDB.getAll('branches');

    const body = `
      <form id="user-form">
        <div class="form-group"><label class="form-label">Full Name <span class="required">*</span></label><input type="text" class="form-control" name="name" value="${user?.name || ''}" required></div>
        <div class="form-group"><label class="form-label">Username <span class="required">*</span></label><input type="text" class="form-control" name="username" value="${user?.username || ''}" required></div>
        <div class="form-group"><label class="form-label">Password ${user ? '(leave blank to keep)' : '<span class="required">*</span>'}</label><input type="password" class="form-control" name="password" ${user ? '' : 'required'}></div>
        <div class="form-group"><label class="form-label">Role <span class="required">*</span></label>
          <select class="form-control" name="role" required>
            ${Object.entries(Auth.ROLES).map(([key, val]) => `<option value="${key}" ${user?.role === key ? 'selected' : ''}>${val.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Branch</label>
          <select class="form-control" name="branch_id">
            <option value="">All Branches (Super Admin)</option>
            ${branches.map(b => `<option value="${b.id}" ${user?.branch_id == b.id ? 'selected' : ''}>${Utils.escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${user?.email || ''}"></div>
        <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" name="phone" value="${user?.phone || ''}"></div>
        <div class="form-group"><label class="form-label">Avatar (initials)</label><input type="text" class="form-control" name="avatar" value="${user?.avatar || ''}" maxlength="3"></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-control" name="status"><option value="active" ${user?.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${user?.status === 'inactive' ? 'selected' : ''}>Inactive</option></select>
        </div>
      </form>
    `;

    Modal.show(user ? 'Edit User' : 'Add User', body, 'md', `
      <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="UsersModule.saveUser(${id || 'null'})">Save</button>
    `);
  },

  async saveUser(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('user-form')));
    data.branch_id = data.branch_id ? parseInt(data.branch_id) : null;

    try {
      if (id) {
        const existing = await LoyDB.get('users', id);
        if (!data.password) data.password = existing.password; // keep existing password
        Object.assign(existing, data);
        await LoyDB.put('users', existing);
        Toast.show('Updated', 'User updated', 'success');
      } else {
        if (!data.password) { Toast.show('Error', 'Password is required', 'error'); return; }
        await LoyDB.add('users', data);
        Toast.show('Added', 'User added', 'success');
      }
      Modal.close();
      App.navigate('users');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  },

  async deleteUser(id) {
    if (id === Auth.getUser().id) {
      Toast.show('Error', 'Cannot delete your own account', 'error');
      return;
    }
    const confirmed = await Modal.confirm('Delete User', 'Delete this user?', 'danger');
    if (confirmed) {
      await LoyDB.delete('users', id);
      Toast.show('Deleted', 'User deleted', 'success');
      App.navigate('users');
    }
  }
};
