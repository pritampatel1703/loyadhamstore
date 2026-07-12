/* ============================================
   POS MODULE (Point of Sale)
   With Hardware Barcode Scanner Auto-Add
   and Mobile Camera Barcode Scanning
   ============================================ */

const POSModule = {
  cart: [],
  products: [],
  categories: [],
  activeCategory: 'All',
  searchQuery: '',
  discount: 0,
  customer: null,

  // Barcode scanner state
  _barcodeBuffer: '',
  _barcodeTimeout: null,
  _scannerListenerActive: false,
  _html5QrCode: null,

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
            <button class="pos-scanner-btn" title="Open Camera Scanner" onclick="POSModule.openCameraScanner()">📷</button>
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

    // Activate hardware barcode scanner listener
    this.startScannerListener();
  },

  // =============================================
  // HARDWARE BARCODE SCANNER — Global Listener
  // Detects rapid keystrokes + Enter as barcode
  // =============================================
  startScannerListener() {
    if (this._scannerListenerActive) return;
    this._scannerListenerActive = true;

    this._keydownHandler = (e) => {
      // Ignore if user is typing in a regular input/textarea (not search)
      const active = document.activeElement;
      const isSearchInput = active && active.id === 'pos-search';
      const isFormInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && !isSearchInput;
      if (isFormInput) return;

      // If Enter key is pressed and we have buffered chars
      if (e.key === 'Enter') {
        if (this._barcodeBuffer.length >= 4) {
          e.preventDefault();
          this.autoAddByBarcode(this._barcodeBuffer.trim());
        }
        this._barcodeBuffer = '';
        clearTimeout(this._barcodeTimeout);
        return;
      }

      // Only accept printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this._barcodeBuffer += e.key;

        // Reset buffer after 100ms of inactivity
        // Hardware scanners type the whole barcode in < 50ms
        clearTimeout(this._barcodeTimeout);
        this._barcodeTimeout = setTimeout(() => {
          this._barcodeBuffer = '';
        }, 100);
      }
    };

    document.addEventListener('keydown', this._keydownHandler);
  },

  stopScannerListener() {
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
    }
    this._scannerListenerActive = false;
    this._barcodeBuffer = '';
  },

  // =============================================
  // AUTO-ADD BY BARCODE
  // Used by both hardware scanner and camera
  // =============================================
  autoAddByBarcode(barcode) {
    barcode = barcode.trim();
    if (!barcode) return;

    // Search by barcode first, then by product code
    const product = this.products.find(p =>
      (p.barcode && p.barcode === barcode) ||
      (p.code && p.code.toUpperCase() === barcode.toUpperCase())
    );

    if (product) {
      this.addToCart(product.id);
      this.playBeep(800, 150); // Success beep
      Toast.show('Scanned', product.name + ' added to cart', 'success');

      // Flash the search input green briefly
      const searchInput = document.getElementById('pos-search');
      if (searchInput) {
        searchInput.style.borderColor = 'var(--success)';
        searchInput.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.2)';
        setTimeout(() => {
          searchInput.style.borderColor = '';
          searchInput.style.boxShadow = '';
        }, 600);
      }
    } else {
      this.playBeep(300, 300); // Error beep (low tone, longer)
      Toast.show('Not Found', 'No product found for barcode: ' + barcode, 'error');
    }
  },

  // Web Audio API beep — no external sound files needed
  playBeep(frequency, duration) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration / 1000);
    } catch (e) {
      // Silently ignore if Audio API is not available
    }
  },

  // =============================================
  // MOBILE CAMERA BARCODE SCANNER
  // Uses html5-qrcode library
  // =============================================
  openCameraScanner() {
    // Check if library is loaded
    if (typeof Html5Qrcode === 'undefined') {
      Toast.show('Not Available', 'Camera scanner library not loaded. Check your internet connection.', 'error');
      return;
    }

    // Create the scanner modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'scanner-overlay';
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = '<div class="scanner-modal">'
      + '<div class="scanner-header">'
      + '<h3>📷 Scan Barcode</h3>'
      + '<button class="scanner-close-btn" onclick="POSModule.closeCameraScanner()">✕</button>'
      + '</div>'
      + '<div id="qr-reader" class="scanner-viewfinder"></div>'
      + '<p class="scanner-hint">Point your camera at a barcode to scan</p>'
      + '</div>';

    document.body.appendChild(overlay);

    // Small delay to let DOM render
    setTimeout(() => {
      this._html5QrCode = new Html5Qrcode('qr-reader');

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 150 },
        aspectRatio: 1.5,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ]
      };

      this._html5QrCode.start(
        { facingMode: 'environment' }, // Use rear camera
        config,
        (decodedText) => {
          // Success callback
          this.closeCameraScanner();
          this.autoAddByBarcode(decodedText);
        },
        () => {
          // Ignore per-frame scan failures (normal behavior)
        }
      ).catch(err => {
        console.error('Camera error:', err);
        this.closeCameraScanner();
        Toast.show('Camera Error', 'Could not access camera. Make sure you are on HTTPS and allow camera permission.', 'error');
      });
    }, 300);
  },

  closeCameraScanner() {
    // Always remove the overlay first so the UI never gets stuck
    const overlay = document.getElementById('scanner-overlay');
    if (overlay) overlay.remove();

    if (this._html5QrCode) {
      try {
        const scanner = this._html5QrCode;
        this._html5QrCode = null;
        scanner.stop().then(() => {
          try { scanner.clear(); } catch(e) {}
        }).catch(() => {
          // Scanner wasn't running — that's fine
        });
      } catch (e) {
        // stop() threw synchronously (scanner never started)
        this._html5QrCode = null;
      }
    }
  },

  // =============================================
  // EXISTING POS LOGIC (unchanged below)
  // =============================================

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
        product_name: p.name,
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
      + '<div class="d-flex gap-3 justify-center flex-wrap">'
      + '<button class="btn btn-outline" onclick="Modal.close()">New Sale</button>'
      + `<button class="btn btn-primary" onclick='POSModule.printReceipt(${JSON.stringify(sale)}, ${JSON.stringify(items)}, "thermal")'><span style="margin-right: 8px;">🧾</span>Thermal Receipt</button>`
      + `<button class="btn btn-primary" onclick='POSModule.printReceipt(${JSON.stringify(sale)}, ${JSON.stringify(items)}, "a4")'><span style="margin-right: 8px;">📄</span>A4 Invoice</button>`
      + '</div>'
      + '<div class="text-center mt-4"><a href="#/sales" onclick="Modal.close()" class="text-primary text-sm" style="text-decoration: underline;">View Sales History</a></div>'
      + '</div>';
    Modal.show('Sale Complete', body, 'md');
  },

  printReceipt(sale, items, format = 'thermal') {
    const container = document.getElementById('print-receipt-container');
    if (!container) return;

    // Inject @page size style dynamically
    let styleTag = document.getElementById('print-page-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'print-page-style';
      document.head.appendChild(styleTag);
    }

    const dateStr = new Date(sale.date).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    if (format === 'a4') {
      styleTag.innerHTML = '@page { size: A4 portrait; margin: 15mm; }';
      container.className = 'invoice-a4';
      container.innerHTML = this.generateA4InvoiceHtml(sale, items, dateStr);
    } else {
      styleTag.innerHTML = '@page { size: 80mm auto; margin: 0; }';
      container.className = 'receipt-thermal';
      container.innerHTML = this.generateThermalReceiptHtml(sale, items, dateStr);
    }

    // Small delay to allow CSS parsing
    setTimeout(() => {
      window.print();
    }, 100);
  },

  generateThermalReceiptHtml(sale, items, dateStr) {
    let itemsHtml = '';
    items.forEach(item => {
      itemsHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <div style="flex: 1;">${item.qty} x ${Utils.currency(item.price)}</div>
          <div>${Utils.currency(item.total)}</div>
        </div>
      `;
    });

    return `
      <div style="padding: 10px; width: 100%; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: bold;">LOYADHAM STORE</h2>
          <div style="font-size: 10px; color: #555;">Thank you for shopping with us!</div>
        </div>
        
        <div style="border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 10px;">
          <div><strong>Inv No:</strong> ${sale.invoice_no}</div>
          <div><strong>Date:</strong> ${dateStr}</div>
          <div><strong>Cashier:</strong> ${sale.user}</div>
        </div>

        <div style="border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px;">
            <div>Item</div>
            <div>Amount</div>
          </div>
          ${itemsHtml}
        </div>

        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between;">
            <div>Subtotal:</div>
            <div>${Utils.currency(sale.subtotal)}</div>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <div>GST:</div>
            <div>${Utils.currency(sale.gst_total)}</div>
          </div>
          ${sale.discount > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <div>Discount:</div>
            <div>-${Utils.currency(sale.discount)}</div>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px;">
            <div>Total:</div>
            <div>${Utils.currency(sale.total)}</div>
          </div>
        </div>

        <div style="text-align: center; font-size: 11px; margin-top: 20px;">
          <div>Payment Mode: <strong>${sale.payment_method.toUpperCase()}</strong></div>
          <div style="margin-top: 10px; font-weight: bold;">*** PLEASE VISIT AGAIN ***</div>
        </div>
      </div>
    `;
  },

  generateA4InvoiceHtml(sale, items, dateStr) {
    let itemsHtml = '';
    items.forEach((item, index) => {
      // Find item name via products db? We didn't pass name in `items`, 
      // let's just display "Product ID: " if name is missing. Wait, we should pass the name!
      // In POSModule.processSale, we only saved product_id in items. 
      // But we CAN look it up or just show ID. For now let's just show it nicely.
      // Wait, in processSale we do have `this.cart` which has `item.product.name`.
      // We should include product name in the `items` array sent to printReceipt!
      // Since it's not there, we will display generic or look it up.
      // I'll update processSale slightly to include product_name in the `items` array sent to printReceipt!
      // For now, assume `item.product_name` exists (I will update processSale).
      itemsHtml += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${index + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.product_name || ('Item #' + item.product_id)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${Utils.currency(item.price)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${Utils.currency(item.total)}</td>
        </tr>
      `;
    });

    return `
      <div style="width: 100%; box-sizing: border-box; font-family: Arial, sans-serif; color: #333;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; font-size: 28px; color: #1a1a1a;">LOYADHAM STORE</h1>
            <p style="margin: 5px 0; color: #555;">123 Business Avenue, City, State 12345</p>
            <p style="margin: 5px 0; color: #555;">Phone: +91 9876543210</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 32px; color: #555; text-transform: uppercase;">Tax Invoice</h2>
          </div>
        </div>

        <!-- Meta Info -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1a1a1a;">Billed To:</h3>
            <p style="margin: 0; color: #555;"><strong>${sale.customer_name || 'Walk-in Customer'}</strong></p>
            ${sale.customer_id ? '<p style="margin: 5px 0; color: #555;">Customer ID: ' + sale.customer_id + '</p>' : ''}
          </div>
          <div style="text-align: right;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 2px 10px; font-weight: bold; text-align: right;">Invoice No:</td>
                <td style="padding: 2px 0; text-align: right;">${sale.invoice_no}</td>
              </tr>
              <tr>
                <td style="padding: 2px 10px; font-weight: bold; text-align: right;">Date:</td>
                <td style="padding: 2px 0; text-align: right;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 2px 10px; font-weight: bold; text-align: right;">Cashier:</td>
                <td style="padding: 2px 0; text-align: right;">${sale.user}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: center; width: 50px;">#</th>
              <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: left;">Description</th>
              <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; width: 120px;">Unit Price</th>
              <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: center; width: 80px;">Qty</th>
              <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; width: 120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Totals & Notes -->
        <div style="display: flex; justify-content: space-between;">
          <div style="width: 50%;">
            <h4 style="margin: 0 0 10px 0;">Payment Details</h4>
            <p style="margin: 5px 0;">Method: <strong>${sale.payment_method.toUpperCase()}</strong></p>
            <p style="margin: 5px 0;">Status: <strong>Paid</strong></p>
          </div>
          <div style="width: 40%;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px; text-align: right;">Subtotal:</td>
                <td style="padding: 5px; text-align: right;">${Utils.currency(sale.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding: 5px; text-align: right;">GST:</td>
                <td style="padding: 5px; text-align: right;">${Utils.currency(sale.gst_total)}</td>
              </tr>
              ${sale.discount > 0 ? `
              <tr>
                <td style="padding: 5px; text-align: right;">Discount:</td>
                <td style="padding: 5px; text-align: right; color: #dc3545;">-${Utils.currency(sale.discount)}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 10px 5px; text-align: right; font-weight: bold; font-size: 18px; border-top: 2px solid #333;">Grand Total:</td>
                <td style="padding: 10px 5px; text-align: right; font-weight: bold; font-size: 18px; border-top: 2px solid #333;">${Utils.currency(sale.total)}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 50px; text-align: center; color: #555; border-top: 1px solid #ddd; padding-top: 20px;">
          <p style="margin: 0;">Thank you for your business!</p>
          <p style="margin: 5px 0; font-size: 12px;">This is a computer-generated invoice and does not require a physical signature.</p>
        </div>

      </div>
    `;
  }
};
