// ====== DATA LAYER (localStorage) ======
// Legacy file — superseded by PostgreSQL. Kept for reference.

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
};
