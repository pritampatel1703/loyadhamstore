/* ============================================
   BRANCHES MODULE
   ============================================ */

const BranchesModule = {
  async render(container) {
    const branches = await LoyDB.getAll('branches');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Branches</h1>
          <p class="page-subtitle">${branches.length} branches</p>
        </div>
        <div class="page-header-right">
          ${Auth.hasPermission('manage_branches') ? `<button class="btn btn-primary" onclick="BranchesModule.showForm()">➕ Add Branch</button>` : ''}
        </div>
      </div>

      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); margin-bottom: 24px;">
        ${branches.map(b => `
          <div class="card" style="cursor:pointer" onclick="App.switchBranch(${b.id})">
            <div class="card-body">
              <div class="d-flex items-center gap-4">
                <div style="font-size:32px">🏛️</div>
                <div style="flex:1">
                  <div class="font-semibold text-lg">${Utils.escapeHtml(b.name)}</div>
                  <div class="text-xs text-secondary font-mono">${b.code}</div>
                  <div class="text-sm text-secondary mt-1">${Utils.escapeHtml(b.address || '')}</div>
                </div>
                <div>
                  ${Utils.statusBadge(b.status)}
                </div>
              </div>
              <div style="display:grid; grid-template-columns: repeat(3,1fr); gap:12px; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-light);">
                <div class="text-center"><div class="text-xs text-secondary">Phone</div><div class="text-sm font-medium">${b.phone || '-'}</div></div>
                <div class="text-center"><div class="text-xs text-secondary">Manager</div><div class="text-sm font-medium">${Utils.escapeHtml(b.manager || '-')}</div></div>
                <div class="text-center"><div class="text-xs text-secondary">Email</div><div class="text-sm font-medium">${b.email || '-'}</div></div>
              </div>
              ${Auth.hasPermission('manage_branches') ? `
                <div class="mt-4 d-flex gap-2 justify-end">
                  <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();BranchesModule.showForm(${b.id})">✏️ Edit</button>
                  <button class="btn btn-ghost btn-sm text-danger" onclick="event.stopPropagation();BranchesModule.deleteBranch(${b.id})">🗑️ Delete</button>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async showForm(id = null) {
    let branch = null;
    if (id) branch = await LoyDB.get('branches', id);

    const body = `
      <form id="branch-form">
        <div class="form-group"><label class="form-label">Name <span class="required">*</span></label><input type="text" class="form-control" name="name" value="${branch?.name || ''}" required></div>
        <div class="form-group"><label class="form-label">Code <span class="required">*</span></label><input type="text" class="form-control" name="code" value="${branch?.code || ''}" required></div>
        <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-control" name="address" value="${branch?.address || ''}"></div>
        <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" name="phone" value="${branch?.phone || ''}"></div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${branch?.email || ''}"></div>
        <div class="form-group"><label class="form-label">Manager</label><input type="text" class="form-control" name="manager" value="${branch?.manager || ''}"></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-control" name="status"><option value="active" ${branch?.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${branch?.status === 'inactive' ? 'selected' : ''}>Inactive</option></select>
        </div>
      </form>
    `;

    Modal.show(branch ? 'Edit Branch' : 'Add Branch', body, 'md', `
      <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="BranchesModule.saveBranch(${id || 'null'})">Save</button>
    `);
  },

  async saveBranch(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('branch-form')));
    try {
      if (id) {
        const existing = await LoyDB.get('branches', id);
        Object.assign(existing, data);
        await LoyDB.put('branches', existing);
        Toast.show('Updated', 'Branch updated', 'success');
      } else {
        await LoyDB.add('branches', data);
        Toast.show('Added', 'Branch added', 'success');
      }
      Modal.close();
      App.navigate('branches');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  },

  async deleteBranch(id) {
    const confirmed = await Modal.confirm('Delete Branch', 'Delete this branch?', 'danger');
    if (confirmed) {
      await LoyDB.delete('branches', id);
      Toast.show('Deleted', 'Branch deleted', 'success');
      App.navigate('branches');
    }
  }
};
