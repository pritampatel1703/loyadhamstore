/* ============================================
   LOYADHAM STORE MANAGEMENT
   Firebase Firestore Database Layer
   
   Drop-in replacement for IndexedDB.
   Same API: LoyDB.add(), get(), getAll(), put(), delete()
   All modules work without ANY changes.
   ============================================ */

const LoyDB = {
  db: null, // Firestore instance
  _cache: {}, // In-memory cache for performance
  _counterCache: {}, // Track auto-increment IDs

  STORES: [
    'users', 'branches', 'products', 'categories', 'suppliers', 'customers',
    'sales', 'sale_items', 'purchases', 'purchase_items',
    'stock_transfers', 'internal_issues', 'festivals', 'festival_items',
    'accounts', 'transactions', 'notifications', 'settings', 'activities'
  ],

  async init() {
    try {
      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      this.db = firebase.firestore();
      
      // Enable offline persistence for better performance
      try {
        await this.db.enablePersistence({ synchronizeTabs: true });
      } catch (err) {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence: Multiple tabs open, persistence enabled in first tab only.');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence: Browser does not support persistence.');
        }
      }

      // Pre-load counters
      await this._loadCounters();

      console.log('🔥 Firebase Firestore initialized successfully!');
      return this.db;
    } catch (err) {
      console.error('Firebase init failed:', err);
      throw err;
    }
  },

  // ---- Counter Management (for auto-increment IDs) ----
  async _loadCounters() {
    const counterDoc = await this.db.collection('_meta').doc('counters').get();
    if (counterDoc.exists) {
      this._counterCache = counterDoc.data();
    } else {
      // Initialize counters
      this._counterCache = {};
      this.STORES.forEach(s => { this._counterCache[s] = 0; });
      await this.db.collection('_meta').doc('counters').set(this._counterCache);
    }
  },

  async _nextId(storeName) {
    const current = this._counterCache[storeName] || 0;
    const next = current + 1;
    this._counterCache[storeName] = next;
    // Update in Firestore
    await this.db.collection('_meta').doc('counters').update({
      [storeName]: next
    });
    return next;
  },

  async _syncCounter(storeName) {
    // Make sure counter is >= max existing ID
    const snapshot = await this.db.collection(storeName).orderBy('id', 'desc').limit(1).get();
    if (!snapshot.empty) {
      const maxId = snapshot.docs[0].data().id;
      if (maxId >= (this._counterCache[storeName] || 0)) {
        this._counterCache[storeName] = maxId;
        await this.db.collection('_meta').doc('counters').update({
          [storeName]: maxId
        });
      }
    }
  },

  // ---- CRUD Operations (same API as IndexedDB version) ----

  async add(storeName, data) {
    data.created_at = data.created_at || new Date().toISOString();
    data.updated_at = new Date().toISOString();

    // If data already has an id, use it; otherwise auto-increment
    if (data.id === undefined || data.id === null) {
      data.id = await this._nextId(storeName);
    } else {
      // Ensure counter stays ahead
      if (data.id > (this._counterCache[storeName] || 0)) {
        this._counterCache[storeName] = data.id;
        await this.db.collection('_meta').doc('counters').update({
          [storeName]: data.id
        });
      }
    }

    // Use numeric ID as document key (as string)
    const docRef = this.db.collection(storeName).doc(String(data.id));
    await docRef.set(data);

    // Update cache
    if (this._cache[storeName]) {
      this._cache[storeName] = null; // Invalidate cache
    }

    return data.id;
  },

  async put(storeName, data) {
    data.updated_at = new Date().toISOString();

    if (!data.id) {
      throw new Error('Cannot update without id');
    }

    const docRef = this.db.collection(storeName).doc(String(data.id));
    await docRef.set(data, { merge: false });

    // Invalidate cache
    if (this._cache[storeName]) {
      this._cache[storeName] = null;
    }

    return data.id;
  },

  async get(storeName, id) {
    if (id === undefined || id === null) return null;

    const docRef = this.db.collection(storeName).doc(String(id));
    const doc = await docRef.get();

    if (doc.exists) {
      return doc.data();
    }
    return undefined;
  },

  async getAll(storeName) {
    // Use cache if available (invalidated on writes)
    if (this._cache[storeName]) {
      return [...this._cache[storeName]];
    }

    const snapshot = await this.db.collection(storeName).get();
    const results = [];
    snapshot.forEach(doc => {
      results.push(doc.data());
    });

    // Sort by id for consistent ordering
    results.sort((a, b) => (a.id || 0) - (b.id || 0));

    // Cache it
    this._cache[storeName] = results;
    return [...results];
  },

  async delete(storeName, id) {
    if (id === undefined || id === null) return;

    const docRef = this.db.collection(storeName).doc(String(id));
    await docRef.delete();

    // Invalidate cache
    this._cache[storeName] = null;
  },

  async clear(storeName) {
    const snapshot = await this.db.collection(storeName).get();
    const batch = this.db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Reset counter
    this._counterCache[storeName] = 0;
    await this.db.collection('_meta').doc('counters').update({
      [storeName]: 0
    });

    // Invalidate cache
    this._cache[storeName] = null;
  },

  async count(storeName) {
    const snapshot = await this.db.collection(storeName).get();
    return snapshot.size;
  },

  async getByIndex(storeName, indexName, value) {
    const snapshot = await this.db.collection(storeName)
      .where(indexName, '==', value)
      .get();
    const results = [];
    snapshot.forEach(doc => {
      results.push(doc.data());
    });
    return results;
  },

  async query(storeName, filterFn) {
    const all = await this.getAll(storeName);
    return filterFn ? all.filter(filterFn) : all;
  },

  // Invalidate all caches (useful after bulk operations)
  clearCache() {
    this._cache = {};
  },

  // ---- Seed Demo Data ----
  async seed() {
    const count = await this.count('users');
    if (count > 0) return; // Already seeded

    console.log('🌱 Seeding Loyadham Store database...');

    // Branches
    const branches = [
      { id: 1, name: 'Loyadham Rajkot', code: 'RJK', address: 'Loyadham Temple, University Road, Rajkot', phone: '0281-2445566', email: 'rajkot@loyadham.org', manager: 'Rameshbhai Patel', status: 'active' },
      { id: 2, name: 'Loyadham Ahmedabad', code: 'AMD', address: 'Loyadham Temple, SG Highway, Ahmedabad', phone: '079-26851234', email: 'ahmedabad@loyadham.org', manager: 'Maheshbhai Shah', status: 'active' },
      { id: 3, name: 'Loyadham Surat', code: 'SUR', address: 'Loyadham Temple, Ring Road, Surat', phone: '0261-2540088', email: 'surat@loyadham.org', manager: 'Dineshbhai Desai', status: 'active' },
    ];

    // Users
    const users = [
      { id: 1, name: 'Admin', username: 'admin', password: 'admin123', role: 'super_admin', branch_id: null, email: 'admin@loyadham.org', phone: '9876543210', status: 'active', avatar: 'A' },
      { id: 2, name: 'Rameshbhai Patel', username: 'ramesh', password: 'ramesh123', role: 'store_manager', branch_id: 1, email: 'ramesh@loyadham.org', phone: '9876543211', status: 'active', avatar: 'RP' },
      { id: 3, name: 'Maheshbhai Shah', username: 'mahesh', password: 'mahesh123', role: 'branch_manager', branch_id: 2, email: 'mahesh@loyadham.org', phone: '9876543212', status: 'active', avatar: 'MS' },
      { id: 4, name: 'Priya Sharma', username: 'priya', password: 'priya123', role: 'cashier', branch_id: 1, email: 'priya@loyadham.org', phone: '9876543213', status: 'active', avatar: 'PS' },
      { id: 5, name: 'Suresh Kumar', username: 'suresh', password: 'suresh123', role: 'inventory_manager', branch_id: 1, email: 'suresh@loyadham.org', phone: '9876543214', status: 'active', avatar: 'SK' },
      { id: 6, name: 'Neha Patel', username: 'neha', password: 'neha123', role: 'accountant', branch_id: 1, email: 'neha@loyadham.org', phone: '9876543215', status: 'active', avatar: 'NP' },
      { id: 7, name: 'Viewer', username: 'viewer', password: 'viewer123', role: 'read_only', branch_id: 1, email: 'viewer@loyadham.org', phone: '9876543216', status: 'active', avatar: 'V' },
    ];

    // Categories
    const categories = [
      { id: 1, name: 'Books', icon: '📚', color: '#FF9933', item_count: 0 },
      { id: 2, name: 'Prasadi', icon: '🙏', color: '#8B1E3F', item_count: 0 },
      { id: 3, name: 'Puja Samagri', icon: '🪔', color: '#E67E22', item_count: 0 },
      { id: 4, name: 'Mala', icon: '📿', color: '#9B59B6', item_count: 0 },
      { id: 5, name: 'Chandlo', icon: '🔴', color: '#E74C3C', item_count: 0 },
      { id: 6, name: 'Kumkum', icon: '🟡', color: '#F39C12', item_count: 0 },
      { id: 7, name: 'Attar', icon: '🌸', color: '#1ABC9C', item_count: 0 },
      { id: 8, name: 'Agarbatti', icon: '🕯️', color: '#795548', item_count: 0 },
      { id: 9, name: 'Diyas', icon: '🪔', color: '#FF5722', item_count: 0 },
      { id: 10, name: 'Vagha', icon: '👗', color: '#673AB7', item_count: 0 },
      { id: 11, name: 'Idols', icon: '🙏', color: '#FF9800', item_count: 0 },
      { id: 12, name: 'Photo Frames', icon: '🖼️', color: '#2196F3', item_count: 0 },
      { id: 13, name: 'Calendars', icon: '📅', color: '#4CAF50', item_count: 0 },
      { id: 14, name: 'Stickers', icon: '🏷️', color: '#00BCD4', item_count: 0 },
      { id: 15, name: 'Keychains', icon: '🔑', color: '#607D8B', item_count: 0 },
      { id: 16, name: 'Tulsi Mala', icon: '📿', color: '#4CAF50', item_count: 0 },
      { id: 17, name: 'Gift Items', icon: '🎁', color: '#E91E63', item_count: 0 },
      { id: 18, name: 'Festival Items', icon: '🎊', color: '#FF9933', item_count: 0 },
      { id: 19, name: 'Other', icon: '📦', color: '#9E9E9E', item_count: 0 },
    ];

    // Products
    const products = [
      { id: 1, code: 'LY-BK-001', name: 'Vachanamrut', gujarati_name: 'વચનામૃત', category: 'Books', brand: 'Loyadham Publications', unit: 'pcs', hsn: '4901', gst: 0, purchase_price: 120, selling_price: 200, mrp: 200, min_stock: 20, max_stock: 200, current_stock: 85, branch_id: 1, supplier_id: 1, warehouse: 'A1-01', status: 'active', emoji: '📕', barcode: '8901234560011' },
      { id: 2, code: 'LY-BK-002', name: 'Shikshapatri', gujarati_name: 'શિક્ષાપત્રી', category: 'Books', brand: 'Loyadham Publications', unit: 'pcs', hsn: '4901', gst: 0, purchase_price: 50, selling_price: 80, mrp: 80, min_stock: 30, max_stock: 300, current_stock: 120, branch_id: 1, supplier_id: 1, warehouse: 'A1-02', status: 'active', emoji: '📗', barcode: '8901234560012' },
      { id: 3, code: 'LY-BK-003', name: 'Satsang Diksha', gujarati_name: 'સત્સંગ દીક્ષા', category: 'Books', brand: 'Loyadham Publications', unit: 'pcs', hsn: '4901', gst: 0, purchase_price: 200, selling_price: 350, mrp: 350, min_stock: 10, max_stock: 100, current_stock: 42, branch_id: 1, supplier_id: 1, warehouse: 'A1-03', status: 'active', emoji: '📘', barcode: '8901234560013' },
      { id: 4, code: 'LY-PR-001', name: 'Prasadi Ladoo', gujarati_name: 'પ્રસાદી લાડુ', category: 'Prasadi', brand: 'Loyadham Kitchen', unit: 'box', hsn: '1704', gst: 5, purchase_price: 100, selling_price: 150, mrp: 150, min_stock: 50, max_stock: 500, current_stock: 180, branch_id: 1, supplier_id: null, warehouse: 'B1-01', status: 'active', emoji: '🍬', barcode: '8901234560014' },
      { id: 5, code: 'LY-PR-002', name: 'Prasadi Peda', gujarati_name: 'પ્રસાદી પેંડા', category: 'Prasadi', brand: 'Loyadham Kitchen', unit: 'box', hsn: '1704', gst: 5, purchase_price: 80, selling_price: 120, mrp: 120, min_stock: 50, max_stock: 500, current_stock: 210, branch_id: 1, supplier_id: null, warehouse: 'B1-02', status: 'active', emoji: '🍪', barcode: '8901234560015' },
      { id: 6, code: 'LY-PJ-001', name: 'Puja Thali Set', gujarati_name: 'પૂજા થાળી સેટ', category: 'Puja Samagri', brand: 'Shubh', unit: 'set', hsn: '7323', gst: 12, purchase_price: 250, selling_price: 450, mrp: 499, min_stock: 10, max_stock: 100, current_stock: 35, branch_id: 1, supplier_id: 2, warehouse: 'C1-01', status: 'active', emoji: '🪔', barcode: '8901234560016' },
      { id: 7, code: 'LY-PJ-002', name: 'Camphor (Kapur)', gujarati_name: 'કપૂર', category: 'Puja Samagri', brand: 'Mangalam', unit: 'pkt', hsn: '2914', gst: 18, purchase_price: 30, selling_price: 50, mrp: 50, min_stock: 100, max_stock: 1000, current_stock: 450, branch_id: 1, supplier_id: 2, warehouse: 'C1-02', status: 'active', emoji: '⬜', barcode: '8901234560017' },
      { id: 8, code: 'LY-ML-001', name: 'Tulsi Mala (108 beads)', gujarati_name: 'તુલસી માળા', category: 'Tulsi Mala', brand: 'Vrindavan', unit: 'pcs', hsn: '9602', gst: 0, purchase_price: 60, selling_price: 100, mrp: 120, min_stock: 25, max_stock: 200, current_stock: 8, branch_id: 1, supplier_id: 3, warehouse: 'D1-01', status: 'active', emoji: '📿', barcode: '8901234560018' },
      { id: 9, code: 'LY-ML-002', name: 'Rudraksha Mala', gujarati_name: 'રુદ્રાક્ષ માળા', category: 'Mala', brand: 'Nepal Imports', unit: 'pcs', hsn: '9602', gst: 0, purchase_price: 200, selling_price: 500, mrp: 599, min_stock: 10, max_stock: 50, current_stock: 3, branch_id: 1, supplier_id: 3, warehouse: 'D1-02', status: 'active', emoji: '📿', barcode: '8901234560019' },
      { id: 10, code: 'LY-AG-001', name: 'Chandan Agarbatti', gujarati_name: 'ચંદન અગરબત્તી', category: 'Agarbatti', brand: 'Cycle', unit: 'pkt', hsn: '3307', gst: 12, purchase_price: 25, selling_price: 40, mrp: 45, min_stock: 100, max_stock: 1000, current_stock: 320, branch_id: 1, supplier_id: 2, warehouse: 'E1-01', status: 'active', emoji: '🕯️', barcode: '8901234560020' },
      { id: 11, code: 'LY-AG-002', name: 'Gulab Agarbatti', gujarati_name: 'ગુલાબ અગરબત્તી', category: 'Agarbatti', brand: 'Hem', unit: 'pkt', hsn: '3307', gst: 12, purchase_price: 20, selling_price: 35, mrp: 40, min_stock: 100, max_stock: 1000, current_stock: 280, branch_id: 1, supplier_id: 2, warehouse: 'E1-02', status: 'active', emoji: '🌹', barcode: '8901234560021' },
      { id: 12, code: 'LY-VG-001', name: 'Vagha Set - Small', gujarati_name: 'વાઘા સેટ - નાનો', category: 'Vagha', brand: 'Loyadham', unit: 'set', hsn: '6117', gst: 5, purchase_price: 300, selling_price: 600, mrp: 699, min_stock: 5, max_stock: 50, current_stock: 18, branch_id: 1, supplier_id: 4, warehouse: 'F1-01', status: 'active', emoji: '👗', barcode: '8901234560022' },
      { id: 13, code: 'LY-VG-002', name: 'Vagha Set - Large', gujarati_name: 'વાઘા સેટ - મોટો', category: 'Vagha', brand: 'Loyadham', unit: 'set', hsn: '6117', gst: 5, purchase_price: 500, selling_price: 1000, mrp: 1200, min_stock: 3, max_stock: 30, current_stock: 2, branch_id: 1, supplier_id: 4, warehouse: 'F1-02', status: 'active', emoji: '👔', barcode: '8901234560023' },
      { id: 14, code: 'LY-ID-001', name: 'Swaminarayan Murti - Marble 6"', gujarati_name: 'સ્વામિનારાયણ મૂર્તિ', category: 'Idols', brand: 'Jaipur Craft', unit: 'pcs', hsn: '6802', gst: 12, purchase_price: 800, selling_price: 1500, mrp: 1800, min_stock: 5, max_stock: 30, current_stock: 12, branch_id: 1, supplier_id: 5, warehouse: 'G1-01', status: 'active', emoji: '🙏', barcode: '8901234560024' },
      { id: 15, code: 'LY-PF-001', name: 'Photo Frame - Guruji 8x10', gujarati_name: 'ફોટો ફ્રેમ', category: 'Photo Frames', brand: 'Loyadham', unit: 'pcs', hsn: '4911', gst: 12, purchase_price: 100, selling_price: 200, mrp: 250, min_stock: 15, max_stock: 100, current_stock: 45, branch_id: 1, supplier_id: 5, warehouse: 'H1-01', status: 'active', emoji: '🖼️', barcode: '8901234560025' },
      { id: 16, code: 'LY-KC-001', name: 'Om Keychain', gujarati_name: 'ઓમ કીચેઈન', category: 'Keychains', brand: 'Loyadham', unit: 'pcs', hsn: '7326', gst: 18, purchase_price: 15, selling_price: 30, mrp: 30, min_stock: 50, max_stock: 500, current_stock: 190, branch_id: 1, supplier_id: 5, warehouse: 'H1-02', status: 'active', emoji: '🔑', barcode: '8901234560026' },
      { id: 17, code: 'LY-CH-001', name: 'Chandlo Packet (Kumkum)', gujarati_name: 'ચાંદલો', category: 'Chandlo', brand: 'Loyadham', unit: 'pkt', hsn: '3304', gst: 18, purchase_price: 10, selling_price: 20, mrp: 25, min_stock: 200, max_stock: 2000, current_stock: 650, branch_id: 1, supplier_id: 2, warehouse: 'I1-01', status: 'active', emoji: '🔴', barcode: '8901234560027' },
      { id: 18, code: 'LY-AT-001', name: 'Rose Attar (10ml)', gujarati_name: 'ગુલાબ અત્તર', category: 'Attar', brand: 'Kannauj', unit: 'bottle', hsn: '3303', gst: 18, purchase_price: 80, selling_price: 150, mrp: 180, min_stock: 20, max_stock: 200, current_stock: 55, branch_id: 1, supplier_id: 6, warehouse: 'J1-01', status: 'active', emoji: '🌸', barcode: '8901234560028' },
      { id: 19, code: 'LY-DY-001', name: 'Brass Diya Set (5 pcs)', gujarati_name: 'પિત્તળ દિવા સેટ', category: 'Diyas', brand: 'Moradabad', unit: 'set', hsn: '7418', gst: 12, purchase_price: 120, selling_price: 250, mrp: 299, min_stock: 10, max_stock: 100, current_stock: 0, branch_id: 1, supplier_id: 5, warehouse: 'K1-01', status: 'active', emoji: '🪔', barcode: '8901234560029' },
      { id: 20, code: 'LY-GF-001', name: 'Gift Hamper - Devotional', gujarati_name: 'ભેટ હેમ્પર', category: 'Gift Items', brand: 'Loyadham', unit: 'set', hsn: '4911', gst: 12, purchase_price: 300, selling_price: 600, mrp: 750, min_stock: 5, max_stock: 50, current_stock: 15, branch_id: 1, supplier_id: null, warehouse: 'L1-01', status: 'active', emoji: '🎁', barcode: '8901234560030' },
      { id: 21, code: 'LY-CL-001', name: 'Loyadham Calendar 2026', gujarati_name: 'લોયધામ કેલેન્ડર', category: 'Calendars', brand: 'Loyadham', unit: 'pcs', hsn: '4910', gst: 12, purchase_price: 30, selling_price: 50, mrp: 50, min_stock: 100, max_stock: 2000, current_stock: 850, branch_id: 1, supplier_id: 1, warehouse: 'M1-01', status: 'active', emoji: '📅', barcode: '8901234560031' },
      { id: 22, code: 'LY-ST-001', name: 'Swaminarayan Sticker Set', gujarati_name: 'સ્ટીકર સેટ', category: 'Stickers', brand: 'Loyadham', unit: 'set', hsn: '4911', gst: 12, purchase_price: 10, selling_price: 20, mrp: 25, min_stock: 100, max_stock: 1000, current_stock: 420, branch_id: 1, supplier_id: 1, warehouse: 'M1-02', status: 'active', emoji: '🏷️', barcode: '8901234560032' },
      { id: 23, code: 'LY-KK-001', name: 'Kumkum Box (100g)', gujarati_name: 'કુમકુમ', category: 'Kumkum', brand: 'Loyadham', unit: 'box', hsn: '3304', gst: 18, purchase_price: 25, selling_price: 50, mrp: 60, min_stock: 50, max_stock: 500, current_stock: 180, branch_id: 1, supplier_id: 2, warehouse: 'I1-02', status: 'active', emoji: '🟡', barcode: '8901234560033' },
      { id: 24, code: 'LY-FI-001', name: 'Janmashtami Decoration Kit', gujarati_name: 'જન્માષ્ટમી સજાવટ', category: 'Festival Items', brand: 'Loyadham', unit: 'set', hsn: '9505', gst: 12, purchase_price: 150, selling_price: 300, mrp: 350, min_stock: 20, max_stock: 200, current_stock: 5, branch_id: 1, supplier_id: 5, warehouse: 'N1-01', status: 'active', emoji: '🎊', barcode: '8901234560034' },
      { id: 25, code: 'LY-FI-002', name: 'Annakut Thali Set', gujarati_name: 'અન્નકૂટ થાળી', category: 'Festival Items', brand: 'Loyadham', unit: 'set', hsn: '7323', gst: 12, purchase_price: 200, selling_price: 400, mrp: 450, min_stock: 10, max_stock: 100, current_stock: 28, branch_id: 1, supplier_id: 5, warehouse: 'N1-02', status: 'active', emoji: '🍽️', barcode: '8901234560035' },
    ];

    // Suppliers
    const suppliers = [
      { id: 1, name: 'Loyadham Press', contact: 'Jayeshbhai', phone: '9898765432', email: 'press@loyadham.org', gst: '24ABCDE1234F1Z5', address: 'Press Lane, Rajkot', city: 'Rajkot', state: 'Gujarat', balance: 15000, status: 'active' },
      { id: 2, name: 'Shubh Traders', contact: 'Kamleshbhai', phone: '9898765433', email: 'shubh@traders.com', gst: '24FGHIJ5678K2L6', address: 'Market Road, Ahmedabad', city: 'Ahmedabad', state: 'Gujarat', balance: 8500, status: 'active' },
      { id: 3, name: 'Vrindavan Mala House', contact: 'Gopalbhai', phone: '9898765434', email: 'mala@vrindavan.com', gst: '09MNOPQ9012R3S7', address: 'Temple Road, Vrindavan', city: 'Mathura', state: 'UP', balance: 3200, status: 'active' },
      { id: 4, name: 'Gujarat Textiles', contact: 'Bharatbhai', phone: '9898765435', email: 'guj@textiles.com', gst: '24RSTUV3456W4X8', address: 'Textile Market, Surat', city: 'Surat', state: 'Gujarat', balance: 22000, status: 'active' },
      { id: 5, name: 'Divine Crafts', contact: 'Ankitbhai', phone: '9898765436', email: 'divine@crafts.com', gst: '27WXYZ78901A5B9', address: 'Craft Colony, Jaipur', city: 'Jaipur', state: 'Rajasthan', balance: 12000, status: 'active' },
      { id: 6, name: 'Kannauj Attar Works', contact: 'Irfanbhai', phone: '9898765437', email: 'kannauj@attar.com', gst: '09CDEFG2345H6I0', address: 'Attar Market, Kannauj', city: 'Kannauj', state: 'UP', balance: 5000, status: 'active' },
    ];

    // Customers
    const customers = [
      { id: 1, name: 'Devotee Walk-in', phone: '', address: '', city: 'Rajkot', state: 'Gujarat', balance: 0, loyalty_points: 0, notes: 'Default walk-in customer', branch_id: 1 },
      { id: 2, name: 'Jigneshbhai Patel', phone: '9876500001', address: '12, Sardar Nagar', city: 'Rajkot', state: 'Gujarat', balance: 0, loyalty_points: 250, notes: 'Regular devotee', branch_id: 1 },
      { id: 3, name: 'Meenaben Shah', phone: '9876500002', address: '45, Jubilee Garden', city: 'Rajkot', state: 'Gujarat', balance: 500, loyalty_points: 180, notes: 'Bulk purchaser', branch_id: 1 },
      { id: 4, name: 'Hiteshbhai Desai', phone: '9876500003', address: '78, University Road', city: 'Rajkot', state: 'Gujarat', balance: 0, loyalty_points: 420, notes: 'Monthly visitor', branch_id: 1 },
      { id: 5, name: 'Kokilaben Modi', phone: '9876500004', address: '23, Ring Road', city: 'Ahmedabad', state: 'Gujarat', balance: 200, loyalty_points: 90, notes: '', branch_id: 2 },
    ];

    // Sample sales for last 30 days
    const sales = [];
    const saleItems = [];
    const now = new Date();
    let saleId = 1;
    let saleItemId = 1;

    for (let d = 29; d >= 0; d--) {
      const salesCount = Math.floor(Math.random() * 5) + 2;
      for (let s = 0; s < salesCount; s++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        date.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
        const itemCount = Math.floor(Math.random() * 4) + 1;
        let subtotal = 0;
        const saleItemsList = [];
        for (let i = 0; i < itemCount; i++) {
          const prod = products[Math.floor(Math.random() * products.length)];
          const qty = Math.floor(Math.random() * 3) + 1;
          const total = prod.selling_price * qty;
          subtotal += total;
          saleItemsList.push({
            id: saleItemId++,
            ref_id: saleId,
            sale_id: saleId,
            product_id: prod.id,
            product_name: prod.name,
            price: prod.selling_price,
            qty,
            total,
            gst: prod.gst
          });
        }
        const discount = Math.random() > 0.8 ? Math.floor(subtotal * 0.05) : 0;
        const gstAmount = Math.floor(subtotal * 0.05);
        const grandTotal = subtotal - discount + gstAmount;
        const payMethods = ['cash', 'upi', 'card', 'cash', 'cash', 'upi'];
        sales.push({
          id: saleId,
          invoice_no: 'LY-INV-' + String(saleId).padStart(5, '0'),
          date: date.toISOString(),
          customer_id: customers[Math.floor(Math.random() * customers.length)].id,
          branch_id: 1,
          subtotal,
          gst_total: gstAmount,
          discount,
          total: grandTotal,
          payment_method: payMethods[Math.floor(Math.random() * payMethods.length)],
          status: 'completed',
          cashier_id: 4,
          type: 'counter',
          items_count: itemCount,
          user: 'Priya Sharma',
        });
        saleItems.push(...saleItemsList);
        saleId++;
      }
    }

    // Purchases
    const purchases = [
      { id: 1, po_number: 'LY-PO-00001', date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), supplier_id: 1, branch_id: 1, subtotal: 25000, gst: 0, total: 25000, status: 'received', payment_status: 'paid', notes: 'Monthly book restock' },
      { id: 2, po_number: 'LY-PO-00002', date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(), supplier_id: 2, branch_id: 1, subtotal: 12000, gst: 1440, total: 13440, status: 'received', payment_status: 'partial', paid_amount: 8000, notes: 'Puja items restock' },
      { id: 3, po_number: 'LY-PO-00003', date: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(), supplier_id: 5, branch_id: 1, subtotal: 35000, gst: 4200, total: 39200, status: 'ordered', payment_status: 'unpaid', notes: 'Festival preparation' },
    ];

    // Festivals
    const festivals = [
      { id: 1, name: 'Janmashtami 2026', date_from: '2026-08-14', date_to: '2026-08-15', status: 'upcoming', budget: 50000, spent: 0, sales: 0, notes: 'Annual Janmashtami celebration', branch_id: 1 },
      { id: 2, name: 'Guru Purnima 2026', date_from: '2026-07-21', date_to: '2026-07-21', status: 'upcoming', budget: 25000, spent: 0, sales: 0, notes: 'Guru Purnima event', branch_id: 1 },
      { id: 3, name: 'Annakut 2026', date_from: '2026-10-22', date_to: '2026-10-23', status: 'planning', budget: 75000, spent: 0, sales: 0, notes: 'Annakut Mahotsav', branch_id: 1 },
    ];

    // Internal Issues
    const internalIssues = [
      { id: 1, product_id: 10, product_name: 'Chandan Agarbatti', quantity: 20, department: 'Temple', requested_by: 'Mahantswami', approved_by: 'Admin', purpose: 'Daily Aarti', date: new Date().toISOString(), status: 'approved', branch_id: 1 },
      { id: 2, product_id: 4, product_name: 'Prasadi Ladoo', quantity: 50, department: 'Kitchen', requested_by: 'Rameshbhai', approved_by: 'Admin', purpose: 'Sunday Sabha', date: new Date().toISOString(), status: 'issued', branch_id: 1 },
      { id: 3, product_id: 17, product_name: 'Chandlo Packet (Kumkum)', quantity: 10, department: 'Guest House', requested_by: 'Sureshbhai', approved_by: '', purpose: 'Guest Welcome', date: new Date().toISOString(), status: 'pending', branch_id: 1 },
    ];

    // Notifications
    const notifications = [
      { id: 1, type: 'low_stock', title: 'Low Stock Alert', message: 'Tulsi Mala (108 beads) has only 8 units remaining', read: false, date: new Date().toISOString(), icon: '⚠️' },
      { id: 2, type: 'low_stock', title: 'Low Stock Alert', message: 'Rudraksha Mala has only 3 units remaining', read: false, date: new Date().toISOString(), icon: '⚠️' },
      { id: 3, type: 'out_of_stock', title: 'Out of Stock', message: 'Brass Diya Set (5 pcs) is out of stock', read: false, date: new Date().toISOString(), icon: '🚫' },
      { id: 4, type: 'low_stock', title: 'Low Stock Alert', message: 'Vagha Set - Large has only 2 units remaining', read: false, date: new Date().toISOString(), icon: '⚠️' },
      { id: 5, type: 'pending_transfer', title: 'Pending Transfer', message: 'Stock transfer request from Ahmedabad branch', read: false, date: new Date().toISOString(), icon: '🔄' },
      { id: 6, type: 'payment', title: 'Payment Reminder', message: 'Outstanding payment of ₹5,440 to Shubh Traders', read: true, date: new Date(Date.now() - 86400000).toISOString(), icon: '💰' },
      { id: 7, type: 'festival', title: 'Festival Reminder', message: 'Guru Purnima is in 9 days. Check stock levels.', read: true, date: new Date(Date.now() - 86400000).toISOString(), icon: '🎊' },
    ];

    // Activities
    const activities = [
      { id: 1, type: 'sale', text: 'Sale #LY-INV-00089 completed - ₹1,250', date: new Date().toISOString(), user: 'Priya Sharma', branch_id: 1 },
      { id: 2, type: 'purchase', text: 'Purchase order PO-00003 created for Divine Crafts', date: new Date(Date.now() - 3600000).toISOString(), user: 'Suresh Kumar', branch_id: 1 },
      { id: 3, type: 'transfer', text: 'Stock transfer #TRF-001 requested to Ahmedabad', date: new Date(Date.now() - 7200000).toISOString(), user: 'Admin', branch_id: 1 },
      { id: 4, type: 'alert', text: 'Brass Diya Set marked as out of stock', date: new Date(Date.now() - 10800000).toISOString(), user: 'System', branch_id: 1 },
      { id: 5, type: 'user', text: 'Neha Patel logged in', date: new Date(Date.now() - 14400000).toISOString(), user: 'System', branch_id: 1 },
    ];

    // Settings
    const settings = [
      { id: 1, key: 'org_name', value: 'Loyadham Organization' },
      { id: 2, key: 'org_address', value: 'Temple Road, Rajkot, Gujarat - 360005' },
      { id: 3, key: 'org_phone', value: '0281-2445566' },
      { id: 4, key: 'org_email', value: 'info@loyadham.org' },
      { id: 5, key: 'org_gst', value: '24AABCT1234A1ZX' },
      { id: 6, key: 'financial_year', value: '2026-2027' },
      { id: 7, key: 'currency', value: 'INR' },
      { id: 8, key: 'invoice_prefix', value: 'LY-INV-' },
      { id: 9, key: 'po_prefix', value: 'LY-PO-' },
    ];

    // Stock transfers
    const transfers = [
      { id: 1, transfer_no: 'LY-TRF-001', from_branch: 1, to_branch: 2, date: new Date().toISOString(), status: 'pending', items: [{ product_id: 1, product_name: 'Vachanamrut', qty: 20 }, { product_id: 10, product_name: 'Chandan Agarbatti', qty: 50 }], requested_by: 'Admin', approved_by: '', notes: 'Monthly restock for AMD branch' },
    ];

    // Account entries
    const accountEntries = [
      { id: 1, type: 'income', category: 'Store Sales', amount: 45000, date: new Date().toISOString(), description: 'Daily sales collection', payment_mode: 'cash', branch_id: 1, reference: 'Daily Closing' },
      { id: 2, type: 'income', category: 'Store Sales', amount: 12000, date: new Date().toISOString(), description: 'UPI collections', payment_mode: 'upi', branch_id: 1, reference: 'Daily Closing' },
      { id: 3, type: 'expense', category: 'Electricity', amount: 3500, date: new Date(Date.now() - 86400000 * 5).toISOString(), description: 'Monthly electricity bill', payment_mode: 'bank_transfer', branch_id: 1, reference: 'Bill #E-2026-07' },
      { id: 4, type: 'expense', category: 'Salary', amount: 25000, date: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'Staff salary - July', payment_mode: 'bank_transfer', branch_id: 1, reference: 'Payroll July' },
      { id: 5, type: 'expense', category: 'Transport', amount: 2000, date: new Date(Date.now() - 86400000).toISOString(), description: 'Stock delivery transport', payment_mode: 'cash', branch_id: 1, reference: 'Receipt #T-445' },
    ];

    // Use batched writes for performance (Firestore max 500 per batch)
    const seedStore = async (name, data) => {
      // Process in batches of 400
      for (let i = 0; i < data.length; i += 400) {
        const batch = this.db.batch();
        const chunk = data.slice(i, i + 400);
        chunk.forEach(item => {
          item.created_at = item.created_at || new Date().toISOString();
          item.updated_at = new Date().toISOString();
          const docRef = this.db.collection(name).doc(String(item.id));
          batch.set(docRef, item);
        });
        await batch.commit();
      }
      // Update counter
      const maxId = Math.max(...data.map(d => d.id));
      this._counterCache[name] = maxId;
    };

    await seedStore('branches', branches);
    await seedStore('users', users);
    await seedStore('categories', categories);
    await seedStore('products', products);
    await seedStore('suppliers', suppliers);
    await seedStore('customers', customers);
    await seedStore('sales', sales);
    await seedStore('sale_items', saleItems);
    await seedStore('purchases', purchases);
    await seedStore('festivals', festivals);
    await seedStore('internal_issues', internalIssues);
    await seedStore('notifications', notifications);
    await seedStore('activities', activities);
    await seedStore('settings', settings);
    await seedStore('stock_transfers', transfers);
    await seedStore('accounts', accountEntries);

    // Save all counters
    await this.db.collection('_meta').doc('counters').set(this._counterCache);

    console.log('✅ Loyadham Store DB seeded successfully to Firestore!');
  },

  // ---- Helper Methods ----
  getStockStatus(product) {
    if (product.current_stock <= 0) return 'out-of-stock';
    if (product.current_stock <= product.min_stock) return 'low-stock';
    return 'in-stock';
  },

  async getNextCode(prefix) {
    const all = await this.getAll('products');
    const matching = all.filter(p => p.code && p.code.startsWith(prefix));
    const maxNum = matching.reduce((max, p) => {
      const num = parseInt(p.code.split('-').pop()) || 0;
      return num > max ? num : max;
    }, 0);
    return prefix + String(maxNum + 1).padStart(3, '0');
  },

  async getNextInvoice() {
    const sales = await this.getAll('sales');
    return 'LY-INV-' + String(sales.length + 1).padStart(5, '0');
  }
};
