// ====== API CLIENT ======
const API = {
  _token: localStorage.getItem('athtrader_token'),

  getToken() { return this._token; },

  setToken(token) {
    this._token = token;
    if (token) localStorage.setItem('athtrader_token', token);
    else localStorage.removeItem('athtrader_token');
  },

  async _fetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._token) headers['Authorization'] = 'Bearer ' + this._token;

    const res = await fetch('/api' + path, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  // Auth
  async login(email, password) {
    return this._fetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  async register(username, email, password) {
    return this._fetch('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
  },

  async getMe() {
    return this._fetch('/auth/me');
  },

  // Signals
  async getSignals() {
    return this._fetch('/signals');
  },

  async addSignal(data) {
    return this._fetch('/signals', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateSignal(id, data) {
    return this._fetch('/signals/' + id, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteSignal(id) {
    return this._fetch('/signals/' + id, { method: 'DELETE' });
  },

  // Articles
  async getArticles() {
    return this._fetch('/articles');
  },

  async addArticle(data) {
    return this._fetch('/articles', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateArticle(id, data) {
    return this._fetch('/articles/' + id, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteArticle(id) {
    return this._fetch('/articles/' + id, { method: 'DELETE' });
  },

  // Brokers
  async getBrokers() {
    return this._fetch('/brokers');
  },

  async addBroker(data) {
    return this._fetch('/brokers', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateBroker(id, data) {
    return this._fetch('/brokers/' + id, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteBroker(id) {
    return this._fetch('/brokers/' + id, { method: 'DELETE' });
  },

  // Users (admin)
  async getUsers() {
    return this._fetch('/users');
  },

  async updateVipLevel(userId, vipLevel) {
    return this._fetch('/users/' + userId + '/vip', { method: 'PUT', body: JSON.stringify({ vipLevel }) });
  },

  async updateAdminStatus(userId, isAdmin) {
    return this._fetch('/users/' + userId + '/admin', { method: 'PUT', body: JSON.stringify({ isAdmin }) });
  },

  async deleteUser(userId) {
    return this._fetch('/users/' + userId, { method: 'DELETE' });
  },

  // Stats
  async getStats() {
    return this._fetch('/stats');
  },

  async getPublicStats() {
    return this._fetch('/stats/public');
  },

  // Contact
  async getContact() {
    return this._fetch('/settings/contact');
  },

  async updateContact(data) {
    return this._fetch('/settings/contact', { method: 'PUT', body: JSON.stringify(data) });
  },
};
