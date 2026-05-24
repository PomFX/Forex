// ====== ROUTER ======
const Router = {
  _initialized: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;

    App.setupAuth();
    App.setupFilter();
    App.setupNavbar();
    App.setupAdminUI();
    Admin.setupSignalForm();
    Admin.setupArticleForm();
    Admin.setupBrokerForm();
    Admin.populatePairSelect();
    Admin.setupUploads();
    Admin.setupContactForm();

    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();

    window.addEventListener('load', () => {
      document.getElementById('preloader').classList.add('hidden');
    });
  },

  async handleRoute() {
    const hash = window.location.hash.slice(1) || '';
    const parts = hash.split('/').filter(Boolean);
    const page = parts[0] || 'home';
    const sub = parts[1] || '';

    if (page === 'logout') {
      Auth.logout();
      App.updateNavbar();
      App.toast('ออกจากระบบแล้ว');
      return;
    }

    if (page === 'admin') {
      if (!Auth.requireAdmin()) return;
      this.showPage('admin');
      this.activateAdminSidebar(sub || 'dashboard');

      document.querySelectorAll('.admin-page-content').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('admin-' + (sub || 'dashboard'));
      if (target) target.classList.add('active');

      switch (sub) {
        case 'members': await Admin.renderMembers(); break;
        case 'signals': await Admin.renderSignals(); break;
        case 'articles': await Admin.renderArticles(); break;
        case 'brokers': await Admin.renderBrokers(); break;
        case 'contact': await Admin.renderContactSettings(); break;
        default: await Admin.showDashboard(); break;
      }
      return;
    }

    this.showPage(page);
    App.updateNavbar();

    switch (page) {
      case 'home':
        await App.renderHomeStats();
        await App.renderHomeSignals();
        await App.renderHomeQR();
        await App.renderHomeArticles();
        break;
      case 'brokers':
        await App.renderBrokers();
        break;
      case 'signals':
        await App.renderSignals();
        break;
      case 'articles':
        await App.renderArticles();
        break;
      case 'contact':
        await App.renderContact();
        break;
      case 'vip':
        App.renderVipPlans();
        break;
    }
  },

  showPage(name) {
    const map = {
      '': 'home', 'home': 'home', 'brokers': 'brokers',
      'signals': 'signals', 'articles': 'articles', 'vip': 'vip',
      'login': 'login', 'register': 'register', 'admin': 'admin',
    };
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('page-' + (map[name] || name));
    if (target) target.classList.add('active');
  },

  activateAdminSidebar(sub) {
    document.querySelectorAll('.admin-link').forEach(el => el.classList.remove('active'));
    const link = document.querySelector(`.admin-link[data-page="${sub}"]`);
    if (link) link.classList.add('active');
    document.querySelector('.admin-nav').classList.remove('open');
  },

  navigate(path) {
    window.location.hash = '#' + (path ? '/' + path : '/');
  }
};

document.addEventListener('DOMContentLoaded', () => Router.init());
