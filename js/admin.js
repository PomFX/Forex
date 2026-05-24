// ====== ADMIN PANEL ======
const Admin = {
  // ====== UPLOAD ======
  setupUploads() {
    // Article image upload
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
      }
    });

    // Broker logo upload
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
    } catch {}
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
              <td>${u.username}</td>
              <td>${u.email}</td>
              <td>
                <select class="vip-select" data-user-id="${u.id}" style="background:var(--bg-input);border:1px solid var(--border);border-radius:5px;padding:0.3rem;color:var(--text)">${vipOptions}</select>
              </td>
              <td>${date}</td>
              <td><button class="btn btn-danger btn-xs" onclick="Admin.deleteUser(${u.id})">ลบ</button></td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="6" style="text-align:center">ไม่มีสมาชิก</td></tr>';

      document.querySelectorAll('.vip-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          await API.updateVipLevel(parseInt(sel.dataset.userId), sel.value);
          App.toast('อัปเดตระดับ VIP แล้ว');
        });
      });
    } catch {}
  },

  async deleteUser(id) {
    if (!confirm('ลบสมาชิกนี้?')) return;
    try {
      await API.deleteUser(id);
      this.renderMembers();
      App.toast('ลบสมาชิกแล้ว');
    } catch {}
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
      }
    });
  },

  async renderSignals() {
    try {
      const signals = await API.getSignals();
      document.getElementById('signalsBody').innerHTML = signals.length
        ? signals.map(s => {
            const statusColors = { active: 'var(--text-muted)', win: 'var(--green)', loss: 'var(--red)' };
            return `<tr>
              <td>${s.pair}</td>
              <td style="color:${s.direction === 'BUY' ? 'var(--green)' : 'var(--red)'};font-weight:600">${s.direction}</td>
              <td>${s.entry}</td>
              <td>${s.tp1}${s.tp2 ? ' / ' + s.tp2 : ''}${s.tp3 ? ' / ' + s.tp3 : ''}</td>
              <td>${s.sl || '-'}</td>
              <td style="color:${statusColors[s.status] || 'var(--text-muted)'};font-weight:600">${s.status.toUpperCase()}</td>
              <td>
                <button class="btn btn-outline btn-xs" onclick="Admin.editSignal(${s.id})">แก้ไข</button>
                <button class="btn btn-danger btn-xs" onclick="Admin.deleteSignal(${s.id})">ลบ</button>
              </td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="7" style="text-align:center">ไม่มีสัญญาณเทรด</td></tr>';
    } catch {}
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
      document.getElementById('signalEditId').value = s.id;
      document.getElementById('signalSubmit').textContent = 'อัปเดตสัญญาณ';
      document.getElementById('signalCancel').style.display = 'inline-block';
      window.scrollTo({ top: document.getElementById('admin-signals').offsetTop - 60, behavior: 'smooth' });
    } catch {}
  },

  async deleteSignal(id) {
    if (!confirm('ลบสัญญาณนี้?')) return;
    try {
      await API.deleteSignal(id);
      this.renderSignals();
      App.toast('ลบสัญญาณแล้ว');
    } catch {}
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
      } catch {}
    });
  },

  async renderArticles() {
    try {
      const articles = await API.getArticles();
      document.getElementById('articlesBody').innerHTML = articles.length
        ? articles.map(a => {
            const date = new Date(a.created_at).toLocaleDateString('th-TH');
            return `<tr>
              <td>${a.title}</td>
              <td>${date}</td>
              <td>
                <button class="btn btn-outline btn-xs" onclick="Admin.editArticle(${a.id})">แก้ไข</button>
                <button class="btn btn-danger btn-xs" onclick="Admin.deleteArticle(${a.id})">ลบ</button>
              </td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="3" style="text-align:center">ไม่มีบทความ</td></tr>';
    } catch {}
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
    } catch {}
  },

  async deleteArticle(id) {
    if (!confirm('ลบบทความนี้?')) return;
    try {
      await API.deleteArticle(id);
      this.renderArticles();
      App.toast('ลบบทความแล้ว');
    } catch {}
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
      } catch {}
    });
  },

  async renderBrokers() {
    try {
      const brokers = await API.getBrokers();
      document.getElementById('brokersBody').innerHTML = brokers.length
        ? brokers.map(b => `<tr>
            <td>${b.name}</td>
            <td>${'★'.repeat(Math.floor(b.rating))} ${b.rating}</td>
            <td><a href="${b.ib_link}" target="_blank" style="font-size:0.8rem">${b.ib_link}</a></td>
            <td>
              <button class="btn btn-outline btn-xs" onclick="Admin.editBroker(${b.id})">แก้ไข</button>
              <button class="btn btn-danger btn-xs" onclick="Admin.deleteBroker(${b.id})">ลบ</button>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center">ไม่มีโบรกเกอร์</td></tr>';
    } catch {}
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
    } catch {}
  },

  async deleteBroker(id) {
    if (!confirm('ลบโบรกเกอร์นี้?')) return;
    try {
      await API.deleteBroker(id);
      this.renderBrokers();
      App.toast('ลบโบรกเกอร์แล้ว');
    } catch {}
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
      } catch {}
    });

    // QR upload Line
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
      } catch {
        document.getElementById('contactQRName').textContent = '✖ ล้มเหลว';
      }
    });

    // QR upload OpenChat
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
      } catch {
        document.getElementById('contactOpenchatQRName').textContent = '✖ ล้มเหลว';
      }
    });

    // QR upload TikTok
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
      } catch {
        document.getElementById('contactTiktokQRName').textContent = '✖ ล้มเหลว';
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
    } catch {}
  }
};
