// ====== ADMIN PANEL ======
const Admin = {
  // ====== UPLOAD ======
  setupUploads() {
    document.getElementById('articleImageUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('articleImageName').textContent = 'กำลังอัปโหลด...';
      try {
        const url = await this.uploadFile(file);
        document.getElementById('articleImage').value = url;
        document.getElementById('articleImageName').textContent = '✔ อัปโหลดสำเร็จ';
      } catch (err) {
        document.getElementById('articleImageName').textContent = '✖ ล้มเหลว';
        App.toast('อัปโหลดล้มเหลว', true);
        console.error('Upload article image error:', err);
      }
    });

    document.getElementById('brokerLogoUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('brokerLogoName').textContent = 'กำลังอัปโหลด...';
      try {
        const url = await this.uploadFile(file);
        document.getElementById('brokerLogo').value = url;
        document.getElementById('brokerLogoName').textContent = '✔ อัปโหลดสำเร็จ';
      } catch (err) {
        document.getElementById('brokerLogoName').textContent = '✖ ล้มเหลว';
        App.toast('อัปโหลดล้มเหลว', true);
        console.error('Upload broker logo error:', err);
      }
    });
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('image', file);
    const token = API.getToken();
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.url;
  },

  // ====== DASHBOARD ======
  async showDashboard() {
    try {
      const stats = await API.getStats();
      document.getElementById('aTotalUsers').textContent = stats.totalUsers;
      document.getElementById('aVipUsers').textContent = stats.vipUsers;
      document.getElementById('aTotalSignals').textContent = stats.totalSignals;
      document.getElementById('aTotalArticles').textContent = stats.totalArticles;
      document.getElementById('aTotalBrokers').textContent = stats.totalBrokers;
    } catch (err) { console.error('showDashboard:', err); }
  },

  // ====== MEMBERS ======
  async renderMembers() {
    try {
      const users = await API.getUsers();
      document.getElementById('membersBody').innerHTML = users.length
        ? users.map(u => {
            const date = new Date(u.created_at).toLocaleDateString('th-TH');
            const vipOptions = ['Free', 'Silver', 'Gold', 'Platinum'].map(l =>
              `<option value="${l}"${u.vip_level === l ? ' selected' : ''}>${l}</option>`
            ).join('');
            return `<tr>
              <td>${u.id}</td>
              <td>${escHtml(u.username)}</td>
              <td>${escHtml(u.email)}</td>
              <td>${u.is_admin ? '<span style="color:var(--gold);font-weight:600">Admin</span>' : '-'}</td>
              <td>
                <select class="vip-select" data-user-id="${u.id}" style="background:var(--bg-input);border:1px solid var(--border);border-radius:5px;padding:0.3rem;color:var(--text)">${vipOptions}</select>
              </td>
              <td>${date}</td>
              <td>
                <button class="btn btn-outline btn-xs" onclick="Admin.toggleAdmin(${u.id}, ${u.is_admin})">${u.is_admin ? 'ลดสิทธิ์' : 'ตั้งเป็น Admin'}</button>
                <button class="btn btn-danger btn-xs" onclick="Admin.deleteUser(${u.id})">ลบ</button>
              </td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="7" style="text-align:center">ไม่มีสมาชิก</td></tr>';

      document.querySelectorAll('.vip-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          await API.updateVipLevel(parseInt(sel.dataset.userId), sel.value);
          App.toast('อัปเดตระดับ VIP แล้ว');
        });
      });
    } catch (err) { console.error('renderMembers:', err); }
  },

  async deleteUser(id) {
    if (!confirm('ลบสมาชิกนี้?')) return;
    try {
      await API.deleteUser(id);
      this.renderMembers();
      App.toast('ลบสมาชิกแล้ว');
    } catch (err) { console.error('deleteUser:', err); }
  },

  async toggleAdmin(userId, current) {
    try {
      await API.updateAdminStatus(userId, !current);
      this.renderMembers();
      App.toast('อัปเดตสิทธิ์ Admin แล้ว');
    } catch (err) { console.error('toggleAdmin:', err); }
  },

  // ====== SIGNALS ======
  populatePairSelect() {
    const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD'];
    const sel = document.getElementById('signalPair');
    sel.innerHTML = '<option value="">เลือกคู่เงิน</option>' + pairs.map(p => `<option value="${p}">${p}</option>`).join('');
  },

  setupSignalForm() {
    document.getElementById('signalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('signalEditId').value;
      const data = {
        pair: document.getElementById('signalPair').value,
        direction: document.getElementById('signalDirection').value,
        entry: document.getElementById('signalEntry').value,
        tp1: document.getElementById('signalTp1').value,
        tp2: document.getElementById('signalTp2').value,
        tp3: document.getElementById('signalTp3').value,
        sl: document.getElementById('signalSl').value,
        status: document.getElementById('signalStatus').value,
        reason: document.getElementById('signalReason').value,
      };

      try {
        if (editId) {
          await API.updateSignal(parseInt(editId), data);
          App.toast('อัปเดตสัญญาณแล้ว');
          App.resetSignalForm();
        } else {
          await API.addSignal(data);
          App.toast('เพิ่มสัญญาณแล้ว');
          e.target.reset();
        }
        this.renderSignals();
      } catch (err) {
        App.toast('เกิดข้อผิดพลาด', true);
        console.error('Signal form error:', err);
      }
    });
  },

  async renderSignals() {
    try {
      const signals = await API.getSignals();
      document.getElementById('signalsBody').innerHTML = signals.length
        ? signals.map(s => {
            const statusColors = { active: 'var(--text-muted)', win: 'var(--green)', loss: 'var(--red)' };
            const time = s.created_at || s.createdAt;
            const timeStr = time ? new Date(time).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }) : '';
            return `<tr>
              <td>${escHtml(s.pair)}</td>
              <td style="color:${s.direction === 'BUY' ? 'var(--green)' : 'var(--red)'};font-weight:600">${escHtml(s.direction)}</td>
              <td>${escHtml(s.entry)}</td>
              <td>${escHtml(s.tp1)}${s.tp2 ? ' / ' + escHtml(s.tp2) : ''}${s.tp3 ? ' / ' + escHtml(s.tp3) : ''}</td>
              <td>${escHtml(s.sl || '-')}</td>
              <td style="color:${statusColors[s.status] || 'var(--text-muted)'};font-weight:600">${escHtml(s.status.toUpperCase())}</td>
              <td style="font-size:0.75rem;color:var(--text-muted);max-width:180px;white-space:normal;line-height:1.3;cursor:pointer" onclick="Admin.showReason(${s.id})" title="คลิกดูเหตุผล">${escHtml((s.reason || '-').substring(0, 60))}${s.reason && s.reason.length > 60 ? '...' : ''}</td>
              <td style="font-size:0.8rem;color:var(--text-muted)">${timeStr}</td>
              <td>
                <button class="btn btn-outline btn-xs" onclick="Admin.editSignal(${s.id})">แก้ไข</button>
                <button class="btn btn-danger btn-xs" onclick="Admin.deleteSignal(${s.id})">ลบ</button>
              </td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="9" style="text-align:center">ไม่มีสัญญาณเทรด</td></tr>';
    } catch (err) { console.error('renderSignals admin:', err); }
  },

  async editSignal(id) {
    try {
      const signals = await API.getSignals();
      const s = signals.find(x => x.id === id);
      if (!s) return;
      document.getElementById('signalPair').value = s.pair;
      document.getElementById('signalDirection').value = s.direction;
      document.getElementById('signalEntry').value = s.entry || '';
      document.getElementById('signalTp1').value = s.tp1 || '';
      document.getElementById('signalTp2').value = s.tp2 || '';
      document.getElementById('signalTp3').value = s.tp3 || '';
      document.getElementById('signalSl').value = s.sl || '';
      document.getElementById('signalStatus').value = s.status || 'active';
      document.getElementById('signalReason').value = s.reason || '';
      document.getElementById('signalEditId').value = s.id;
      document.getElementById('signalSubmit').textContent = 'อัปเดตสัญญาณ';
      document.getElementById('signalCancel').style.display = 'inline-block';
      window.scrollTo({ top: document.getElementById('admin-signals').offsetTop - 60, behavior: 'smooth' });
    } catch (err) { console.error('editSignal:', err); }
  },

  async showReason(id) {
    try {
      const signals = await API.getSignals();
      const s = signals.find(x => x.id === id);
      if (!s || !s.reason) return;
      document.getElementById('reasonModalBody').textContent = s.reason;
      document.getElementById('reasonModal').classList.add('open');
    } catch (err) { console.error('showReason:', err); }
  },

  // Close modal on overlay click
  setupModal() {
    document.getElementById('reasonModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.target.classList.remove('open');
    });
  },

  async deleteSignal(id) {
    if (!confirm('ลบสัญญาณนี้?')) return;
    try {
      await API.deleteSignal(id);
      this.renderSignals();
      App.toast('ลบสัญญาณแล้ว');
    } catch (err) { console.error('deleteSignal:', err); }
  },

  // ====== ARTICLES ======
  setupArticleForm() {
    document.getElementById('articleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('articleEditId').value;
      const data = {
        title: document.getElementById('articleTitle').value,
        content: document.getElementById('articleContent').value,
        image: document.getElementById('articleImage').value,
      };

      try {
        if (editId) {
          await API.updateArticle(parseInt(editId), data);
          App.toast('อัปเดตบทความแล้ว');
          App.resetArticleForm();
        } else {
          await API.addArticle(data);
          App.toast('เพิ่มบทความแล้ว');
          e.target.reset();
        }
        this.renderArticles();
      } catch (err) {
        App.toast('เกิดข้อผิดพลาด', true);
        console.error('Article form error:', err);
      }
    });
  },

  async renderArticles() {
    try {
      const articles = await API.getArticles();
      document.getElementById('articlesBody').innerHTML = articles.length
        ? articles.map(a => {
            const date = new Date(a.created_at).toLocaleDateString('th-TH');
            return `<tr>
              <td>${escHtml(a.title)}</td>
              <td>${date}</td>
              <td>
                <button class="btn btn-outline btn-xs" onclick="Admin.editArticle(${a.id})">แก้ไข</button>
                <button class="btn btn-danger btn-xs" onclick="Admin.deleteArticle(${a.id})">ลบ</button>
              </td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="3" style="text-align:center">ไม่มีบทความ</td></tr>';
    } catch (err) { console.error('renderArticles admin:', err); }
  },

  async editArticle(id) {
    try {
      const articles = await API.getArticles();
      const a = articles.find(x => x.id === id);
      if (!a) return;
      document.getElementById('articleTitle').value = a.title;
      document.getElementById('articleContent').value = a.content;
      document.getElementById('articleImage').value = a.image || '';
      document.getElementById('articleEditId').value = a.id;
      document.getElementById('articleSubmit').textContent = 'อัปเดตบทความ';
      document.getElementById('articleCancel').style.display = 'inline-block';
      window.scrollTo({ top: document.getElementById('admin-articles').offsetTop - 60, behavior: 'smooth' });
    } catch (err) { console.error('editArticle:', err); }
  },

  async deleteArticle(id) {
    if (!confirm('ลบบทความนี้?')) return;
    try {
      await API.deleteArticle(id);
      this.renderArticles();
      App.toast('ลบบทความแล้ว');
    } catch (err) { console.error('deleteArticle:', err); }
  },

  // ====== BROKERS ======
  setupBrokerForm() {
    document.getElementById('brokerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('brokerEditId').value;
      const data = {
        name: document.getElementById('brokerName').value,
        rating: parseFloat(document.getElementById('brokerRating').value),
        description: document.getElementById('brokerDesc').value,
        ibLink: document.getElementById('brokerLink').value,
        logo: document.getElementById('brokerLogo').value,
      };

      try {
        if (editId) {
          await API.updateBroker(parseInt(editId), data);
          App.toast('อัปเดตโบรกเกอร์แล้ว');
          App.resetBrokerForm();
        } else {
          await API.addBroker(data);
          App.toast('เพิ่มโบรกเกอร์แล้ว');
          e.target.reset();
        }
        this.renderBrokers();
      } catch (err) {
        App.toast('เกิดข้อผิดพลาด', true);
        console.error('Broker form error:', err);
      }
    });
  },

  async renderBrokers() {
    try {
      const brokers = await API.getBrokers();
      document.getElementById('brokersBody').innerHTML = brokers.length
        ? brokers.map(b => `<tr>
            <td>${escHtml(b.name)}</td>
            <td>${'★'.repeat(Math.floor(b.rating))} ${b.rating}</td>
            <td><a href="${escHtml(b.ib_link)}" target="_blank" style="font-size:0.8rem">${escHtml(b.ib_link)}</a></td>
            <td>
              <button class="btn btn-outline btn-xs" onclick="Admin.editBroker(${b.id})">แก้ไข</button>
              <button class="btn btn-danger btn-xs" onclick="Admin.deleteBroker(${b.id})">ลบ</button>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center">ไม่มีโบรกเกอร์</td></tr>';
    } catch (err) { console.error('renderBrokers admin:', err); }
  },

  async editBroker(id) {
    try {
      const brokers = await API.getBrokers();
      const b = brokers.find(x => x.id === id);
      if (!b) return;
      document.getElementById('brokerName').value = b.name;
      document.getElementById('brokerRating').value = b.rating;
      document.getElementById('brokerDesc').value = b.description;
      document.getElementById('brokerLink').value = b.ib_link;
      document.getElementById('brokerLogo').value = b.logo || '';
      document.getElementById('brokerEditId').value = b.id;
      document.getElementById('brokerSubmit').textContent = 'อัปเดตโบรกเกอร์';
      document.getElementById('brokerCancel').style.display = 'inline-block';
      window.scrollTo({ top: document.getElementById('admin-brokers').offsetTop - 60, behavior: 'smooth' });
    } catch (err) { console.error('editBroker:', err); }
  },

  async deleteBroker(id) {
    if (!confirm('ลบโบรกเกอร์นี้?')) return;
    try {
      await API.deleteBroker(id);
      this.renderBrokers();
      App.toast('ลบโบรกเกอร์แล้ว');
    } catch (err) { console.error('deleteBroker:', err); }
  },

  // ====== CONTACT ======
  setupContactForm() {
    document.getElementById('contactForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        line_id: document.getElementById('contactLineID').value,
        phone: document.getElementById('contactPhoneInput').value,
        email: document.getElementById('contactEmailInput').value,
        facebook: document.getElementById('contactFacebookInput').value,
        tiktok: document.getElementById('contactTiktokInput').value,
        youtube: document.getElementById('contactYoutubeInput').value,
        openchat: document.getElementById('contactOpenchatInput').value,
        openchat_qr: document.getElementById('contactOpenchatQRInput').value,
        tiktok_qr: document.getElementById('contactTiktokQRInput').value,
        qr_code: document.getElementById('contactQRInput').value,
      };
      try {
        await API.updateContact(data);
        App.toast('บันทึกช่องทางติดต่อแล้ว');
      } catch (err) {
        App.toast('เกิดข้อผิดพลาด', true);
        console.error('Update contact error:', err);
      }
    });

    document.getElementById('contactQRUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('contactQRName').textContent = 'กำลังอัปโหลด...';
      try {
        const url = await this.uploadFile(file);
        document.getElementById('contactQRInput').value = url;
        document.getElementById('contactQRName').textContent = '✔ อัปโหลดแล้ว';
        document.getElementById('contactQRPreview').src = url;
        document.getElementById('contactPreview').style.display = 'block';
      } catch (err) {
        document.getElementById('contactQRName').textContent = '✖ ล้มเหลว';
        console.error('Contact QR upload error:', err);
      }
    });

    document.getElementById('contactOpenchatQRUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('contactOpenchatQRName').textContent = 'กำลังอัปโหลด...';
      try {
        const url = await this.uploadFile(file);
        document.getElementById('contactOpenchatQRInput').value = url;
        document.getElementById('contactOpenchatQRName').textContent = '✔ อัปโหลดแล้ว';
        document.getElementById('contactOpenchatQRPreview').src = url;
        document.getElementById('contactOpenchatPreview').style.display = 'block';
      } catch (err) {
        document.getElementById('contactOpenchatQRName').textContent = '✖ ล้มเหลว';
        console.error('OpenChat QR upload error:', err);
      }
    });

    document.getElementById('contactTiktokQRUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('contactTiktokQRName').textContent = 'กำลังอัปโหลด...';
      try {
        const url = await this.uploadFile(file);
        document.getElementById('contactTiktokQRInput').value = url;
        document.getElementById('contactTiktokQRName').textContent = '✔ อัปโหลดแล้ว';
        document.getElementById('contactTiktokQRPreview').src = url;
        document.getElementById('contactTiktokPreview').style.display = 'block';
      } catch (err) {
        document.getElementById('contactTiktokQRName').textContent = '✖ ล้มเหลว';
        console.error('TikTok QR upload error:', err);
      }
    });
  },

  async renderContactSettings() {
    try {
      const data = await API.getContact();
      document.getElementById('contactLineID').value = data.line_id || '';
      document.getElementById('contactPhoneInput').value = data.phone || '';
      document.getElementById('contactEmailInput').value = data.email || '';
      document.getElementById('contactFacebookInput').value = data.facebook || '';
      document.getElementById('contactTiktokInput').value = data.tiktok || '';
      document.getElementById('contactYoutubeInput').value = data.youtube || '';
      document.getElementById('contactOpenchatInput').value = data.openchat || '';
      document.getElementById('contactQRInput').value = data.qr_code || '';
      document.getElementById('contactOpenchatQRInput').value = data.openchat_qr || '';
      document.getElementById('contactTiktokQRInput').value = data.tiktok_qr || '';
      if (data.qr_code) {
        document.getElementById('contactQRPreview').src = data.qr_code;
        document.getElementById('contactPreview').style.display = 'block';
      }
      if (data.openchat_qr) {
        document.getElementById('contactOpenchatQRPreview').src = data.openchat_qr;
        document.getElementById('contactOpenchatPreview').style.display = 'block';
      }
      if (data.tiktok_qr) {
        document.getElementById('contactTiktokQRPreview').src = data.tiktok_qr;
        document.getElementById('contactTiktokPreview').style.display = 'block';
      }
    } catch (err) { console.error('renderContactSettings:', err); }
  },

  setupBannerForm() {
    // Tab switching
    document.querySelectorAll('.banner-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.banner-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const side = btn.dataset.side;
        document.getElementById('bannerSide').value = side;
        const label = { left: 'ซ้าย', right: 'ขวา', middle: 'กลาง' }[side] || side;
        document.getElementById('bannerSideLabel').textContent = label;
        document.getElementById('bannerHtmlLabel').textContent = '(' + label + ')';
        await this.renderBannerSettings(side);
      });
    });

    document.getElementById('bannerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const side = document.getElementById('bannerSide').value;
        await API.updateBanner({
          html: document.getElementById('bannerHtmlInput').value,
          enabled: document.getElementById('bannerEnabled').checked,
        }, side);
        App.toast('บันทึกแบนเนอร์แล้ว');
        App.renderSideBanner();
        if (side === 'middle') App.renderMiddleBanner();
      } catch (err) {
        App.toast('เกิดข้อผิดพลาด', true);
        console.error('Update banner error:', err);
      }
    });
  },

  async renderBannerSettings(side) {
    try {
      side = side || 'right';
      const data = await API.getBanner(side);
      document.getElementById('bannerEnabled').checked = data.enabled || false;
      document.getElementById('bannerHtmlInput').value = data.html || '';
    } catch (err) { console.error('renderBannerSettings:', err); }
  },

  // ====== AUTO SIGNAL ======

  async renderAutoSignal() {
    try {
      const settings = await API.getAutoSignalSettings();

      // Auto mode controls
      document.getElementById('autoModeToggle').checked = settings.autoMode || false;
      document.getElementById('autoIntervalSelect').value = String(settings.interval || 60);
      this.updateAutoModeUI();

      document.getElementById('autoModeToggle').addEventListener('change', () => this.updateAutoModeUI());
      document.getElementById('autoIntervalSelect').addEventListener('change', () => this.updateAutoModeUI());

      const container = document.getElementById('autoSignalPairs');
      let html = '';
      for (const [catKey, cat] of Object.entries(settings)) {
        if (!Array.isArray(cat)) continue;
        const catLabel = { commodities: '🏆 Commodities', forex: '💱 Forex', crypto: '🪙 Crypto' }[catKey] || catKey;
        html += `<div style="margin-bottom:1.2rem">
          <h3 style="color:#d4a017;font-size:1rem;margin-bottom:0.5rem">${catLabel}</h3>`;
        for (const p of cat) {
          html += `<label class="pair-toggle ${p.enabled ? 'on' : ''}">
            <input type="checkbox" class="auto-pair-cb" data-cat="${catKey}" data-pair="${p.pair}" ${p.enabled ? 'checked' : ''}>
            <span class="pair-name">${p.label}</span>
            <span class="pair-status">${p.enabled ? '✅ ส่ง' : '⛔ ไม่ส่ง'}</span>
          </label>`;
        }
        html += `</div>`;
      }
      container.innerHTML = html;

      container.querySelectorAll('.auto-pair-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          cb.closest('.pair-toggle').classList.toggle('on', cb.checked);
          cb.closest('.pair-toggle').querySelector('.pair-status').textContent = cb.checked ? '✅ ส่ง' : '⛔ ไม่ส่ง';
        });
      });

      const collectSettings = () => {
        const out = { autoMode: document.getElementById('autoModeToggle').checked, interval: parseInt(document.getElementById('autoIntervalSelect').value) };
        for (const [catKey, cat] of Object.entries(settings)) {
          if (!Array.isArray(cat)) continue;
          out[catKey] = cat.map(p => ({
            ...p,
            enabled: !!document.querySelector(`.auto-pair-cb[data-cat="${catKey}"][data-pair="${p.pair}"]`).checked,
          }));
        }
        return out;
      };

      document.getElementById('autoSaveBtn').onclick = async () => {
        try {
          await API.saveAutoSignalSettings(collectSettings());
          App.toast('บันทึกการตั้งค่าแล้ว');
        } catch (err) {
          App.toast('บันทึกผิดพลาด', true);
        }
      };

      document.getElementById('autoAnalyzeBtn').onclick = async () => {
        const newSettings = collectSettings();
        try {
          await API.saveAutoSignalSettings(newSettings);
        } catch (err) { /* ignore */ }
        this.runAutoAnalyze(newSettings);
      };

    } catch (err) {
      console.error('renderAutoSignal:', err);
      document.getElementById('autoSignalPairs').innerHTML = '<p style="color:#f88">โหลดข้อมูลล้มเหลว</p>';
    }
  },

  updateAutoModeUI() {
    const on = document.getElementById('autoModeToggle').checked;
    document.getElementById('autoModeStatus').textContent = on ? 'เปิด' : 'ปิด';
    document.getElementById('autoModeStatus').style.color = on ? 'var(--gold)' : 'var(--text-muted)';
  },

  async runAutoAnalyze(settings) {
    const enabled = Object.values(settings).flat().filter(p => p.enabled);
    if (enabled.length === 0) {
      App.toast('กรุณาเลือกคู่เงินที่ต้องการวิเคราะห์ก่อน', true);
      return;
    }

    const resultDiv = document.getElementById('autoAnalyzeResult');
    const bodyDiv = document.getElementById('autoAnalyzeBody');
    const confirmRow = document.getElementById('autoConfirmRow');
    resultDiv.style.display = 'none';

    App.toast('กำลังวิเคราะห์ SMC... โปรดรอ');

    try {
      const res = await API.analyzeAutoSignals();
      const { results, analyzedAt } = res;
      resultDiv.style.display = 'block';

      const hasSetup = results.filter(r => r.hasSetup);
      let html = `<p style="color:#888;font-size:0.85rem;margin-bottom:0.8rem">วิเคราะห์เมื่อ: ${new Date(analyzedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>`;

      for (const r of results) {
        if (r.hasSetup) {
          html += `<div class="signal-item" style="border-color:#2a5a2a">
            <div class="info">
              <span class="pair" style="color:#d4a017">${r.pair}</span>
              <span class="dir ${r.direction === 'BUY' ? 'buy' : 'sell'}">${r.direction}</span>
              <span style="color:#fff">@${r.entry}</span>
              <div class="detail">
                TP1: ${r.tp1||'-'} | TP2: ${r.tp2||'-'} | TP3: ${r.tp3||'-'} | SL: ${r.sl||'-'}
                <br><span style="color:#aaa">${r.reason||''}</span>
              </div>
            </div>
          </div>`;
        } else {
          html += `<div class="signal-item" style="border-color:#333;opacity:0.6">
            <div class="info">
              <span style="color:#888">${r.pair}</span>
              <span style="color:#666">— ไม่มี SMC Setup</span>
              ${r.error ? `<div class="detail" style="color:#f88">Error: ${r.error}</div>` : ''}
            </div>
          </div>`;
        }
      }

      bodyDiv.innerHTML = html;

      if (hasSetup.length > 0) {
        confirmRow.style.display = 'flex';
        const pendingSignals = hasSetup;
        document.getElementById('autoConfirmBtn').onclick = async () => {
          try {
            await API.confirmAutoSignals(pendingSignals);
            App.toast(`✅ ส่ง Signal แล้ว ${pendingSignals.length} รายการ`);
            confirmRow.style.display = 'none';
            bodyDiv.innerHTML = '<p style="color:#8f8">✅ ส่ง Signal เรียบร้อยแล้ว</p>';
            if (typeof Admin.renderSignals === 'function') Admin.renderSignals();
          } catch (err) {
            App.toast('ส่ง Signal ล้มเหลว', true);
          }
        };
        document.getElementById('autoCancelBtn').onclick = () => {
          confirmRow.style.display = 'none';
          bodyDiv.innerHTML = '<p style="color:#888">ยกเลิกการส่งแล้ว</p>';
        };
      } else {
        confirmRow.style.display = 'none';
      }
    } catch (err) {
      resultDiv.style.display = 'block';
      bodyDiv.innerHTML = `<p style="color:#f88">วิเคราะห์ล้มเหลว: ${err.message}</p>`;
      App.toast('วิเคราะห์ล้มเหลว', true);
    }
  },

  // ====== AI SETTINGS ======
  async renderAiSettings() {
    try {
      const settings = await API.getAiSettings();
      document.getElementById('aiSettingsModel').value = settings.model || 'gpt-4o-mini';
      document.getElementById('aiSettingsTemp').value = settings.temperature || 0.7;
      document.getElementById('aiSettingsMax').value = settings.maxSignalsPerDay || 4;
      const prompt = settings.prompt || '';
      document.getElementById('aiSettingsPrompt').value = prompt;

      const rendered = prompt.replace(/\{pair\}/g, 'XAU/USD');
      document.getElementById('aiSettingsPreview').textContent = rendered;

      document.getElementById('aiSettingsPrompt').addEventListener('input', () => {
        const p = document.getElementById('aiSettingsPrompt').value;
        document.getElementById('aiSettingsPreview').textContent = p.replace(/\{pair\}/g, 'XAU/USD');
      });

      try {
        const perf = await API.getPerformanceStats();
        const s = perf.summary;
        const total = parseInt(s.total);
        const wins = parseInt(s.wins);
        const losses = parseInt(s.losses);
        const winRate = total > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0';
        document.getElementById('aiSettingsStatus').innerHTML = `
          <div class="admin-stat-card" style="flex:1;min-width:120px"><h3>🤖 โมเดล</h3><p style="font-size:0.85rem">${settings.model || 'gpt-4o-mini'}</p></div>
          <div class="admin-stat-card" style="flex:1;min-width:120px"><h3>🌡️ Temperature</h3><p style="font-size:0.85rem">${settings.temperature || 0.7}</p></div>
          <div class="admin-stat-card" style="flex:1;min-width:120px"><h3>📊 Win Rate</h3><p style="font-size:0.85rem">${winRate}%</p></div>
          <div class="admin-stat-card" style="flex:1;min-width:120px"><h3>⏰ กำหนดการ</h3><p style="font-size:0.85rem">ทุก 30 นาที</p></div>
        `;
      } catch { /* ignore */ }

      try {
        const signals = await API.getSignals();
        const today = new Date().toISOString().slice(0, 10);
        const todaySignals = signals.filter(s => s.created_at && s.created_at.slice(0, 10) === today);
        document.getElementById('aiSettingsTodaySignals').innerHTML = todaySignals.length
          ? todaySignals.map(s => {
              const st = s.direction === 'BUY' ? '🟢' : '🔴';
              return `<div style="padding:0.3rem 0;border-bottom:1px solid #222;display:flex;gap:0.5rem">
                <span>${st}</span>
                <span style="color:#d4a017">${s.pair}</span>
                <span style="color:${s.direction === 'BUY' ? 'var(--green)' : 'var(--red)'}">${s.direction}</span>
                <span style="color:#888">@${s.entry || '-'}</span>
                <span style="color:var(--text-muted);font-size:0.75rem">${s.status}</span>
              </div>`;
            }).join('')
          : '<p style="color:#888">— ยังไม่มีสัญญาณวันนี้ —</p>';
      } catch { /* ignore */ }

      document.getElementById('aiSettingsForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
          await API.saveAiSettings({
            model: document.getElementById('aiSettingsModel').value,
            temperature: parseFloat(document.getElementById('aiSettingsTemp').value),
            maxSignalsPerDay: parseInt(document.getElementById('aiSettingsMax').value),
            prompt: document.getElementById('aiSettingsPrompt').value,
          });
          App.toast('บันทึก AI Settings แล้ว');
        } catch (err) { App.toast('บันทึกผิดพลาด', true); }
      };

      document.getElementById('aiSettingsTestBtn').onclick = async () => {
        const resultDiv = document.getElementById('aiSettingsTestResult');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p style="color:#888">🤖 กำลังทดสอบ AI...</p>';
        try {
          const res = await API.testAiSettings({
            prompt: document.getElementById('aiSettingsPrompt').value,
            pair: 'XAU/USD',
          });
          const hasSetup = res.result && res.result.hasSetup;
          const icon = hasSetup ? '🟢' : '⚪';
          resultDiv.innerHTML = `<div style="margin-bottom:0.5rem;font-size:0.9rem">${icon} ผลการทดสอบ AI</div>
            <pre style="font-size:0.8rem;white-space:pre-wrap;word-break:break-word;background:#111;padding:0.8rem;border-radius:6px">${escHtml(JSON.stringify(res.result, null, 2))}</pre>`;
        } catch (err) {
          resultDiv.innerHTML = `<p style="color:#f88">❌ ทดสอบล้มเหลว: ${escHtml(err.message)}</p>`;
        }
      };
    } catch (err) { console.error('renderAiSettings:', err); }
  },

  // ====== AI ARTICLE SETTINGS ======
  async renderAiArticleSettings() {
    try {
      const settings = await API.getAiArticleSettings();
      document.getElementById('aiArticleSettingsModel').value = settings.model || 'gpt-4o-mini';
      document.getElementById('aiArticleSettingsTemp').value = settings.temperature || 0.7;
      const prompt = settings.prompt || '';
      document.getElementById('aiArticleSettingsPrompt').value = prompt;

      const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });
      const rendered = prompt.replace(/\{price\}/g, '3,150.00').replace(/\{date\}/g, today);
      document.getElementById('aiArticleSettingsPreview').textContent = rendered;

      document.getElementById('aiArticleSettingsPrompt').addEventListener('input', () => {
        const p = document.getElementById('aiArticleSettingsPrompt').value;
        document.getElementById('aiArticleSettingsPreview').textContent = p.replace(/\{price\}/g, '3,150.00').replace(/\{date\}/g, today);
      });

      try {
        document.getElementById('aiArticleSettingsStatus').innerHTML = `
          <div class="admin-stat-card" style="flex:1;min-width:120px"><h3>🤖 โมเดล</h3><p style="font-size:0.85rem">${settings.model || 'gpt-4o-mini'}</p></div>
          <div class="admin-stat-card" style="flex:1;min-width:120px"><h3>🌡️ Temperature</h3><p style="font-size:0.85rem">${settings.temperature || 0.7}</p></div>
          <div class="admin-stat-card" style="flex:1;min-width:120px"><h3>⏰ สร้างทุก</h3><p style="font-size:0.85rem">30 นาที (หลัง Signal)</p></div>
        `;
      } catch { /* ignore */ }

      try {
        const articles = await API.getArticles();
        const aiArticles = articles.filter(a => a.title.includes('ทอง') || a.title.includes('XAU') || a.title.includes('Gold')).slice(0, 5);
        document.getElementById('aiArticleSettingsRecent').innerHTML = aiArticles.length
          ? aiArticles.map(a => {
              const date = new Date(a.created_at).toLocaleDateString('th-TH');
              return `<div style="padding:0.4rem 0;border-bottom:1px solid #222">
                <a href="#/articles" style="color:#d4a017;text-decoration:none">📰 ${escHtml(a.title)}</a>
                <span style="color:#888;font-size:0.75rem;margin-left:0.5rem">${date}</span>
              </div>`;
            }).join('')
          : '<p style="color:#888">— ยังไม่มีบทความที่สร้างโดย AI —</p>';
      } catch { /* ignore */ }

      document.getElementById('aiArticleSettingsForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
          await API.saveAiArticleSettings({
            model: document.getElementById('aiArticleSettingsModel').value,
            temperature: parseFloat(document.getElementById('aiArticleSettingsTemp').value),
            prompt: document.getElementById('aiArticleSettingsPrompt').value,
          });
          App.toast('บันทึก AI Article Settings แล้ว');
        } catch (err) { App.toast('บันทึกผิดพลาด', true); }
      };

      document.getElementById('aiArticleSettingsTestBtn').onclick = async () => {
        const resultDiv = document.getElementById('aiArticleSettingsTestResult');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p style="color:#888">🤖 กำลังทดสอบ AI...</p>';
        try {
          const res = await API.testAiArticleSettings({
            prompt: document.getElementById('aiArticleSettingsPrompt').value,
          });
          const hasTitle = res.result && res.result.title;
          const icon = hasTitle ? '✅' : '⚠️';
          resultDiv.innerHTML = `<div style="margin-bottom:0.5rem;font-size:0.9rem">${icon} ผลการทดสอบ AI</div>
            <pre style="font-size:0.8rem;white-space:pre-wrap;word-break:break-word;background:#111;padding:0.8rem;border-radius:6px">${escHtml(JSON.stringify(res.result, null, 2))}</pre>`;
        } catch (err) {
          resultDiv.innerHTML = `<p style="color:#f88">❌ ทดสอบล้มเหลว: ${escHtml(err.message)}</p>`;
        }
      };

      document.getElementById('aiArticleSettingsGenerateBtn').onclick = async () => {
        const resultDiv = document.getElementById('aiArticleSettingsTestResult');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p style="color:#888">📝 กำลังสร้างบทความ...</p>';
        try {
          const article = await API.generateAiArticle();
          resultDiv.innerHTML = `<p style="color:#8f8">✅ สร้างบทความสำเร็จ: <strong>${escHtml(article.title)}</strong></p>`;
          if (typeof Admin.renderArticles === 'function') Admin.renderArticles();
        } catch (err) {
          resultDiv.innerHTML = `<p style="color:#f88">❌ สร้างบทความล้มเหลว: ${escHtml(err.message)}</p>`;
        }
      };
    } catch (err) { console.error('renderAiArticleSettings:', err); }
  },

  // ====== PERFORMANCE ======
  async renderPerformance() {
    try {
      const perf = await API.getPerformanceStats();
      const s = perf.summary;
      const total = parseInt(s.total);
      const wins = parseInt(s.wins);
      const losses = parseInt(s.losses);
      const winRate = total > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0';

      document.getElementById('performanceSummary').innerHTML = `
        <div class="admin-stat-card"><h3>สัญญาณทั้งหมด</h3><p>${total}</p></div>
        <div class="admin-stat-card"><h3>ชนะ</h3><p style="color:var(--green)">${wins}</p></div>
        <div class="admin-stat-card"><h3>แพ้</h3><p style="color:var(--red)">${losses}</p></div>
        <div class="admin-stat-card"><h3>Win Rate</h3><p style="color:var(--gold)">${winRate}%</p></div>
        <div class="admin-stat-card"><h3>กำลังดำเนินการ</h3><p style="color:var(--text-muted)">${s.active}</p></div>
      `;

      document.getElementById('performancePairBody').innerHTML = perf.byPair.length
        ? perf.byPair.map(p => {
            const pwins = parseInt(p.wins);
            const plosses = parseInt(p.losses);
            const prate = (pwins + plosses) > 0 ? ((pwins / (pwins + plosses)) * 100).toFixed(1) : '0';
            return `<tr><td>${p.pair}</td><td>${p.total}</td><td style="color:var(--green)">${pwins}</td><td style="color:var(--red)">${plosses}</td><td style="color:var(--gold)">${prate}%</td></tr>`;
          }).join('')
        : '<tr><td colspan="5" style="text-align:center">ไม่มีข้อมูล</td></tr>';

      document.getElementById('performanceMonthlyBody').innerHTML = perf.monthly.length
        ? perf.monthly.map(m => {
            const mwins = parseInt(m.wins);
            const mtotal = parseInt(m.total);
            const mrate = mtotal > 0 ? ((mwins / mtotal) * 100).toFixed(1) : '0';
            return `<tr><td>${m.month}</td><td>${mtotal}</td><td style="color:var(--green)">${mwins}</td><td style="color:var(--gold)">${mrate}%</td></tr>`;
          }).join('')
        : '<tr><td colspan="4" style="text-align:center">ไม่มีข้อมูล</td></tr>';
    } catch (err) { console.error('renderPerformance:', err); }
  },

  // ====== EA DASHBOARD ======
  async renderEaDashboard() {
    try {
      const config = await API.getEaConfig();
      document.getElementById('eaEnabled').checked = config.enabled || false;
      document.getElementById('eaLotSize').value = config.lotSize || 0.01;
      document.getElementById('eaTpMode').value = String(config.tpMode || 1);

      const pairsContainer = document.getElementById('eaAllowedPairs');
      const allPairs = config.allPairs || ['XAU/USD','XAG/USD','EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','NZD/USD','USD/CAD','BTC/USD','ETH/USD','XRP/USD'];
      const allowed = config.allowedPairs || [];
      pairsContainer.innerHTML = allPairs.map(p => {
        const checked = allowed.includes(p);
        return `<label class="pair-toggle ${checked ? 'on' : ''}" style="margin:0">
          <input type="checkbox" class="ea-pair-cb" data-pair="${p}" ${checked ? 'checked' : ''}>
          <span class="pair-name">${p}</span>
        </label>`;
      }).join('');

      pairsContainer.querySelectorAll('.ea-pair-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          cb.closest('.pair-toggle').classList.toggle('on', cb.checked);
        });
      });

      document.getElementById('eaConfigForm').onsubmit = async (e) => {
        e.preventDefault();
        const selected = [];
        document.querySelectorAll('.ea-pair-cb:checked').forEach(cb => selected.push(cb.dataset.pair));
        try {
          await API.saveEaConfig({
            enabled: document.getElementById('eaEnabled').checked,
            lotSize: parseFloat(document.getElementById('eaLotSize').value),
            tpMode: parseInt(document.getElementById('eaTpMode').value),
            allowedPairs: selected,
          });
          App.toast('บันทึก EA Config แล้ว');
        } catch (err) { App.toast('บันทึกผิดพลาด', true); }
      };

      // Load logs
      await this._loadEaLogs();
      document.getElementById('eaClearLogsBtn').onclick = async () => {
        try {
          await API.clearEaLogs();
          document.getElementById('eaLogContent').innerHTML = '<p style="color:#888">— ลบ Log แล้ว —</p>';
          App.toast('ลบ Log แล้ว');
        } catch (err) { App.toast('ลบ Log ล้มเหลว', true); }
      };
    } catch (err) { console.error('renderEaDashboard:', err); }
  },

  async _loadEaLogs() {
    try {
      const data = await API.getEaLogs();
      const logDiv = document.getElementById('eaLogContent');
      if (!data.logs) {
        logDiv.innerHTML = '<p style="color:#888">— ยังไม่มี Log —</p>';
        return;
      }
      logDiv.innerHTML = Object.entries(data.logs).map(([k, v]) => {
        const val = typeof v === 'object' ? JSON.stringify(v) : v;
        return `<div><span style="color:var(--gold)">${k}:</span> ${escHtml(String(val))}</div>`;
      }).join('');
    } catch (err) {
      document.getElementById('eaLogContent').innerHTML = '<p style="color:#888">— ยังไม่มี Log —</p>';
    }
  },
};
