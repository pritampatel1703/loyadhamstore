/* ============================================
   POS MODULE (Point of Sale)
   ============================================ */

const POSModule = {
  cart: [],
  products: [],
  categories: [],
  activeCategory: 'All',
  searchQuery: '',
  discount: 0,
  customer: null,

  async render(container) {
    this.cart = [];
    this.activeCategory = 'All';
    this.searchQuery = '';
    this.discount = 0;
    this.customer = null;

    const allProducts = await LoyDB.getAll('products');
    this.products = Auth.filterByBranch(allProducts).filter(p => p.status === 'active');
    this.categories = await LoyDB.getAll('categories');

    container.innerHTML = `
      <div class="pos-layout animate-fadeInUp">
        
        <!-- Left: Products -->
        <div class="pos-products">
          <div class="pos-search-bar">
            <div class="pos-search-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" class="pos-search-input" id="pos-search" placeholder="Search product by name, code, barcode..." oninput="POSModule.handleSearch(this.value)">
            </div>
            <button class="pos-scanner-btn" title="Barcode Scanner">📷</button>
          </div>
          
          <div class="pos-categories" id="pos-categories"></div>
          <div class="pos-product-grid" id="pos-product-grid"></div>
        </div>

        <!-- Right: Cart -->
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div class="pos-cart-title">Current Order</div>
            <div class="pos-cart-count" id="pos-cart-count">0 items</div>
          </div>
          
          <div class="pos-cart-customer">
            <button class="pos-cart-customer-btn" onclick="POSModule.selectCustomer()" id="pos-customer-btn">
              <span>👤</span>
              <span id="pos-customer-name">Select Customer (Optional)</span>
            </button>
          </div>

          <div class="pos-cart-items" id="pos-cart-items">
            <!-- Empty state default -->
            <div class="pos-cart-empty">
              <div class="empty-icon">🛒</div>
              <div class="empty-text">Cart is empty<br>Add items to start billing</div>
            </div>
          </div>

          <div class="pos-cart-summary">
            <div class="pos-summary-row">
              <span>Subtotal</span>
              <span id="pos-subtotal">₹0.00</span>
            </div>
            <div class="pos-summary-row">
              <span>GST</span>
              <span id="pos-gst">₹0.00</span>
            </div>
            <div class="pos-summary-row text-danger">
              <span>Discount <button class="pos-discount-btn" onclick="POSModule.applyDiscount()">Edit</button></span>
              <span id="pos-discount">-₹0.00</span>
            </div>
            <div class="pos-summary-row total">
              <span>Total</span>
              <span id="pos-total">₹0.00</span>
            </div>
          </div>

          <div class="pos-cart-actions">
            <button class="btn btn-outline-danger" onclick="POSModule.clearCart()">Clear</button>
            <button class="btn btn-primary" style="flex:2" onclick="POSModule.checkout()">Checkout ➔</button>
          </div>
        </div>
      </div>
    `;

    this.renderCategories();
    this.renderProducts();
  },

  renderCategories() {
    const container = document.getElementById('pos-categories');
    if (!container) return;

    let html = '<button class="pos-category-btn ' + (this.activeCategory === 'All' ? 'active' : '') + '" onclick="POSModule.setCategory(\'All\')">All Items</button>';
    
    this.categories.forEach(c => {
      html += '<button class="pos-category-btn ' + (this.activeCategory === c.name ? 'active' : '') + '" onclick="POSModule.setCategory(\'' + c.name + '\')">'
        + c.icon + ' ' + Utils.escapeHtml(c.name) + '</button>';
    });
    
    container.innerHTML = html;
  },

  setCategory(cat) {
    this.activeCategory = cat;
    this.renderCategories();
    this.renderProducts();
  },

  handleSearch(query) {
    this.searchQuery = query.toLowerCase();
    this.renderProducts();
  },

  renderProducts() {
    const container = document.getElementById('pos-product-grid');
    if (!container) return;

    let filtered = this.products;

    if (this.activeCategory !== 'All') {
      filtered = filtered.filter(p => p.category === this.activeCategory);
    }

    if (this.searchQuery) {
      filtered = Utils.searchFilter(filtered, this.searchQuery, ['name', 'code', 'barcode', 'category', 'gujarati_name']);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-tertiary);">No products found</div>';
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const isOutOfStock = p.current_stock <= 0;
      html += '<div class="pos-product-card ' + (isOutOfStock ? 'out-of-stock' : '') + '" onclick="POSModule.addToCart(' + p.id + ')">'
        + '<span class="product-emoji">' + (p.emoji || '📦') + '</span>'
        + '<div class="product-name" title="' + Utils.escapeHtml(p.name) + '">' + Utils.escapeHtml(p.name) + '</div>'
        + '<div class="product-price">' + Utils.currency(p.selling_price) + '</div>'
        + '<div class="product-stock ' + (isOutOfStock ? 'text-danger font-semibold' : '') + '">'
        + (isOutOfStock ? 'Out of Stock' : p.current_stock + ' in stock')
        + '</div></div>';
    });

    container.innerHTML = html;
  },

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    if (product.current_stock <= 0) {
      Toast.show('Out of Stock', product.name + ' is out of stock', 'warning');
      return;
    }

    const existing = this.cart.find(i => i.product.id === productId);
    if (existing) {
      if (existing.qty >= product.current_stock) {
        Toast.show('Stock Limit', 'Cannot add more than available stock', 'warning');
        return;
      }
      existing.qty += 1;
    } else {
      this.cart.push({ product, qty: 1 });
    }

    this.renderCart();
  },

  updateQty(productId, delta) {
    const item = this.cart.find(i => i.product.id === productId);
    if (!item) return;

    const newQty = item.qty + delta;
    
    if (newQty <= 0) {
      this.cart = this.cart.filter(i => i.product.id !== productId);
    } else if (newQty > item.product.current_stock) {
      Toast.show('Stock Limit', 'Cannot add more than available stock', 'warning');
      return;
    } else {
      item.qty = newQty;
    }

    this.renderCart();
  },

  clearCart() {
    if (this.cart.length === 0) return;
    this.cart = [];
    this.discount = 0;
    this.customer = null;
    document.getElementById('pos-customer-name').textContent = 'Select Customer (Optional)';
    this.renderCart();
  },

  applyDiscount() {
    const body = '<div class="form-group">'
      + '<label class="form-label">Discount Amount (₹)</label>'
      + '<input type="number" class="form-control" id="discount-amt" value="' + this.discount + '" min="0" step="0.01">'
      + '</div>';
    
    const footer = '<button class="btn btn-outline" onclick="Modal.close()">Cancel</button>'
      + '<button class="btn btn-primary" onclick="POSModule.saveDiscount()">Apply</button>';
    
    Modal.show('Apply Discount', body, 'sm', footer);
  },

  saveDiscount() {
    const amt = parseFloat(document.getElementById('discount-amt').value) || 0;
    this.discount = amt;
    Modal.close();
    this.renderCart();
  },

  async selectCustomer() {
    const customers = await LoyDB.getAll('customers');
    let body = '<div class="mb-3">'
      + '<input type="text" class="form-control" id="cust-search" placeholder="Search customer by name or phone..." oninput="POSModule.filterCustomers(this.value)">'
      + '</div>'
      + '<div style="max-height: 300px; overflow-y: auto;" id="cust-list">';
    
    customers.forEach(c => {
      body += '<div class="cust-item" style="padding: 10px; border-bottom: 1px solid var(--border-light); cursor: pointer;" onclick="POSModule.setCustomer(' + c.id + ', \'' + Utils.escapeHtml(c.name) + '\')">'
        + '<div class="font-semibold">' + Utils.escapeHtml(c.name) + '</div>'
        + '<div class="text-xs text-secondary">' + (c.phone || 'No phone') + '</div>'
        + '</div>';
    });
    body += '</div>';

    Modal.show('Select Customer', body, 'sm');
  },

  filterCustomers(term) {
    term = term.toLowerCase();
    document.querySelectorAll('.cust-item').forEach(el => {
      const text = el.textContent.toLowerCase();
      el.style.display = text.includes(term) ? 'block' : 'none';
    });
  },

  setCustomer(id, name) {
    this.customer = { id, name };
    document.getElementById('pos-customer-name').textContent = name;
    Modal.close();
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = '<div class="pos-cart-empty">'
        + '<div class="empty-icon">🛒</div>'
        + '<div class="empty-text">Cart is empty<br>Add items to start billing</div>'
        + '</div>';
      document.getElementById('pos-cart-count').textContent = '0 items';
      this.updateTotals(0, 0, 0);
      return;
    }

    let html = '';
    let subtotal = 0;
    let totalGst = 0;

    this.cart.forEach(item => {
      const p = item.product;
      const itemTotal = p.selling_price * item.qty;
      const gstAmt = (itemTotal * p.gst) / (100 + p.gst); // assuming inclusive GST
      
      subtotal += itemTotal - gstAmt;
      totalGst += gstAmt;

      html += '<div class="pos-cart-item animate-fadeInRight" style="animation-duration: 0.2s">'
        + '<div class="pos-cart-item-info">'
        + '<div class="pos-cart-item-name" title="' + Utils.escapeHtml(p.name) + '">' + Utils.escapeHtml(p.name) + '</div>'
        + '<div class="pos-cart-item-price">' + Utils.currency(p.selling_price) + (p.gst ? ' (Inc. ' + p.gst + '% GST)' : '') + '</div>'
        + '</div>'
        + '<div class="pos-cart-item-qty">'
        + '<button onclick="POSModule.updateQty(' + p.id + ', -1)">-</button>'
        + '<span>' + item.qty + '</span>'
        + '<button onclick="POSModule.updateQty(' + p.id + ', 1)">+</button>'
        + '</div>'
        + '<div class="pos-cart-item-total">' + Utils.currency(itemTotal) + '</div>'
        + '<button class="pos-cart-item-remove" onclick="POSModule.updateQty(' + p.id + ', -1000)">✕</button>'
        + '</div>';
    });

    container.innerHTML = html;
    
    const totalItems = this.cart.reduce((sum, i) => sum + i.qty, 0);
    document.getElementById('pos-cart-count').textContent = totalItems + ' items';
    
    // Auto scroll to bottom
    container.scrollTop = container.scrollHeight;

    this.updateTotals(subtotal, totalGst, subtotal + totalGst - this.discount);
  },

  updateTotals(subtotal, gst, total) {
    total = Math.max(0, total); // Prevent negative total
    document.getElementById('pos-subtotal').textContent = Utils.currency(subtotal);
    document.getElementById('pos-gst').textContent = Utils.currency(gst);
    document.getElementById('pos-discount').textContent = '-' + Utils.currency(this.discount);
    document.getElementById('pos-total').textContent = Utils.currency(total);
  },

  checkout() {
    if (this.cart.length === 0) {
      Toast.show('Empty Cart', 'Please add items to cart before checkout', 'error');
      return;
    }

    const total = this.cart.reduce((sum, item) => sum + (item.product.selling_price * item.qty), 0) - this.discount;
    
    const body = '<div class="payment-amount-display">'
      + '<div class="payment-amount-label">Total Amount to Pay</div>'
      + '<div class="payment-amount-value">' + Utils.currency(Math.max(0, total)) + '</div>'
      + '</div>'
      + '<div class="payment-methods">'
      + '<button class="payment-method-btn selected" id="pm-cash" onclick="POSModule.selectPayment(\'cash\')"><span class="method-icon">💵</span><span>Cash</span></button>'
      + '<button class="payment-method-btn" id="pm-upi" onclick="POSModule.selectPayment(\'upi\')"><span class="method-icon">📱</span><span>UPI / QR</span></button>'
      + '<button class="payment-method-btn" id="pm-card" onclick="POSModule.selectPayment(\'card\')"><span class="method-icon">💳</span><span>Card</span></button>'
      + '</div>';

    const footer = '<button class="btn btn-outline" onclick="Modal.close()">Cancel</button>'
      + '<button class="btn btn-primary" onclick="POSModule.processSale()">Complete Sale</button>';
    
    Modal.show('Complete Payment', body, 'md', footer);
    this.selectedPayment = 'cash';
  },

  selectPayment(method) {
    this.selectedPayment = method;
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('pm-' + method).classList.add('selected');
  },

  async processSale() {
    const branchId = Auth.getBranchId() || 1;
    let subtotal = 0;
    let totalGst = 0;
    let total = 0;
    const items = [];

    this.cart.forEach(item => {
      const p = item.product;
      const itemTotal = p.selling_price * item.qty;
      const gstAmt = (itemTotal * p.gst) / (100 + p.gst);
      
      subtotal += itemTotal - gstAmt;
      totalGst += gstAmt;
      total += itemTotal;
      
      items.push({
        product_id: p.id,
        qty: item.qty,
        price: p.selling_price,
        total: itemTotal
      });
    });

    total = Math.max(0, total - this.discount);

    // Generate Invoice No (LY-YYYYMMDD-XXXX)
    const dateStr = Utils.today().replace(/-/g, '');
    const sales = await LoyDB.getAll('sales');
    const todaySales = sales.filter(s => s.invoice_no.includes(dateStr));
    const invNo = 'LY-' + dateStr + '-' + String(todaySales.length + 1).padStart(4, '0');

    const saleRecord = {
      invoice_no: invNo,
      date: new Date().toISOString(),
      customer_id: this.customer ? this.customer.id : null,
      branch_id: branchId,
      user: Auth.getUser().name,
      subtotal,
      gst_total: totalGst,
      discount: this.discount,
      total,
      payment_method: this.selectedPayment,
      status: 'completed'
    };

    try {
      // 1. Create Sale
      const saleId = await LoyDB.add('sales', saleRecord);

      // 2. Add Sale Items & Update Stock
      for (const item of items) {
        item.sale_id = saleId;
        await LoyDB.add('sale_items', item);

        // Update product stock
        const p = await LoyDB.get('products', item.product_id);
        if (p) {
          p.current_stock -= item.qty;
          await LoyDB.put('products', p);
        }
      }

      await Auth.logActivity('sale', 'Sale completed: ' + invNo + ' for ' + Utils.currency(total));
      
      Modal.close();
      Toast.show('Success', 'Sale completed successfully!', 'success');
      
      this.clearCart();
      this.renderProducts(); // Refresh stock in UI
      
      // Optional: Show Print Dialog
      saleRecord.id = saleId;
      this.showPrintDialog(saleRecord, items);
      
    } catch (err) {
      Toast.show('Error', err.message, 'error');
    }
  },

  showPrintDialog(sale, items) {
    // A simple prompt to navigate to the invoice or print
    const body = '<div class="text-center p-6">'
      + '<div style="font-size:48px; margin-bottom: 16px;">✅</div>'
      + '<h3 class="mb-2">Invoice Generated!</h3>'
      + '<p class="text-secondary font-mono mb-6">' + sale.invoice_no + '</p>'
      + '<div class="d-flex gap-3 justify-center">'
      + '<button class="btn btn-outline" onclick="Modal.close()">New Sale</button>'
      + '<button class="btn btn-primary" onclick="App.navigate(\'sales\'); Modal.close();">View Sales</button>'
      + '</div></div>';
    Modal.show('Sale Complete', body, 'sm');
  }
};
