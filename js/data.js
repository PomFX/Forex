// ====== DATA LAYER (localStorage) ======
const DB = {
  _prefix: 'athtrader_',

  _get(key) {
    try { return JSON.parse(localStorage.getItem(this._prefix + key)) || this._defaults[key](); }
    catch { return this._defaults[key](); }
  },

  _set(key, val) {
    localStorage.setItem(this._prefix + key, JSON.stringify(val));
  },

  _defaults: {
    users: () => [],
    signals: () => [],
    articles: () => [],
    brokers: () => [],
    nextId: () => 1,
    currentUser: () => null,
  },

  // Users
  getUsers() { return this._get('users'); },
  saveUsers(u) { this._set('users', u); },
  addUser(user) {
    const users = this.getUsers();
    user.id = this.nextId();
    user.vipLevel = 'Free';
    user.registeredAt = new Date().toISOString();
    users.push(user);
    this.saveUsers(users);
    this._set('nextId', user.id + 1);
    return user;
  },
  deleteUser(id) {
    this.saveUsers(this.getUsers().filter(u => u.id !== id));
  },
  getUserByEmail(email) {
    return this.getUsers().find(u => u.email === email) || null;
  },
  getUserByUsername(un) {
    return this.getUsers().find(u => u.username === un) || null;
  },
  updateVipLevel(userId, level) {
    const users = this.getUsers();
    const u = users.find(x => x.id === userId);
    if (u) { u.vipLevel = level; this.saveUsers(users); }
  },

  // Signals
  getSignals() { return this._get('signals'); },
  saveSignals(s) { this._set('signals', s); },
  addSignal(signal) {
    const list = this.getSignals();
    signal.id = Date.now();
    signal.createdAt = new Date().toISOString();
    list.unshift(signal);
    this.saveSignals(list);
    return signal;
  },
  updateSignal(id, data) {
    const list = this.getSignals();
    const i = list.findIndex(s => s.id === id);
    if (i > -1) { list[i] = { ...list[i], ...data }; this.saveSignals(list); }
  },
  deleteSignal(id) {
    this.saveSignals(this.getSignals().filter(s => s.id !== id));
  },

  // Articles
  getArticles() { return this._get('articles'); },
  saveArticles(a) { this._set('articles', a); },
  addArticle(article) {
    const list = this.getArticles();
    article.id = Date.now();
    article.createdAt = new Date().toISOString();
    list.unshift(article);
    this.saveArticles(list);
    return article;
  },
  updateArticle(id, data) {
    const list = this.getArticles();
    const i = list.findIndex(a => a.id === id);
    if (i > -1) { list[i] = { ...list[i], ...data }; this.saveArticles(list); }
  },
  deleteArticle(id) {
    this.saveArticles(this.getArticles().filter(a => a.id !== id));
  },

  // Brokers
  getBrokers() { return this._get('brokers'); },
  saveBrokers(b) { this._set('brokers', b); },
  addBroker(broker) {
    const list = this.getBrokers();
    broker.id = Date.now();
    list.push(broker);
    this.saveBrokers(list);
    return broker;
  },
  updateBroker(id, data) {
    const list = this.getBrokers();
    const i = list.findIndex(b => b.id === id);
    if (i > -1) { list[i] = { ...list[i], ...data }; this.saveBrokers(list); }
  },
  deleteBroker(id) {
    this.saveBrokers(this.getBrokers().filter(b => b.id !== id));
  },

  // Current user
  getCurrentUser() { return this._get('currentUser'); },
  setCurrentUser(u) { this._set('currentUser', u); },
  logout() { this._set('currentUser', null); },

  // Helpers
  nextId() {
    const id = this._get('nextId');
    this._set('nextId', id + 1);
    return id;
  },

  // Seed data
  seed() {
    if (this.getBrokers().length === 0) {
      this.addBroker({ name: 'KVB Prime', description: 'โบรกเกอร์ Forex ชั้นนํา ได้รับการยอมรับระดับโลก ให้บริการเทรด Forex, CFD, สินค้าโภคภัณฑ์ พร้อมสเปรดตํ่าและ执行力รวดเร็ว', rating: 4.8, ibLink: 'https://www.kvbplus.com/prime', logo: '' });
      this.addBroker({ name: 'Exness', description: 'โบรกเกอร์ระดับโลกที่มีปริมาณการเทรดสูง ตลอด 24/7 เงื่อนไขการเทรดดีที่สุด', rating: 4.7, ibLink: 'https://www.exness.com/ib', logo: '' });
      this.addBroker({ name: 'XM', description: 'โบรกเกอร์ที่ได้รับความนิยมสูง โบนัสต้อนรับมากมาย บริการลูกค้า 24/5', rating: 4.5, ibLink: 'https://www.xm.com/ib', logo: '' });
    }
    if (this.getSignals().length === 0) {
      this.addSignal({ pair: 'EUR/USD', direction: 'BUY', entry: '1.08750', tp1: '1.09200', tp2: '1.09500', tp3: '1.09800', sl: '1.08400', status: 'active' });
      this.addSignal({ pair: 'GBP/USD', direction: 'SELL', entry: '1.26500', tp1: '1.26000', tp2: '1.25700', tp3: '1.25400', sl: '1.26900', status: 'active' });
      this.addSignal({ pair: 'XAU/USD', direction: 'BUY', entry: '2035.00', tp1: '2042.00', tp2: '2048.00', tp3: '2055.00', sl: '2028.00', status: 'win' });
      this.addSignal({ pair: 'USD/JPY', direction: 'SELL', entry: '150.200', tp1: '149.800', tp2: '149.500', tp3: '149.200', sl: '150.600', status: 'loss' });
    }
    if (this.getArticles().length === 0) {
      this.addArticle({ title: 'เทคนิควิเคราะห์ Forex สําหรับมือใหม่', content: 'การเทรด Forex เป็นการลงทุนที่มีความเสี่ยงสูง ผู้เริ่มต้นควรศึกษาเทคนิคพื้นฐาน เช่น การวิเคราะห์แนวรับแนวต้าน, การใช้ RSI และ MACD, และการบริหารความเสี่ยงด้วย Risk Management ที่ดี.', image: '' });
      this.addArticle({ title: 'วิธีเลือกโบรกเกอร์ Forex ที่น่าเชื่อถือ', content: 'การเลือกโบรกเกอร์เป็นขั้นตอนสําคัญที่สุด ควรดูที่ใบอนุญาต, ความน่าเชื่อถือ, สเปรด, ค่าคอมมิชชั่น, และระบบฝาก-ถอน ที่สะดวกรวดเร็ว.', image: '' });
      this.addArticle({ title: 'วิเคราะห์ทองคํา XAU/USD ประจําสัปดาห์', content: 'ราคาทองคํายังคงได้รับแรงหนุนจากความไม่แน่นอนทางเศรษฐกิจโลก และนโยบายดอกเบี้ยของธนาคารกลางสหรัฐฯ นักวิเคราะห์คาดว่าราคาจะเคลื่อนไหวในกรอบ 2030-2060 ดอลลาร์.', image: '' });
    }
  }
};

DB.seed();
