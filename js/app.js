// ====== FRONTEND APP ======
const App = {
  toast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '');
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
  },

  // ====== HOME STATS ======
  async renderHomeStats() {
    try {
      const stats = await API.getPublicStats();
      document.getElementById('statTotalSignals').textContent = stats.totalSignals;
      document.getElementById('statBuyWins').textContent = stats.buyWins;
      document.getElementById('statSellWins').textContent = stats.sellWins;
      document.getElementById('statVipCount').textContent = stats.vipCount;
    } catch { /* ignore */ }
  },

  // ====== HOME SIGNALS ======
  async renderHomeSignals() {
    try {
      const signals = await API.getSignals();
      document.getElementById('homeSignals').innerHTML = signals.slice(0, 3).map(this.signalCardHTML).join('');
    } catch { /* ignore */ }
  },

  // ====== HOME ARTICLES ======
  async renderHomeArticles() {
    try {
      const articles = await API.getArticles();
      document.getElementById('homeArticles').innerHTML = articles.slice(0, 3).map(this.articleCardHTML).join('');
    } catch { /* ignore */ }
  },

  // ====== BROKERS ======
  _brokerSvg(name) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><rect fill="#222" width="100" height="60"/><text x="50" y="35" text-anchor="middle" fill="#FFD700" font-size="11" font-weight="bold">' + name + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  },

  async renderBrokers() {
    try {
      const brokers = await API.getBrokers();
      document.getElementById('brokerList').innerHTML = brokers.map(b => {
        const fallback = this._brokerSvg(b.name);
        return `<div class="broker-card">
          <img src="${b.logo || fallback}" alt="${b.name}" onerror="this.src='${fallback}'">
          <h3>${b.name}</h3>
          <div class="rating">${'★'.repeat(Math.floor(b.rating))}${b.rating % 1 >= 0.5 ? '½' : ''} ${b.rating}</div>
          <p>${b.description}</p>
          <a href="${b.ib_link}" target="_blank" class="btn btn-gold btn-sm">สมัครผ่าน IB</a>
        </div>`;
      }).join('');
    } catch { /* ignore */ }
  },

  // ====== SIGNALS ======
  async renderSignals(filter = 'all') {
    try {
      let signals = await API.getSignals();
      if (filter !== 'all') signals = signals.filter(s => s.direction === filter);
      document.getElementById('signalList').innerHTML = signals.length
        ? signals.map(this.signalCardHTML).join('')
        : '<p style="text-align:center;color:var(--text-muted);padding:2rem">ไม่มีสัญญาณเทรด</p>';
    } catch {
      document.getElementById('signalList').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem">โหลดข้อมูลล้มเหลว</p>';
    }
  },

  signalCardHTML(s) {
    const dirClass = s.direction === 'BUY' ? 'buy' : 'sell';
    const statusBadge = s.status === 'win' ? '<span class="badge win">WIN</span>'
      : s.status === 'loss' ? '<span class="badge loss">LOSS</span>'
      : '<span class="badge">ACTIVE</span>';
    return `
      <div class="signal-card">
        <span class="pair">${s.pair}</span>
        <span class="direction ${dirClass}">${s.direction}</span>
        <span class="detail"><strong>Entry:</strong> ${s.entry}</span>
        <span class="detail"><strong>TP:</strong> ${s.tp1}${s.tp2 ? '/' + s.tp2 : ''}${s.tp3 ? '/' + s.tp3 : ''}</span>
        <span class="detail"><strong>SL:</strong> ${s.sl || '-'}</span>
        ${statusBadge}
      </div>
    `;
  },

  // ====== ARTICLES ======
  async renderArticles() {
    try {
      const articles = await API.getArticles();
      document.getElementById('articleList').innerHTML = articles.length
        ? articles.map(this.articleCardHTML).join('')
        : '<p style="text-align:center;color:var(--text-muted);padding:2rem">ไม่มีบทความ</p>';
    } catch {
      document.getElementById('articleList').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem">โหลดข้อมูลล้มเหลว</p>';
    }
  },

  articleCardHTML(a) {
    const date = new Date(a.created_at || a.createdAt).toLocaleDateString('th-TH');
    const hasImg = !!a.image;
    return `
      <div class="article-card">
        ${hasImg
          ? `<img class="article-card-img" src="${a.image}" alt="${a.title}" onerror="this.parentElement.innerHTML='<div class=article-card-img style=background:linear-gradient(135deg,#1a1a0a,#222);display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--gold);font-size:0.9rem;font-weight:600>ATH Trader</div>'">`
          : `<div class="article-card-img" style="background:linear-gradient(135deg,#1a1a0a,#222);display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--gold);font-size:0.9rem;font-weight:600">ATH<br>Trader</div>`
        }
        <div class="article-card-body">
          <h3>${a.title}</h3>
          <p>${a.content}</p>
          <div class="meta">${date}</div>
        </div>
      </div>
    `;
  },

  // ====== VIP PLANS ======
  renderVipPlans() {
    const plans = [
      { name: 'Free', price: 'ฟรี', featured: false, perks: ['สัญญาณเทรดพื้นฐาน', 'บทความทั่วไป', 'ข่าวสารรายวัน'] },
      { name: 'Silver', price: '1,500 บาท/เดือน', featured: false, perks: ['สัญญาณเทรด 5-10 สัญญาณ/วัน', 'วิเคราะห์ตลาดเช้า-เย็น', 'กลุ่มไลน์ส่วนตัว', 'VIP บทความพิเศษ'] },
      { name: 'Gold', price: '3,500 บาท/เดือน', featured: true, perks: ['สัญญาณเทรด 10-15 สัญญาณ/วัน', 'วิเคราะห์แบบ Real-time', 'สัญญาณทองคํา XAU/USD', 'Personal Support 24/5', 'IB โบนัสพิเศษ'] },
      { name: 'Platinum', price: '7,900 บาท/เดือน', featured: false, perks: ['สัญญาณเทรดไม่จํากัด', 'Copy Trade', 'One-on-One Coaching', 'EA เทรดอัตโนมัติ', 'เข้าถึงเซียนเทรดตัวจริง', 'IB คอมมิชชั่นสูงสุด'] },
    ];
    document.getElementById('vipPlans').innerHTML = plans.map(p => `
      <div class="vip-card${p.featured ? ' featured' : ''}">
        ${p.featured ? '<span class="vip-badge">ยอดนิยม</span>' : ''}
        <div class="vip-name">${p.name}</div>
        <div class="vip-price">${p.price}</div>
        <ul>${p.perks.map(x => '<li>' + x + '</li>').join('')}</ul>
        <button class="btn ${p.name === 'Free' ? 'btn-outline' : 'btn-gold'}" onclick="Router.navigate('register')">${p.name === 'Free' ? 'เริ่มต้นฟรี' : 'สมัครเลย'}</button>
      </div>
    `).join('');
  },

  // ====== CONTACT ======
  async renderContact() {
    try {
      const data = await API.getContact();
      document.getElementById('contactLine').textContent = data.line_id || '-';
      document.getElementById('contactPhone').textContent = data.phone || '-';
      document.getElementById('contactEmail').innerHTML = data.email ? `<a href="mailto:${data.email}">${data.email}</a>` : '-';
      document.getElementById('contactFacebook').innerHTML = data.facebook ? `<a href="${data.facebook}" target="_blank">${data.facebook}</a>` : '-';
      document.getElementById('contactTiktok').innerHTML = data.tiktok ? `<a href="${data.tiktok}" target="_blank">${data.tiktok}</a>` : '-';
      document.getElementById('contactYoutube').innerHTML = data.youtube ? `<a href="${data.youtube}" target="_blank">${data.youtube}</a>` : '-';
      document.getElementById('contactOpenchat').innerHTML = data.openchat ? `<a href="${data.openchat}" target="_blank">${data.openchat}</a>` : '-';
      const qrWrap = document.getElementById('contactQRWrap');
      const qrImg = document.getElementById('contactQR');
      if (data.qr_code) {
        qrWrap.style.display = 'block';
        qrImg.src = data.qr_code;
      } else {
        qrWrap.style.display = 'none';
      }
      const ocQRWrap = document.getElementById('contactOpenchatQRWrap');
      const ocQRImg = document.getElementById('contactOpenchatQR');
      if (data.openchat_qr) {
        ocQRWrap.style.display = 'block';
        ocQRImg.src = data.openchat_qr;
      } else {
        ocQRWrap.style.display = 'none';
      }
    } catch {}
  },

  // ====== AUTH HANDLERS ======
  setupAuth() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const result = await Auth.login(email, password);
      if (result.ok) {
        App.toast(result.msg);
        Router.navigate(result.isAdmin ? 'admin' : '');
        App.updateNavbar();
      } else {
        document.getElementById('loginError').textContent = result.msg;
      }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirm = document.getElementById('regConfirm').value;
      if (password !== confirm) {
        document.getElementById('registerError').textContent = 'รหัสผ่านไม่ตรงกัน';
        return;
      }
      const result = await Auth.register(username, email, password);
      if (result.ok) {
        App.toast(result.msg);
        Router.navigate('login');
      } else {
        document.getElementById('registerError').textContent = result.msg;
      }
    });
  },

  // ====== FILTER ======
  setupFilter() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        App.renderSignals(btn.dataset.filter);
      });
    });
  },

  // ====== NAVBAR ======
  setupNavbar() {
    document.getElementById('navToggle').addEventListener('click', () => {
      document.getElementById('navLinks').classList.toggle('open');
    });
  },

  updateNavbar() {
    const isLoggedIn = Auth.isLoggedIn();
    const isAdmin = Auth.isAdmin();
    const loginLink = document.getElementById('navLogin');
    const regLink = document.getElementById('navRegister');

    if (isLoggedIn) {
      const user = Auth.getUser();
      loginLink.textContent = isAdmin ? 'Admin Panel' : (user.username || 'ผู้ใช้');
      loginLink.href = isAdmin ? '#/admin' : '#/';
      regLink.textContent = 'ออกจากระบบ';
      regLink.href = '#/logout';
      regLink.className = 'nav-link';
    } else {
      loginLink.textContent = 'เข้าสู่ระบบ';
      loginLink.href = '#/login';
      regLink.textContent = 'สมัครสมาชิก';
      regLink.href = '#/register';
      regLink.className = 'nav-link btn-gold';
    }
  },

  // ====== ADMIN UI ======
  setupAdminUI() {
    document.getElementById('adminToggle').addEventListener('click', () => {
      document.querySelector('.admin-nav').classList.toggle('open');
    });

    document.getElementById('signalCancel').addEventListener('click', () => this.resetSignalForm());
    document.getElementById('articleCancel').addEventListener('click', () => this.resetArticleForm());
    document.getElementById('brokerCancel').addEventListener('click', () => this.resetBrokerForm());
  },

  resetSignalForm() {
    document.getElementById('signalForm').reset();
    document.getElementById('signalEditId').value = '';
    document.getElementById('signalSubmit').textContent = 'เพิ่มสัญญาณ';
    document.getElementById('signalCancel').style.display = 'none';
  },

  resetArticleForm() {
    document.getElementById('articleForm').reset();
    document.getElementById('articleEditId').value = '';
    document.getElementById('articleSubmit').textContent = 'เพิ่มบทความ';
    document.getElementById('articleCancel').style.display = 'none';
  },

  resetBrokerForm() {
    document.getElementById('brokerForm').reset();
    document.getElementById('brokerEditId').value = '';
    document.getElementById('brokerSubmit').textContent = 'เพิ่มโบรกเกอร์';
    document.getElementById('brokerCancel').style.display = 'none';
  }
};
