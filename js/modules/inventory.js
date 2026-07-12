/* ============================================
   INVENTORY MODULE
   Product listing, CRUD, stock management
   ============================================ */

const InventoryModule = {
  async render(container, subpage, id) {
    if (subpage === 'add') return this.renderForm(container);
    if (subpage === 'edit' && id) return this.renderForm(container, parseInt(id));
    if (subpage === 'view' && id) return this.renderDetail(container, parseInt(id));
    return this.renderList(container);
  },

  async renderList(container) {
    const products = await LoyDB.getAll('products');
    const filtered = Auth.filterByBranch(products);
    const categories = await LoyDB.getAll('categories');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Inventory Management</h1>
          <p class="page-subtitle">${filtered.length} products across ${categories.length} categories</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? `<button class="btn btn-primary" onclick="App.navigate('inventory/add')">➕ Add Product</button>` : ''}
          ${Auth.canExport() ? `<button class="btn btn-outline" onclick="InventoryModule.exportExcel()">📥 Export Excel</button>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-6 animate-fadeInUp">
        <div class="card-body">
          <div class="inventory-filters">
            <div class="data-table-search" style="max-width:280px">
              <span class="search-icon">🔍</span>
              <input type="text" class="form-control" placeholder="Search products..." id="inv-search" oninput="InventoryModule.filterProducts()" style="padding-left:36px">
            </div>
            <select class="form-control filter-select" id="inv-cat-filter" onchange="InventoryModule.filterProducts()">
              <option value="">All Categories</option>
              ${categories.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')}
            </select>
            <select class="form-control filter-select" id="inv-stock-filter" onchange="InventoryModule.filterProducts()">
              <option value="">All Stock Status</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            <select class="form-control filter-select" id="inv-status-filter" onchange="InventoryModule.filterProducts()">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Products Table -->
      <div id="inventory-table" class="animate-fadeInUp stagger-2"></div>
    `;

    this.renderTable(filtered);
  },

  renderTable(products) {
    const tableContainer = document.getElementById('inventory-table');
    if (!tableContainer) return;

    tableContainer.innerHTML = DataTable.render({
      id: 'inv-table',
      columns: [
        { key: 'name', label: 'Product', render: (row) => `
          <div class="product-info">
            <div class="product-image-thumb">${row.emoji || '📦'}</div>
            <div>
              <div class="product-name">${Utils.escapeHtml(row.name)}</div>
              <div class="product-code">${row.code}${row.gujarati_name ? ' · ' + row.gujarati_name : ''}</div>
            </div>
          </div>
        `},
        { key: 'category', label: 'Category', render: (row) => `<span class="tag">${row.category}</span>` },
        { key: 'selling_price', label: 'Price', render: (row) => `<span class="font-semibold">${Utils.currency(row.selling_price)}</span><br><span class="text-xs text-secondary">MRP: ${Utils.currency(row.mrp)}</span>` },
        { key: 'current_stock', label: 'Stock', render: (row) => `<span class="font-semibold">${row.current_stock}</span><br>${Utils.stockBadge(row)}` },
        { key: 'gst', label: 'GST', render: (row) => `${row.gst}%` },
        { key: 'status', label: 'Status', render: (row) => Utils.statusBadge(row.status) },
      ],
      data: products,
      searchable: false,
      pagination: true,
      perPage: 15,
      emptyMessage: 'No products found',
      emptyIcon: '📦',
      actions: [
        { icon: '👁️', title: 'View', class: 'view', onclick: 'InventoryModule.viewProduct' },
        ...(Auth.canUpdate() ? [{ icon: '✏️', title: 'Edit', class: 'edit', onclick: 'InventoryModule.editProduct' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'InventoryModule.deleteProduct' }] : []),
      ],
    });
  },

  async filterProducts() {
    const search = document.getElementById('inv-search')?.value || '';
    const category = document.getElementById('inv-cat-filter')?.value || '';
    const stockFilter = document.getElementById('inv-stock-filter')?.value || '';
    const statusFilter = document.getElementById('inv-status-filter')?.value || '';

    let products = await LoyDB.getAll('products');
    products = Auth.filterByBranch(products);

    if (search) {
      products = Utils.searchFilter(products, search, ['name', 'code', 'gujarati_name', 'category', 'barcode']);
    }
    if (category) products = products.filter(p => p.category === category);
    if (stockFilter) products = products.filter(p => LoyDB.getStockStatus(p) === stockFilter);
    if (statusFilter) products = products.filter(p => p.status === statusFilter);

    this.renderTable(products);
  },

  viewProduct(id) { App.navigate(`inventory/view/${id}`); },
  editProduct(id) { App.navigate(`inventory/edit/${id}`); },

  async deleteProduct(id) {
    const confirmed = await Modal.confirm('Delete Product', 'Are you sure you want to delete this product? This action cannot be undone.', 'danger');
    if (confirmed) {
      await LoyDB.delete('products', id);
      Toast.show('Deleted', 'Product has been deleted', 'success');
      this.filterProducts();
    }
  },

  async renderForm(container, editId = null) {
    const categories = await LoyDB.getAll('categories');
    const suppliers = await LoyDB.getAll('suppliers');
    let product = null;

    if (editId) {
      product = await LoyDB.get('products', editId);
      if (!product) { App.navigate('inventory'); return; }
    }

    const isEdit = !!product;
    const title = isEdit ? 'Edit Product' : 'Add New Product';
    const code = product?.code || await LoyDB.getNextCode('LY-');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${title}</h1>
          <p class="page-subtitle">${isEdit ? 'Update product details' : 'Add a new product to inventory'}</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('inventory')">← Back</button>
        </div>
      </div>

      <form id="product-form" onsubmit="InventoryModule.saveProduct(event, ${editId || 'null'})" class="animate-fadeInUp">
        <div class="card mb-6">
          <div class="card-header"><h4>📋 Basic Information</h4></div>
          <div class="card-body">
            <div class="product-form-grid">
              <div class="form-group">
                <label class="form-label">Item Code</label>
                <input type="text" class="form-control" name="code" value="${product?.code || code}" readonly style="background:var(--bg-secondary)">
              </div>
              <div class="form-group">
                <label class="form-label">Item Name <span class="required">*</span></label>
                <input type="text" class="form-control" name="name" value="${product?.name || ''}" required placeholder="e.g., Vachanamrut">
              </div>
              <div class="form-group">
                <label class="form-label">Gujarati Name</label>
                <input type="text" class="form-control" name="gujarati_name" value="${product?.gujarati_name || ''}" placeholder="ગુજરાતી નામ">
              </div>
              <div class="form-group">
                <label class="form-label">Category <span class="required">*</span></label>
                <select class="form-control" name="category" required>
                  <option value="">Select Category</option>
                  ${categories.map(c => `<option value="${c.name}" ${product?.category === c.name ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Brand</label>
                <input type="text" class="form-control" name="brand" value="${product?.brand || ''}" placeholder="Brand name">
              </div>
              <div class="form-group">
                <label class="form-label">Unit</label>
                <select class="form-control" name="unit">
                  ${['pcs', 'set', 'box', 'pkt', 'kg', 'g', 'ltr', 'ml', 'mtr', 'bottle', 'dozen'].map(u => `<option value="${u}" ${product?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Barcode</label>
                <input type="text" class="form-control" name="barcode" value="${product?.barcode || Utils.generateBarcode()}" placeholder="Barcode number">
              </div>
              <div class="form-group">
                <label class="form-label">HSN Code</label>
                <input type="text" class="form-control" name="hsn" value="${product?.hsn || ''}" placeholder="HSN code">
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-control" name="status">
                  <option value="active" ${product?.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="inactive" ${product?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-6">
          <div class="card-header"><h4>💰 Pricing & Tax</h4></div>
          <div class="card-body">
            <div class="product-form-grid">
              <div class="form-group">
                <label class="form-label">Purchase Price <span class="required">*</span></label>
                <input type="number" class="form-control" name="purchase_price" value="${product?.purchase_price || ''}" required min="0" step="0.01" placeholder="₹0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Selling Price <span class="required">*</span></label>
                <input type="number" class="form-control" name="selling_price" value="${product?.selling_price || ''}" required min="0" step="0.01" placeholder="₹0.00">
              </div>
              <div class="form-group">
                <label class="form-label">MRP</label>
                <input type="number" class="form-control" name="mrp" value="${product?.mrp || ''}" min="0" step="0.01" placeholder="₹0.00">
              </div>
              <div class="form-group">
                <label class="form-label">GST %</label>
                <select class="form-control" name="gst">
                  ${[0, 5, 12, 18, 28].map(g => `<option value="${g}" ${product?.gst == g ? 'selected' : ''}>${g}%</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-6">
          <div class="card-header"><h4>📦 Stock Details</h4></div>
          <div class="card-body">
            <div class="product-form-grid">
              <div class="form-group">
                <label class="form-label">Minimum Stock Level</label>
                <input type="number" class="form-control" name="min_stock" value="${product?.min_stock || 10}" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">Maximum Stock Level</label>
                <input type="number" class="form-control" name="max_stock" value="${product?.max_stock || 100}" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">Current Stock</label>
                <input type="number" class="form-control" name="current_stock" value="${product?.current_stock || 0}" min="0" ${isEdit ? 'readonly style="background:var(--bg-secondary)"' : ''}>
                ${isEdit ? '<div class="form-hint">Use Stock Adjustment to modify stock</div>' : ''}
              </div>
              <div class="form-group">
                <label class="form-label">Warehouse Location</label>
                <input type="text" class="form-control" name="warehouse" value="${product?.warehouse || ''}" placeholder="e.g., A1-01">
              </div>
              <div class="form-group">
                <label class="form-label">Supplier</label>
                <select class="form-control" name="supplier_id">
                  <option value="">No Supplier</option>
                  ${suppliers.map(s => `<option value="${s.id}" ${product?.supplier_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex gap-3 justify-end">
          <button type="button" class="btn btn-outline" onclick="App.navigate('inventory')">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '💾 Update Product' : '➕ Add Product'}</button>
        </div>
      </form>
    `;
  },

  async saveProduct(e, editId) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    // Parse numbers
    ['purchase_price', 'selling_price', 'mrp', 'gst', 'min_stock', 'max_stock', 'current_stock'].forEach(k => {
      data[k] = parseFloat(data[k]) || 0;
    });
    data.supplier_id = data.supplier_id ? parseInt(data.supplier_id) : null;

    // Set branch
    data.branch_id = App.activeBranch || 1;

    // Emoji based on category
    const catEmojis = { Books: '📚', Prasadi: '🙏', 'Puja Samagri': '🪔', Mala: '📿', Chandlo: '🔴', Kumkum: '🟡', Attar: '🌸', Agarbatti: '🕯️', Diyas: '🪔', Vagha: '👗', Idols: '🙏', 'Photo Frames': '🖼️', Calendars: '📅', Stickers: '🏷️', Keychains: '🔑', 'Tulsi Mala': '📿', 'Gift Items': '🎁', 'Festival Items': '🎊', Other: '📦' };
    data.emoji = catEmojis[data.category] || '📦';

    try {
      if (editId) {
        const existing = await LoyDB.get('products', editId);
        Object.assign(existing, data);
        await LoyDB.put('products', existing);
        Toast.show('Updated', 'Product has been updated successfully', 'success');
      } else {
        await LoyDB.add('products', data);
        Toast.show('Added', 'Product has been added to inventory', 'success');
      }
      await Auth.logActivity('inventory', `${editId ? 'Updated' : 'Added'} product: ${data.name}`);
      App.navigate('inventory');
    } catch (err) {
      Toast.show('Error', err.message, 'error');
    }
  },

  async renderDetail(container, id) {
    const product = await LoyDB.get('products', id);
    if (!product) { App.navigate('inventory'); return; }

    const supplier = product.supplier_id ? await LoyDB.get('suppliers', product.supplier_id) : null;
    const stockStatus = LoyDB.getStockStatus(product);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${Utils.escapeHtml(product.name)}</h1>
          <p class="page-subtitle">${product.code} · ${product.category}</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-outline" onclick="App.navigate('inventory')">← Back</button>
          ${Auth.canUpdate() ? `<button class="btn btn-primary" onclick="App.navigate('inventory/edit/${id}')">✏️ Edit</button>` : ''}
          ${Auth.canUpdate() ? `<button class="btn btn-outline-primary" onclick="InventoryModule.stockAdjustment(${id})">📦 Stock Adjustment</button>` : ''}
        </div>
      </div>

      <div class="two-column-layout animate-fadeInUp">
        <div class="card">
          <div class="card-header"><h4>📋 Product Details</h4></div>
          <div class="card-body">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:64px;margin-bottom:8px">${product.emoji || '📦'}</div>
              <h3>${Utils.escapeHtml(product.name)}</h3>
              ${product.gujarati_name ? `<p class="text-secondary">${product.gujarati_name}</p>` : ''}
              <div class="mt-2">${Utils.stockBadge(product)} ${Utils.statusBadge(product.status)}</div>
            </div>
            <table class="data-table">
              <tbody>
                <tr><td class="text-secondary">Code</td><td class="font-mono font-semibold">${product.code}</td></tr>
                <tr><td class="text-secondary">Category</td><td>${product.category}</td></tr>
                <tr><td class="text-secondary">Brand</td><td>${product.brand || '-'}</td></tr>
                <tr><td class="text-secondary">Unit</td><td>${product.unit}</td></tr>
                <tr><td class="text-secondary">Barcode</td><td class="font-mono">${product.barcode || '-'}</td></tr>
                <tr><td class="text-secondary">HSN Code</td><td>${product.hsn || '-'}</td></tr>
                <tr><td class="text-secondary">Warehouse</td><td>${product.warehouse || '-'}</td></tr>
                <tr><td class="text-secondary">Supplier</td><td>${supplier ? supplier.name : '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div class="card mb-4">
            <div class="card-header"><h4>💰 Pricing</h4></div>
            <div class="card-body">
              <table class="data-table">
                <tbody>
                  <tr><td class="text-secondary">Purchase Price</td><td class="font-semibold">${Utils.currency(product.purchase_price)}</td></tr>
                  <tr><td class="text-secondary">Selling Price</td><td class="font-semibold text-saffron">${Utils.currency(product.selling_price)}</td></tr>
                  <tr><td class="text-secondary">MRP</td><td>${Utils.currency(product.mrp)}</td></tr>
                  <tr><td class="text-secondary">GST</td><td>${product.gst}%</td></tr>
                  <tr><td class="text-secondary">Margin</td><td class="text-success font-semibold">${Utils.currency(product.selling_price - product.purchase_price)} (${((product.selling_price - product.purchase_price) / product.purchase_price * 100).toFixed(1)}%)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h4>📦 Stock</h4></div>
            <div class="card-body">
              <table class="data-table">
                <tbody>
                  <tr><td class="text-secondary">Current Stock</td><td class="font-bold" style="font-size:1.5rem;color:${stockStatus === 'out-of-stock' ? 'var(--danger)' : stockStatus === 'low-stock' ? 'var(--warning)' : 'var(--success)'}">${product.current_stock}</td></tr>
                  <tr><td class="text-secondary">Minimum Level</td><td>${product.min_stock}</td></tr>
                  <tr><td class="text-secondary">Maximum Level</td><td>${product.max_stock}</td></tr>
                  <tr><td class="text-secondary">Stock Value</td><td class="font-semibold">${Utils.currency(product.current_stock * product.purchase_price)}</td></tr>
                </tbody>
              </table>
              <div class="mt-4">
                <div class="text-xs text-secondary mb-1">Stock Level</div>
                <div class="progress-bar">
                  <div class="progress-bar-fill ${stockStatus === 'out-of-stock' ? 'danger' : stockStatus === 'low-stock' ? 'warning' : 'success'}" 
                       style="width:${Math.min((product.current_stock / product.max_stock) * 100, 100)}%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async stockAdjustment(productId) {
    const product = await LoyDB.get('products', productId);
    if (!product) return;

    const body = `
      <div class="mb-4">
        <div class="d-flex items-center gap-3 mb-4">
          <span style="font-size:32px">${product.emoji || '📦'}</span>
          <div>
            <div class="font-semibold">${Utils.escapeHtml(product.name)}</div>
            <div class="text-sm text-secondary">Current Stock: <span class="font-bold">${product.current_stock}</span></div>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Adjustment Type</label>
        <select class="form-control" id="adj-type">
          <option value="add">Add Stock</option>
          <option value="remove">Remove Stock</option>
          <option value="set">Set Stock</option>
          <option value="damaged">Mark as Damaged</option>
          <option value="expired">Mark as Expired</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input type="number" class="form-control" id="adj-qty" min="0" value="0">
      </div>
      <div class="form-group">
        <label class="form-label">Reason</label>
        <textarea class="form-control" id="adj-reason" rows="2" placeholder="Reason for adjustment"></textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="InventoryModule.applyAdjustment(${productId})">Apply Adjustment</button>
    `;

    Modal.show('Stock Adjustment', body, 'md');
    // Add footer manually
    const overlay = document.querySelector('.modal-overlay:last-child .modal');
    if (overlay) overlay.insertAdjacentHTML('beforeend', `<div class="modal-footer">${footer}</div>`);
  },

  async applyAdjustment(productId) {
    const type = document.getElementById('adj-type').value;
    const qty = parseInt(document.getElementById('adj-qty').value) || 0;
    const reason = document.getElementById('adj-reason').value;

    if (qty <= 0 && type !== 'set') {
      Toast.show('Error', 'Please enter a valid quantity', 'error');
      return;
    }

    const product = await LoyDB.get('products', productId);
    if (!product) return;

    switch (type) {
      case 'add': product.current_stock += qty; break;
      case 'remove': product.current_stock = Math.max(0, product.current_stock - qty); break;
      case 'set': product.current_stock = qty; break;
      case 'damaged': product.current_stock = Math.max(0, product.current_stock - qty); break;
      case 'expired': product.current_stock = Math.max(0, product.current_stock - qty); break;
    }

    await LoyDB.put('products', product);
    await Auth.logActivity('inventory', `Stock adjusted for ${product.name}: ${type} ${qty} (${reason})`);
    Modal.close();
    Toast.show('Stock Updated', `${product.name} stock is now ${product.current_stock}`, 'success');

    // Refresh page
    const content = document.getElementById('app-content');
    if (content) this.renderDetail(content, productId);
  },

  async exportExcel() {
    const products = await LoyDB.getAll('products');
    const filtered = Auth.filterByBranch(products);

    let csv = 'Code,Name,Gujarati Name,Category,Brand,Unit,HSN,GST%,Purchase Price,Selling Price,MRP,Stock,Min Stock,Max Stock,Warehouse,Status\n';
    filtered.forEach(p => {
      csv += `${p.code},"${p.name}","${p.gujarati_name || ''}",${p.category},"${p.brand || ''}",${p.unit},${p.hsn || ''},${p.gst},${p.purchase_price},${p.selling_price},${p.mrp || ''},${p.current_stock},${p.min_stock},${p.max_stock},"${p.warehouse || ''}",${p.status}\n`;
    });

    Utils.downloadFile(csv, `inventory_${Utils.today()}.csv`, 'text/csv');
    Toast.show('Exported', 'Inventory data exported as CSV', 'success');
  }
};
