/* ============================================
   FESTIVALS MODULE
   ============================================ */

const FestivalsModule = {
  async render(container) {
    const festivals = await LoyDB.getAll('festivals');
    const filtered = Auth.filterByBranch(festivals);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Festivals</h1>
          <p class="page-subtitle">Manage festival events and budgets</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="FestivalsModule.showForm()">➕ Add Festival</button>` : ''}
        </div>
      </div>

      <div class="stats-grid animate-fadeInUp" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); margin-bottom: 24px;">
        ${filtered.sort((a, b) => new Date(a.date_from) - new Date(b.date_from)).map(f => {
          const daysUntil = Math.ceil((new Date(f.date_from) - new Date()) / 86400000);
          const budgetUsed = f.budget > 0 ? ((f.spent / f.budget) * 100).toFixed(0) : 0;
          return `
            <div class="card">
              <div class="card-body">
                <div class="d-flex items-center gap-3 mb-3">
                  <span style="font-size:32px">🎊</span>
                  <div style="flex:1">
                    <div class="font-semibold text-lg">${Utils.escapeHtml(f.name)}</div>
                    <div class="text-xs text-secondary">${Utils.formatDate(f.date_from)} - ${Utils.formatDate(f.date_to)}</div>
                  </div>
                  ${Utils.statusBadge(f.status)}
                </div>
                <div class="text-sm text-secondary mb-3">${Utils.escapeHtml(f.notes || '')}</div>
                ${daysUntil > 0 ? `<div class="text-sm mb-3"><span class="font-semibold text-primary">${daysUntil} days</span> until the event</div>` : daysUntil === 0 ? '<div class="text-sm mb-3 text-success font-semibold">🎉 Today!</div>' : '<div class="text-sm mb-3 text-secondary">Event has passed</div>'}
                <div style="display:grid; grid-template-columns: repeat(3,1fr); gap:8px; padding-top:12px; border-top:1px solid var(--border-light);">
                  <div class="text-center"><div class="text-xs text-secondary">Budget</div><div class="text-sm font-semibold">${Utils.currency(f.budget)}</div></div>
                  <div class="text-center"><div class="text-xs text-secondary">Spent</div><div class="text-sm font-semibold text-danger">${Utils.currency(f.spent)}</div></div>
                  <div class="text-center"><div class="text-xs text-secondary">Used</div><div class="text-sm font-semibold">${budgetUsed}%</div></div>
                </div>
                <div class="progress-bar mt-2"><div class="progress-bar-fill ${budgetUsed > 90 ? 'danger' : budgetUsed > 60 ? 'warning' : 'success'}" style="width:${Math.min(budgetUsed, 100)}%"></div></div>
                ${Auth.canUpdate() ? `
                  <div class="mt-3 d-flex gap-2 justify-end">
                    <button class="btn btn-ghost btn-sm" onclick="FestivalsModule.showForm(${f.id})">✏️ Edit</button>
                    <button class="btn btn-ghost btn-sm text-danger" onclick="FestivalsModule.deleteFestival(${f.id})">🗑️</button>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
        ${filtered.length === 0 ? '<div class="card"><div class="card-body text-center text-secondary p-6">No festivals found. Add your first festival event!</div></div>' : ''}
      </div>
    `;
  },

  async showForm(id = null) {
    let festival = null;
    if (id) festival = await LoyDB.get('festivals', id);

    const body = `
      <form id="festival-form">
        <div class="form-group"><label class="form-label">Festival Name <span class="required">*</span></label><input type="text" class="form-control" name="name" value="${festival?.name || ''}" required></div>
        <div class="form-group"><label class="form-label">Start Date <span class="required">*</span></label><input type="date" class="form-control" name="date_from" value="${festival?.date_from || ''}" required></div>
        <div class="form-group"><label class="form-label">End Date <span class="required">*</span></label><input type="date" class="form-control" name="date_to" value="${festival?.date_to || ''}" required></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-control" name="status">
            ${['planning', 'upcoming', 'ongoing', 'completed'].map(s => `<option value="${s}" ${festival?.status === s ? 'selected' : ''}>${Utils.capitalize(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Budget</label><input type="number" class="form-control" name="budget" value="${festival?.budget || 0}" min="0" step="100"></div>
        <div class="form-group"><label class="form-label">Spent</label><input type="number" class="form-control" name="spent" value="${festival?.spent || 0}" min="0" step="100"></div>
        <div class="form-group"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="2">${festival?.notes || ''}</textarea></div>
      </form>
    `;

    Modal.show(festival ? 'Edit Festival' : 'Add Festival', body, 'md', `
      <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="FestivalsModule.saveFestival(${id || 'null'})">Save</button>
    `);
  },

  async saveFestival(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('festival-form')));
    data.budget = parseFloat(data.budget) || 0;
    data.spent = parseFloat(data.spent) || 0;
    data.sales = 0;
    data.branch_id = App.activeBranch || 1;
    try {
      if (id) {
        const existing = await LoyDB.get('festivals', id);
        Object.assign(existing, data);
        await LoyDB.put('festivals', existing);
        Toast.show('Updated', 'Festival updated', 'success');
      } else {
        await LoyDB.add('festivals', data);
        Toast.show('Added', 'Festival added', 'success');
      }
      Modal.close();
      App.navigate('festivals');
    } catch (err) { Toast.show('Error', err.message, 'error'); }
  },

  async deleteFestival(id) {
    const confirmed = await Modal.confirm('Delete Festival', 'Delete this festival?', 'danger');
    if (confirmed) {
      await LoyDB.delete('festivals', id);
      Toast.show('Deleted', 'Festival deleted', 'success');
      App.navigate('festivals');
    }
  }
};
