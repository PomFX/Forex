// ====== AUTH SYSTEM ======
const Auth = {
  async register(username, email, password) {
    try {
      const data = await API.register(username, email, password);
      return { ok: true, msg: 'สมัครสมาชิกสําเร็จ' };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  },

  async login(email, password) {
    try {
      const data = await API.login(email, password);
      API.setToken(data.token);
      localStorage.setItem('athtrader_user', JSON.stringify(data.user));
      return { ok: true, msg: 'เข้าสู่ระบบสําเร็จ', isAdmin: data.user.role === 'admin' || data.user.isAdmin === true };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  },

  logout() {
    API.setToken(null);
    localStorage.removeItem('athtrader_user');
    Router.navigate('');
  },

  isLoggedIn() {
    return !!this.getUser();
  },

  isAdmin() {
    const u = this.getUser();
    return u && (u.role === 'admin' || u.isAdmin === true);
  },

  getUser() {
    try { return JSON.parse(localStorage.getItem('athtrader_user')); }
    catch { return null; }
  },

  requireAuth() {
    if (!this.isLoggedIn()) { Router.navigate('login'); return false; }
    return true;
  },

  requireAdmin() {
    if (!this.isAdmin()) { Router.navigate(''); return false; }
    return true;
  }
};
