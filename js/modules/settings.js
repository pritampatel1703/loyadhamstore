/* ============================================
   SETTINGS MODULE
   ============================================ */

const SettingsModule = {
  async render(container, subpage) {
    if (subpage === 'backup') return this.renderBackup(container);
    return this.renderGeneral(container);
  },

  async renderGeneral(container) {
    const settings = await LoyDB.getAll('settings');
    const getVal = (key) => { const s = settings.find(x => x.key === key); return s ? s.value : ''; };

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Application configuration</p>
        </div>
      </div>

      <div class="animate-fadeInUp">
        <!-- Organization Settings -->
        <div class="card mb-6">
          <div class="card-header"><h4>🏛️ Organization</h4></div>
          <div class="card-body">
            <form id="org-settings-form" onsubmit="SettingsModule.saveOrgSettings(event)">
              <div class="product-form-grid">
                <div class="form-group"><label class="form-label">Organization Name</label><input type="text" class="form-control" name="org_name" value="${Utils.escapeHtml(getVal('org_name'))}"></div>
                <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-control" name="org_address" value="${Utils.escapeHtml(getVal('org_address'))}"></div>
                <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" name="org_phone" value="${getVal('org_phone')}"></div>
                <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="org_email" value="${getVal('org_email')}"></div>
                <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-control" name="org_gst" value="${getVal('org_gst')}"></div>
                <div class="form-group"><label class="form-label">Financial Year</label><input type="text" class="form-control" name="financial_year" value="${getVal('financial_year')}"></div>
              </div>
              <div class="mt-4"><button type="submit" class="btn btn-primary">💾 Save Organization Settings</button></div>
            </form>
          </div>
        </div>

        <!-- Invoice Settings -->
        <div class="card mb-6">
          <div class="card-header"><h4>🧾 Invoice</h4></div>
          <div class="card-body">
            <form id="inv-settings-form" onsubmit="SettingsModule.saveInvoiceSettings(event)">
              <div class="product-form-grid">
                <div class="form-group"><label class="form-label">Invoice Prefix</label><input type="text" class="form-control" name="invoice_prefix" value="${getVal('invoice_prefix')}"></div>
                <div class="form-group"><label class="form-label">PO Prefix</label><input type="text" class="form-control" name="po_prefix" value="${getVal('po_prefix')}"></div>
                <div class="form-group"><label class="form-label">Currency</label>
                  <select class="form-control" name="currency">
                    <option value="INR" ${getVal('currency') === 'INR' ? 'selected' : ''}>₹ INR (Indian Rupee)</option>
                    <option value="USD" ${getVal('currency') === 'USD' ? 'selected' : ''}>$ USD</option>
                  </select>
                </div>
              </div>
              <div class="mt-4"><button type="submit" class="btn btn-primary">💾 Save Invoice Settings</button></div>
            </form>
          </div>
        </div>

        <!-- Appearance -->
        <div class="card mb-6">
          <div class="card-header"><h4>🎨 Appearance</h4></div>
          <div class="card-body">
            <div class="d-flex items-center gap-4 mb-4">
              <span class="font-semibold">Theme:</span>
              <button class="btn ${App.theme === 'light' ? 'btn-primary' : 'btn-outline'}" onclick="SettingsModule.setTheme('light')">☀️ Light</button>
              <button class="btn ${App.theme === 'dark' ? 'btn-primary' : 'btn-outline'}" onclick="SettingsModule.setTheme('dark')">🌙 Dark</button>
            </div>
          </div>
        </div>

        <!-- Data Management -->
        <div class="card mb-6">
          <div class="card-header"><h4>💾 Data Management</h4></div>
          <div class="card-body">
            <div class="d-flex gap-3 flex-wrap">
              <button class="btn btn-outline" onclick="Utils.exportBackup()">📥 Export Backup (JSON)</button>
              <button class="btn btn-outline" onclick="SettingsModule.importBackup()">📤 Import Backup</button>
              <button class="btn btn-outline-danger" onclick="SettingsModule.resetData()">🗑️ Reset All Data</button>
            </div>
            <input type="file" id="backup-file-input" accept=".json" style="display:none" onchange="SettingsModule.handleImport(event)">
          </div>
        </div>

        <!-- About -->
        <div class="card">
          <div class="card-header"><h4>ℹ️ About</h4></div>
          <div class="card-body">
            <table class="data-table"><tbody>
              <tr><td class="text-secondary">Application</td><td>Loyadham Store Management System</td></tr>
              <tr><td class="text-secondary">Version</td><td>1.0.0</td></tr>
              <tr><td class="text-secondary">Database</td><td>IndexedDB (Browser Local Storage)</td></tr>
              <tr><td class="text-secondary">Technology</td><td>HTML, CSS, JavaScript (Vanilla)</td></tr>
              <tr><td class="text-secondary">Logged in as</td><td>${Utils.escapeHtml(Auth.getUser().name)} (${Auth.getRoleLabel()})</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
    `;
  },

  async saveOrgSettings(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const settings = await LoyDB.getAll('settings');
    for (const [key, value] of Object.entries(data)) {
      const existing = settings.find(s => s.key === key);
      if (existing) {
        existing.value = value;
        await LoyDB.put('settings', existing);
      } else {
        await LoyDB.add('settings', { key, value });
      }
    }
    Toast.show('Saved', 'Organization settings saved', 'success');
  },

  async saveInvoiceSettings(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const settings = await LoyDB.getAll('settings');
    for (const [key, value] of Object.entries(data)) {
      const existing = settings.find(s => s.key === key);
      if (existing) {
        existing.value = value;
        await LoyDB.put('settings', existing);
      } else {
        await LoyDB.add('settings', { key, value });
      }
    }
    Toast.show('Saved', 'Invoice settings saved', 'success');
  },

  setTheme(theme) {
    App.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('loy_theme', theme);
    // Re-render to update button states
    App.navigate('settings');
  },

  importBackup() {
    document.getElementById('backup-file-input').click();
  },

  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const confirmed = await Modal.confirm('Import Backup', 'This will REPLACE all existing data with the backup data. Are you sure?', 'danger');
    if (!confirmed) return;

    try {
      const text = await file.text();
      await Utils.importBackup(text);
      Toast.show('Imported', 'Data imported successfully. Refreshing...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      Toast.show('Error', 'Invalid backup file: ' + err.message, 'error');
    }
  },

  async resetData() {
    const confirmed = await Modal.confirm('Reset All Data', 'This will DELETE ALL DATA and re-seed with demo data. This action CANNOT be undone!', 'danger');
    if (!confirmed) return;

    const confirmed2 = await Modal.confirm('Are you absolutely sure?', 'Type "RESET" mentally and confirm to proceed.', 'danger');
    if (!confirmed2) return;

    try {
      for (const store of LoyDB.STORES) {
        await LoyDB.clear(store);
      }
      await LoyDB.seed();
      Toast.show('Reset', 'All data has been reset. Refreshing...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      Toast.show('Error', err.message, 'error');
    }
  }
};
