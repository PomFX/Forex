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
    } catch (err) { console.error('renderHomeStats:', err); }
  },

  // ====== SIDE BANNER ======
  async renderSideBanner() {
    await this._renderBanner('left');
    await this._renderBanner('right');
  },

  async _renderBanner(side) {
    try {
      const banner = await API.getBanner(side);
      const el = document.getElementById('sideBanner' + (side === 'left' ? 'Left' : 'Right'));
      if (!banner.enabled || !banner.html) { el.style.display = 'none'; return; }
      el.innerHTML = banner.html + '<button class="banner-close" id="bannerClose' + side + '">&times;</button>';
      el.style.display = 'flex';
      document.getElementById('bannerClose' + side).addEventListener('click', () => {
        el.style.display = 'none';
      });
    } catch (err) { document.getElementById('sideBanner' + (side === 'left' ? 'Left' : 'Right')).style.display = 'none'; }
  },

  // ====== MIDDLE BANNER ======
  async renderMiddleBanner() {
    try {
      const banner = await API.getBanner('middle');
      const el = document.getElementById('homeBannerMiddle');
      if (!banner.enabled || !banner.html) { el.style.display = 'none'; return; }
      el.innerHTML = banner.html;
      el.style.display = 'block';
    } catch (err) { document.getElementById('homeBannerMiddle').style.display = 'none'; }
  },

  // ====== HOME GOLD STATS ======
  async renderHomeGoldStats() {
    try {
      const stats = await API.getGoldStats();
      const el = document.getElementById('homeGoldStats');
      if (stats.total === 0) { el.style.display = 'none'; return; }
      el.style.display = '';
      document.getElementById('goldTotalSignals').textContent = stats.total;
      document.getElementById('goldWins').textContent = stats.wins;
      document.getElementById('goldLosses').textContent = stats.losses;
      document.getElementById('goldWinRate').textContent = stats.winRate + '%';
      document.getElementById('goldActive').textContent = stats.active;
    } catch (err) { document.getElementById('homeGoldStats').style.display = 'none'; console.error('renderHomeGoldStats:', err); }
  },

  // ====== HOME BROKERS ======
  async renderHomeBrokers() {
    try {
      const brokers = await API.getBrokers();
      const topBrokers = brokers.filter(b => b.rating >= 5);
      const el = document.getElementById('homeBrokers');
      const list = document.getElementById('homeBrokerList');
      if (topBrokers.length === 0) {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      list.innerHTML = topBrokers.map(b => {
        const fallback = this._brokerSvg(b.name);
        return `<div class="broker-card">
          <img src="${escHtml(b.logo || fallback)}" alt="${escHtml(b.name)}" onerror="this.src='${fallback}'">
          <h3>${escHtml(b.name)}</h3>
          <div class="rating">${'★'.repeat(Math.floor(b.rating))}${b.rating % 1 >= 0.5 ? '½' : ''} ${b.rating}</div>
          <p>${escHtml(b.description)}</p>
          <a href="${escHtml(b.ib_link)}" target="_blank" class="btn btn-gold btn-sm">สมัครผ่าน IB</a>
        </div>`;
      }).join('');
    } catch (err) { console.error('renderHomeBrokers:', err); }
  },

  // ====== HOME SIGNALS ======
  async renderHomeSignals() {
    try {
      const [signals, prices] = await Promise.all([API.getSignals(), API.getMarketPrices()]);
      this._prices = prices;
      document.getElementById('homeSignals').innerHTML = signals.slice(0, 3).map(s => this.signalCardHTML(s)).join('');
    } catch (err) { console.error('renderHomeSignals:', err); }
  },

  // ====== HOME QR ======
  async renderHomeQR() {
    try {
      const data = await API.getContact();
      const qrs = [
        { label: 'Line', img: data.qr_code, url: data.line_id },
        { label: 'OpenChat', img: data.openchat_qr, url: data.openchat },
        { label: 'TikTok', img: data.tiktok_qr, url: data.tiktok },
      ].filter(q => q.img);
      document.getElementById('homeQRList').innerHTML = qrs.map(q =>
        `<div class="home-qr-item"${q.url ? ` onclick="window.open('${escHtml(q.url)}','_blank')"` : ''}>
          <h4>${escHtml(q.label)}</h4>
          <img src="${escHtml(q.img)}" alt="${escHtml(q.label)} QR">
          <p class="home-qr-click">คลิกที่นี้</p>
        </div>`
      ).join('');
      document.getElementById('homeQR').style.display = qrs.length ? '' : 'none';
    } catch (err) { document.getElementById('homeQR').style.display = 'none'; console.error('renderHomeQR:', err); }
  },

  // ====== HOME ARTICLES ======
  async renderHomeArticles() {
    try {
      const articles = await API.getArticles();
      document.getElementById('homeArticles').innerHTML = articles.slice(0, 3).map(this.articleCardHTML).join('');
    } catch (err) { console.error('renderHomeArticles:', err); }
  },

  // ====== BROKERS ======
  _brokerSvg(name) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><rect fill="#222" width="100" height="60"/><text x="50" y="35" text-anchor="middle" fill="#FFD700" font-size="11" font-weight="bold">' + escHtml(name) + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  },

  async renderBrokers() {
    try {
      const brokers = await API.getBrokers();
      document.getElementById('brokerList').innerHTML = brokers.map(b => {
        const fallback = this._brokerSvg(b.name);
        return `<div class="broker-card">
          <img src="${escHtml(b.logo || fallback)}" alt="${escHtml(b.name)}" onerror="this.src='${fallback}'">
          <h3>${escHtml(b.name)}</h3>
          <div class="rating">${'★'.repeat(Math.floor(b.rating))}${b.rating % 1 >= 0.5 ? '½' : ''} ${b.rating}</div>
          <p>${escHtml(b.description)}</p>
          <a href="${escHtml(b.ib_link)}" target="_blank" class="btn btn-gold btn-sm">สมัครผ่าน IB</a>
        </div>`;
      }).join('');
    } catch (err) { console.error('renderBrokers:', err); }
  },

  // ====== SIGNALS ======
  async renderSignals(filter = 'all') {
    try {
      const [signals, prices] = await Promise.all([API.getSignals(), API.getMarketPrices()]);
      this._prices = prices;
      if (filter !== 'all') signals = signals.filter(s => s.direction === filter);
      document.getElementById('signalList').innerHTML = signals.length
        ? signals.map(s => this.signalCardHTML(s)).join('')
        : '<p style="text-align:center;color:var(--text-muted);padding:2rem">ไม่มีสัญญาณเทรด</p>';
    } catch (err) {
      document.getElementById('signalList').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem">โหลดข้อมูลล้มเหลว</p>';
      console.error('renderSignals:', err);
    }
  },

  signalCardHTML(s) {
    const dirClass = s.direction === 'BUY' ? 'buy' : 'sell';
    const isGold = s.pair === 'XAU/USD';
    const goldBadge = isGold ? ' <span style="color:#FFD700;font-size:0.7rem;background:#1a1a0a;padding:0.1rem 0.4rem;border-radius:3px;border:1px solid #FFD700;margin-left:0.3rem">ทองคำ</span>' : '';
    const statusBadge = s.status === 'win' ? '<span class="badge win">WIN</span>'
      : s.status === 'loss' ? '<span class="badge loss">LOSS</span>'
      : '<span class="badge">ACTIVE</span>';
    const time = s.created_at || s.createdAt;
    const timeStr = time ? new Date(time).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }) : '';
    const livePrice = this._prices && this._prices[s.pair];
    const livePriceStr = livePrice ? (isGold ? livePrice.toLocaleString(undefined, {minimumFractionDigits:2}) : livePrice.toFixed(5)) : '';
    const reasonHtml = s.reason ? `<div class="signal-reason">${escHtml(s.reason).replace(/\n/g, '<br>')}</div>` : '';
    return `
      <div class="signal-card${isGold ? ' gold-signal' : ''}">
        <span class="pair">${escHtml(s.pair)}${goldBadge}</span>
        <span class="direction ${dirClass}">${escHtml(s.direction)}</span>
        <span class="detail"><strong>Entry:</strong> ${escHtml(s.entry)}</span>
        <span class="detail"><strong>TP:</strong> ${escHtml(s.tp1)}${s.tp2 ? '/' + escHtml(s.tp2) : ''}${s.tp3 ? '/' + escHtml(s.tp3) : ''}</span>
        <span class="detail"><strong>SL:</strong> ${escHtml(s.sl || '-')}</span>
        ${statusBadge}
        ${livePriceStr ? `<span class="detail live-price"><strong>ปัจจุบัน:</strong> ${livePriceStr}</span>` : ''}
        ${reasonHtml}
        <span class="detail signal-time">${timeStr}</span>
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
    } catch (err) {
      document.getElementById('articleList').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem">โหลดข้อมูลล้มเหลว</p>';
      console.error('renderArticles:', err);
    }
  },

  articleCardHTML(a) {
    const date = new Date(a.created_at || a.createdAt).toLocaleDateString('th-TH');
    const hasImg = !!a.image;
    return `
      <div class="article-card">
        ${hasImg
          ? `<img class="article-card-img" src="${escHtml(a.image)}" alt="${escHtml(a.title)}" onerror="this.parentElement.innerHTML='<div class=article-card-img style=background:linear-gradient(135deg,#1a1a0a,#222);display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--gold);font-size:0.9rem;font-weight:600>ATH Trader</div>'">`
          : `<div class="article-card-img" style="background:linear-gradient(135deg,#1a1a0a,#222);display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--gold);font-size:0.9rem;font-weight:600">ATH<br>Trader</div>`
        }
        <div class="article-card-body">
          <h3>${escHtml(a.title)}</h3>
          <p>${escHtml(a.content)}</p>
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
        <div class="vip-name">${escHtml(p.name)}</div>
        <div class="vip-price">${escHtml(p.price)}</div>
        <ul>${p.perks.map(x => '<li>' + escHtml(x) + '</li>').join('')}</ul>
        <button class="btn ${p.name === 'Free' ? 'btn-outline' : 'btn-gold'}" onclick="Router.navigate('register')">${p.name === 'Free' ? 'เริ่มต้นฟรี' : 'สมัครเลย'}</button>
      </div>
    `).join('');
  },

  // ====== CONTACT ======
  async renderContact() {
    try {
      const data = await API.getContact();

      const setCard = (id, url, label) => {
        const el = document.getElementById(id);
        const card = el?.closest('.contact-card');
        if (url) {
          el.textContent = label || 'เชื่อมต่อ';
          if (card) card.dataset.href = url;
        } else {
          el.textContent = '-';
          if (card) delete card.dataset.href;
        }
      };

      setCard('contactLine', data.line_id?.startsWith('http') ? data.line_id : null, data.line_id ? (data.line_id.startsWith('http') ? 'Line' : data.line_id) : null);
      if (data.phone) {
        setCard('contactPhone', 'tel:' + data.phone, data.phone);
      } else {
        setCard('contactPhone', null);
      }
      if (data.email) {
        setCard('contactEmail', 'mailto:' + data.email, data.email);
      } else {
        setCard('contactEmail', null);
      }
      setCard('contactFacebook', data.facebook, 'Facebook');
      setCard('contactTiktok', data.tiktok, 'TikTok');
      setCard('contactYoutube', data.youtube, 'YouTube');
      setCard('contactOpenchat', data.openchat, 'เปิดแชท');

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
      const ttQRWrap = document.getElementById('contactTiktokQRWrap');
      const ttQRImg = document.getElementById('contactTiktokQR');
      if (data.tiktok_qr) {
        ttQRWrap.style.display = 'block';
        ttQRImg.src = data.tiktok_qr;
      } else {
        ttQRWrap.style.display = 'none';
      }

      // Card click handler
      document.getElementById('contactPage').onclick = (e) => {
        const card = e.target.closest('.contact-card[data-href]');
        if (card) window.open(card.dataset.href, '_blank');
      };
    } catch (err) { console.error('renderContact:', err); }
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
