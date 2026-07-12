/* ============================================
   UTILITIES
   Formatting, validation, helpers
   ============================================ */

const Utils = {
  // Currency formatting
  currency(amount) {
    if (amount === null || amount === undefined) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  // Number formatting
  number(n) {
    if (n === null || n === undefined) return '0';
    return Number(n).toLocaleString('en-IN');
  },

  // Percentage
  percent(value, total) {
    if (!total) return '0%';
    return ((value / total) * 100).toFixed(1) + '%';
  },

  // Date formatting
  formatDate(dateStr, format = 'short') {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const options = {
      short: { day: '2-digit', month: 'short', year: 'numeric' },
      long: { day: '2-digit', month: 'long', year: 'numeric' },
      full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
      time: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      timeOnly: { hour: '2-digit', minute: '2-digit' },
      iso: null,
    };
    if (format === 'iso') return d.toISOString().split('T')[0];
    return d.toLocaleDateString('en-IN', options[format] || options.short);
  },

  // Relative time (e.g., "2 hours ago")
  timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return this.formatDate(dateStr);
  },

  // Today's date as ISO string
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // Generate unique ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // Generate barcode-like number
  generateBarcode() {
    return '89' + Array.from({length: 11}, () => Math.floor(Math.random() * 10)).join('');
  },

  // Debounce
  debounce(fn, delay = 300) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // Throttle
  throttle(fn, delay = 100) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  },

  // Deep clone
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // Escape HTML
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Truncate text
  truncate(str, len = 50) {
    if (!str || str.length <= len) return str || '';
    return str.substring(0, len) + '...';
  },

  // Capitalize first letter
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // Title case
  titleCase(str) {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  // Slugify
  slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  },

  // Validate email
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // Validate phone (Indian)
  isValidPhone(phone) {
    return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));
  },

  // Validate GST
  isValidGST(gst) {
    return /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gst);
  },

  // Sort array of objects
  sortBy(arr, key, order = 'asc') {
    return [...arr].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return order === 'asc' ? -1 : 1;
      if (va > vb) return order === 'asc' ? 1 : -1;
      return 0;
    });
  },

  // Group array by key
  groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const val = item[key] || 'Other';
      (groups[val] = groups[val] || []).push(item);
      return groups;
    }, {});
  },

  // Sum array by key
  sumBy(arr, key) {
    return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
  },

  // Filter array by search term across multiple keys
  searchFilter(arr, term, keys) {
    if (!term) return arr;
    const lower = term.toLowerCase();
    return arr.filter(item =>
      keys.some(key => {
        const val = item[key];
        return val && String(val).toLowerCase().includes(lower);
      })
    );
  },

  // Paginate
  paginate(arr, page = 1, perPage = 10) {
    const total = arr.length;
    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    const data = arr.slice(start, start + perPage);
    return { data, total, totalPages, page, perPage, start: start + 1, end: Math.min(start + perPage, total) };
  },

  // Date range filter
  filterByDateRange(arr, dateKey, from, to) {
    return arr.filter(item => {
      const d = new Date(item[dateKey]);
      if (from && d < new Date(from)) return false;
      if (to && d > new Date(to + 'T23:59:59')) return false;
      return true;
    });
  },

  // Get date ranges
  getDateRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (period) {
      case 'today':
        return { from: today, to: now };
      case 'yesterday':
        const y = new Date(today); y.setDate(y.getDate() - 1);
        return { from: y, to: today };
      case 'week':
        const w = new Date(today); w.setDate(w.getDate() - 7);
        return { from: w, to: now };
      case 'month':
        const m = new Date(today); m.setMonth(m.getMonth() - 1);
        return { from: m, to: now };
      case 'quarter':
        const q = new Date(today); q.setMonth(q.getMonth() - 3);
        return { from: q, to: now };
      case 'year':
        const yr = new Date(today); yr.setFullYear(yr.getFullYear() - 1);
        return { from: yr, to: now };
      case 'this_month':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
      case 'this_year':
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      default:
        return { from: null, to: null };
    }
  },

  // Check if date is today
  isToday(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  },

  // Create element helper
  el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
      if (key === 'className') element.className = val;
      else if (key === 'innerHTML') element.innerHTML = val;
      else if (key === 'textContent') element.textContent = val;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), val);
      else if (key === 'style' && typeof val === 'object') Object.assign(element.style, val);
      else if (key === 'dataset') Object.assign(element.dataset, val);
      else element.setAttribute(key, val);
    });
    children.forEach(child => {
      if (typeof child === 'string') element.appendChild(document.createTextNode(child));
      else if (child) element.appendChild(child);
    });
    return element;
  },

  // Get status badge HTML
  statusBadge(status) {
    const map = {
      active: { class: 'badge-success', text: 'Active' },
      inactive: { class: 'badge-gray', text: 'Inactive' },
      completed: { class: 'badge-success', text: 'Completed' },
      pending: { class: 'badge-warning', text: 'Pending' },
      approved: { class: 'badge-info', text: 'Approved' },
      rejected: { class: 'badge-danger', text: 'Rejected' },
      ordered: { class: 'badge-info', text: 'Ordered' },
      received: { class: 'badge-success', text: 'Received' },
      'in-transit': { class: 'badge-warning', text: 'In Transit' },
      paid: { class: 'badge-success', text: 'Paid' },
      partial: { class: 'badge-warning', text: 'Partial' },
      unpaid: { class: 'badge-danger', text: 'Unpaid' },
      issued: { class: 'badge-info', text: 'Issued' },
      upcoming: { class: 'badge-info', text: 'Upcoming' },
      ongoing: { class: 'badge-success', text: 'Ongoing' },
      planning: { class: 'badge-warning', text: 'Planning' },
    };
    const m = map[status] || { class: 'badge-gray', text: status };
    return `<span class="badge ${m.class}">${m.text}</span>`;
  },

  // Stock status badge
  stockBadge(product) {
    const status = LoyDB.getStockStatus(product);
    const map = {
      'in-stock': { class: 'in-stock', text: 'In Stock' },
      'low-stock': { class: 'low-stock', text: 'Low Stock' },
      'out-of-stock': { class: 'out-of-stock', text: 'Out of Stock' },
    };
    const m = map[status];
    return `<span class="stock-indicator ${m.class}">${m.text}</span>`;
  },

  // Payment method badge
  paymentBadge(method) {
    const map = {
      cash: { icon: '💵', text: 'Cash' },
      upi: { icon: '📱', text: 'UPI' },
      card: { icon: '💳', text: 'Card' },
      bank_transfer: { icon: '🏦', text: 'Bank' },
    };
    const m = map[method] || { icon: '💰', text: method };
    return `${m.icon} ${m.text}`;
  },

  // Download as file
  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Export data as JSON (backup)
  async exportBackup() {
    const data = {};
    for (const store of LoyDB.STORES) {
      data[store] = await LoyDB.getAll(store);
    }
    this.downloadFile(JSON.stringify(data, null, 2), `loyadham_backup_${this.today()}.json`, 'application/json');
  },

  // Import backup
  async importBackup(jsonStr) {
    const data = JSON.parse(jsonStr);
    for (const [store, items] of Object.entries(data)) {
      if (LoyDB.STORES.includes(store)) {
        await LoyDB.clear(store);
        for (const item of items) {
          await LoyDB.add(store, item);
        }
      }
    }
  },
};
