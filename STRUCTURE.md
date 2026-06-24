# ATH Trader — โครงสร้างระบบ และ คู่มือปรับปรุง

## สารบัญ
1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [โครงสร้างไฟล์](#2-โครงสร้างไฟล์)
3. [Frontend (SPA)](#3-frontend-spa)
4. [Backend (Express API)](#4-backend-express-api)
5. [Vercel Deployment](#5-vercel-deployment)
6. [Database (PostgreSQL)](#6-database-postgresql)
7. [MT5 EA Integration](#7-mt5-ea-integration)
8. [การเพิ่มหน้าใหม่](#8-การเพิ่มหน้าใหม่)
9. [การเพิ่ม API Route ใหม่](#9-การเพิ่ม-api-route-ใหม่)
10. [Environment Variables](#10-environment-variables)
11. [Git & การ Deploy](#11-git--การ-deploy)

---

## 1. ภาพรวมระบบ

```
┌─────────────────────────────────────────────┐
│           Vercel (CDN + Serverless)          │
│                                              │
│  /index.html ←─┐                            │
│  /js/*.js      │  SPA Fallback:             │
│  /css/*.css    │  (.*) → /index.html        │
│  /api/*        │  API Rewrite:              │
│    └── api/index.js → server/app.js         │
│         ├── routes/auth.js          (JWT)    │
│         ├── routes/signals.js                │
│         ├── routes/articles.js               │
│         ├── routes/brokers.js                │
│         ├── routes/stats.js                  │
│         ├── routes/users.js                  │
│         ├── routes/settings.js               │
│         ├── routes/upload.js                 │
│         ├── routes/market.js                 │
│         ├── routes/line.js                   │
│         ├── routes/auto-signals.js           │
│         ├── routes/ai-settings.js            │
│         ├── routes/ai-article-settings.js    │
│         └── routes/ea-dashboard.js           │
│                                              │
│  PostgreSQL (via pg)                         │
│    ├── users       (id, username, email...)  │
│    ├── signals     (id, pair, direction...)  │
│    ├── articles    (id, title, content...)   │
│    ├── brokers     (id, name, rating...)     │
│    └── site_settings (key, value)            │
└─────────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────┐
│  MT5 (SignalReceiverATH.ex5)                │
│   └── WebRequest GET /api/signals/mt5       │
│       └── X-MT5-Key auth                    │
└─────────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────┐
│  GitHub Actions                              │
│   ├── ai-signals.yml (ทุก 30 นาที)           │
│   │   ├── generate (AI → DB)                │
│   │   ├── evaluate (check SL/TP)            │
│   │   └── article (create AI article)       │
│   └── auto-signals-runner.yml               │
└─────────────────────────────────────────────┘
```

## 2. โครงสร้างไฟล์

```
Forex/
│
├── index.html              # SPA หลัก (frontend ทั้งหมด 519 บรรทัด)
├── vercel.json              # Vercel config
├── package.json             # dependencies (express, pg, jwt, openai, sharp...)
├── .env                     # local environment variables
├── logo.svg                 # โลโก้เว็บ
│
├── js/                      # Frontend JavaScript
│   ├── api.js               # API client (fetch wrapper, token: athtrader_token)
│   ├── auth.js              # Auth logic (login, register, JWT)
│   ├── router.js            # SPA Router (hash-based)
│   ├── app.js               # Frontend UI (pages components, 417 บรรทัด)
│   ├── admin.js             # Admin panel UI (675 บรรทัด)
│   └── data.js              # Static data (pairs, VIP plans)
│
├── css/
│   └── style.css            # Dark theme Navy/Gold (714 บรรทัด)
│
├── server/                  # Backend (Express)
│   ├── app.js               # Express app shared (routes + middleware)
│   ├── server.js            # entry point (local dev, import app.js + listen)
│   ├── db.js                # PostgreSQL connection + schema init + seed data
│   └── routes/              # API route handlers (15 ไฟล์)
│       ├── auth.js          # /api/auth (login, register, JWT + rate limiter)
│       ├── signals.js       # /api/signals (CRUD + AI + MT5 + evaluate)
│       ├── articles.js      # /api/articles (CRUD + AI endpoint)
│       ├── brokers.js       # /api/brokers (CRUD)
│       ├── users.js         # /api/users (admin manage: vip, admin, delete)
│       ├── stats.js         # /api/stats (dashboard + public + gold)
│       ├── settings.js      # /api/settings (contact + banner left/right/middle)
│       ├── upload.js        # /api/upload (multer + sharp → WebP base64)
│       ├── market.js        # /api/market (live forex/gold prices proxy)
│       ├── line.js          # /api/line (LINE webhook receiver)
│       ├── auto-signals.js  # /api/auto-signals (AI generate + settings + confirm)
│       ├── ai-settings.js   # /api/ai-settings (AI signal config)
│       ├── ai-article-settings.js # /api/ai-article-settings (AI article config)
│       ├── ea-dashboard.js  # /api/ea (EA config + logs + heartbeat)
│       └── mt5-signal-settings.js # /api/mt5-signal-settings (MT5 → LINE routing)
│
├── api/
│   └── index.js             # Vercel serverless entry (import app.js + initDB)
│
├── mt5/
│   ├── SignalReceiverATH.mq5 # MT5 Expert Advisor (603 บรรทัด, pending order)
│   └── WebRequestTest.mq5   # MT5 WebRequest test
│
├── scripts/                 # GitHub Actions scripts (4 ไฟล์)
│   ├── ai-signals.js        # AI signal generator (SMC M15)
│   ├── ai-article.js        # AI gold analysis article generator
│   ├── evaluate-signals.js  # Evaluate active signals against live prices
│   └── line.js              # LINE Messaging push notifications
│
├── test-signal.html         # หน้าทดสอบส่ง Signal (standalone)
├── mt5-guide.html           # คู่มือติดตั้ง EA
├── auto-signal-guide.html   # คู่มือ Auto Signal
├── api-docs.html            # API Documentation
│
├── .github/workflows/
│   ├── ai-signals.yml       # GitHub Actions schedule (ทุก 30 นาที)
│   └── auto-signals-runner.yml
│
├── CONTEXT.md               # Glossary & domain docs
├── STRUCTURE.md             # ไฟล์นี้ — โครงสร้างระบบ
├── คู่มือการใช้งาน.md        # User manual
└── uploads/                 # Image uploads (base64 / webp)
```

## 3. Frontend (SPA)

### 3.1 Routing (js/router.js)

ใช้ **hash-based routing** (`#/path`):

```
#/                      →  หน้าแรก (home)
#/signals               →  สัญญาณเทรด
#/articles              →  บทความ
#/brokers               →  โบรกเกอร์
#/vip                   →  แพ็กเกจ VIP
#/contact               →  ติดต่อ
#/login                 →  เข้าสู่ระบบ
#/register              →  สมัครสมาชิก
#/admin                 →  Admin Dashboard
#/admin/members         →  Admin จัดการสมาชิก
#/admin/signals         →  Admin จัดการสัญญาณ
#/admin/articles        →  Admin จัดการบทความ
#/admin/brokers         →  Admin จัดการโบรกเกอร์
#/admin/contact         →  Admin จัดการติดต่อ
#/admin/banner          →  Admin จัดการแบนเนอร์ (ซ้าย/ขวา/กลาง)
#/admin/autosignal      →  Admin Auto Signal
```

**การเพิ่มหน้าใหม่:**
1. เพิ่ม `<section class="page" id="page-ชื่อ">...</section>` ใน `index.html`
2. เพิ่ม `case 'ชื่อ'` ใน `Router.handleRoute()` (js/router.js)
3. เพิ่มใน `showPage()` map
4. ถ้าเป็น Admin page: เพิ่ม `<div id="admin-ชื่อ">` และ `case 'ชื่อ'`

### 3.2 API Client (js/api.js)

`API._fetch()` จะ:
- เรียก `/api{path}` (relative)
- ใส่ `Authorization: Bearer {token}` อัตโนมัติถ้ามี token
- parse JSON response
- throw error ถ้า response ไม่ ok
- Token เก็บใน `localStorage` key `athtrader_token`

**การเพิ่ม API method ใหม่:**
```js
// ใน js/api.js
async getSomething() {
  return this._fetch('/some-path');
},
async createSomething(data) {
  return this._fetch('/some-path', { method: 'POST', body: JSON.stringify(data) });
},
```

### 3.3 Auth (js/auth.js)

- ใช้ JWT token เก็บใน `localStorage` key `athtrader_token`
- User เก็บใน `localStorage` key `athtrader_user`
- `Auth.requireAdmin()` → เช็คว่า token มี `isAdmin === true` หรือ `role === 'admin'`
- Super Admin ตรวจจาก env vars (`ADMIN_EMAIL` + `ADMIN_PASSWORD`)
- ผู้ใช้ทั่วไปตรวจจาก database (`users` table, `is_admin` column)

### 3.4 Admin Panel (js/admin.js, index.html)

Admin sidebar อยู่ใน `<nav class="admin-nav">` (index.html ~line 254)
แต่ละเมนูเชื่อมกับ `data-page="ชื่อ"` ซึ่งตรงกับ `id="admin-ชื่อ"`

**เมนู Admin ปัจจุบัน:**
| เมนู | Route | data-page |
|------|-------|-----------|
| Dashboard | `#/admin` | dashboard |
| สมาชิก | `#/admin/members` | members |
| สัญญาณเทรด | `#/admin/signals` | signals |
| บทความ | `#/admin/articles` | articles |
| โบรกเกอร์ | `#/admin/brokers` | brokers |
| ติดต่อ | `#/admin/contact` | contact |
| แบนเนอร์ | `#/admin/banner` | banner |
| Auto Signal | `#/admin/autosignal` | autosignal |
| AI Settings | `#/admin/aisettings` | aisettings |
| AI Article | `#/admin/aiarticlesettings` | aiarticlesettings |
| ผลงาน | `#/admin/performance` | performance |
| EA Dashboard | `#/admin/eadashboard` | eadashboard |
| MT5 Signal Settings | `#/admin/mt5signals` | mt5signals |

**การเพิ่มเมนู Admin ใหม่:**
1. เพิ่ม `<a href="#/admin/ชื่อ" data-page="ชื่อ">ชื่อเมนู</a>` ใน sidebar (`index.html`)
2. เพิ่ม `<div id="admin-ชื่อ" class="admin-page-content">...</div>` ใน `index.html`
3. เพิ่ม `case 'ชื่อ': await Admin.renderชื่อ(); break;` ใน `router.js`
4. เขียน `Admin.renderชื่อ()` ใน `js/admin.js`
5. ถ้าเรียก API → เพิ่ม method ใน `js/api.js`

## 4. Backend (Express API)

### 4.1 Entry Points

| Environment | File | Description |
|-------------|------|-------------|
| Local dev | `server/server.js` | import app.js → static + SPA fallback + `listen(PORT)` |
| Vercel | `api/index.js` | import app.js → initDB() → export serverless |

### 4.2 API Routes

| Method | Route | File | Auth | Description |
|--------|-------|------|------|-------------|
| POST | `/api/auth/register` | auth.js | Public | Register |
| POST | `/api/auth/login` | auth.js | Rate-limited | Login (JWT) |
| GET | `/api/auth/me` | auth.js | JWT | Get current user |
| GET | `/api/signals` | signals.js | Public | Get all signals (XAU/USD first) |
| POST | `/api/signals` | signals.js | Admin | Create signal |
| PUT | `/api/signals/:id` | signals.js | Admin | Update signal |
| DELETE | `/api/signals/:id` | signals.js | Admin | Delete signal |
| POST | `/api/signals/ai` | signals.js | AI-Key | Create signal via AI |
| GET | `/api/signals/mt5` | signals.js | MT5-Key | Get all active signals (array) |
| POST | `/api/signals/mt5/bos-candidate` | signals.js | MT5-Key | Receive BOS/CHoCH from MT5 bridge |
| POST | `/api/signals/:id/approve` | signals.js | Admin | Approve pending MT5 signal + send LINE |
| PATCH | `/api/signals/ai/evaluate` | signals.js | AI-Key | Update signal status (win/loss) |
| GET | `/api/articles` | articles.js | Public | Get all articles |
| POST | `/api/articles` | articles.js | Admin | Create article |
| POST | `/api/articles/ai` | articles.js | AI-Key | Create article via AI |
| PUT | `/api/articles/:id` | articles.js | Admin | Update article |
| DELETE | `/api/articles/:id` | articles.js | Admin | Delete article |
| GET | `/api/brokers` | brokers.js | Public | Get all brokers |
| POST | `/api/brokers` | brokers.js | Admin | Create broker |
| PUT | `/api/brokers/:id` | brokers.js | Admin | Update broker |
| DELETE | `/api/brokers/:id` | brokers.js | Admin | Delete broker |
| GET | `/api/users` | users.js | Admin | List all users |
| PUT | `/api/users/:id/vip` | users.js | Admin | Update VIP level |
| PUT | `/api/users/:id/admin` | users.js | Admin | Toggle admin status |
| DELETE | `/api/users/:id` | users.js | Admin | Delete user |
| GET | `/api/stats` | stats.js | Admin | Dashboard stats |
| GET | `/api/stats/public` | stats.js | Public | Public homepage stats |
| GET | `/api/stats/gold` | stats.js | Public | Gold price |
| GET | `/api/settings/contact` | settings.js | Public | Get contact info |
| PUT | `/api/settings/contact` | settings.js | Admin | Update contact info |
| GET | `/api/settings/banner?side=` | settings.js | Public | Get banner (left/right/middle) |
| PUT | `/api/settings/banner?side=` | settings.js | Admin | Update banner |
| POST | `/api/upload` | upload.js | Admin | Upload image (WebP base64) |
| GET | `/api/market/prices` | market.js | Public | Live forex/gold prices |
| POST | `/api/line/webhook` | line.js | Public | LINE webhook receiver |
| GET | `/api/line/group-id` | line.js | Public | Get LINE group ID |
| GET | `/api/auto-signals/settings` | auto-signals.js | Public | Get auto signal config |
| PUT | `/api/auto-signals/settings` | auto-signals.js | Admin | Save auto signal config |
| POST | `/api/auto-signals/analyze` | auto-signals.js | Admin | Run SMC analysis |
| POST | `/api/auto-signals/confirm` | auto-signals.js | Admin | Confirm AI signals |
| POST | `/api/auto-signals/auto-run` | auto-signals.js | AI-Key | Auto-run from GitHub Actions |
| GET | `/api/ai-settings` | ai-settings.js | Admin | Get AI signal config |
| PUT | `/api/ai-settings` | ai-settings.js | Admin | Save AI signal config |
| POST | `/api/ai-settings/test` | ai-settings.js | Admin | Test AI prompt with OpenAI |
| GET | `/api/ai-article-settings` | ai-article-settings.js | Admin | Get AI article config |
| PUT | `/api/ai-article-settings` | ai-article-settings.js | Admin | Save AI article config |
| POST | `/api/ai-article-settings/test` | ai-article-settings.js | Admin | Test AI article prompt |
| POST | `/api/ai-article-settings/generate` | ai-article-settings.js | Admin | Generate article via AI now |
| GET | `/api/ea/config` | ea-dashboard.js | Admin | Get EA config |
| PUT | `/api/ea/config` | ea-dashboard.js | Admin | Save EA config |
| GET | `/api/ea/allowed-pairs` | ea-dashboard.js | MT5-Key | EA fetches allowed pairs |
| GET | `/api/ea/heartbeat` | ea-dashboard.js | MT5-Key | EA sends status log |
| GET | `/api/ea/logs` | ea-dashboard.js | Admin | View EA activity logs |
| DELETE | `/api/ea/logs` | ea-dashboard.js | Admin | Clear EA logs |
| GET | `/api/mt5-signal-settings` | mt5-signal-settings.js | Admin | Get MT5 signal routing config |
| PUT | `/api/mt5-signal-settings` | mt5-signal-settings.js | Admin | Save MT5 signal routing config |
| POST | `/api/mt5-signal-settings/test` | mt5-signal-settings.js | Admin | Test LINE push targets |
| GET | `/api/mt5-signal-settings/logs` | mt5-signal-settings.js | Admin | View LINE send logs |

### 4.3 Auth Middleware (server/routes/auth.js)

```js
// 3 levels:
function authMiddleware(req, res, next)   // ต้องมี JWT valid
function adminMiddleware(req, res, next)   // ต้องเป็น admin (isAdmin === true)
// Public routes: ไม่ต้องมี middleware
```

- Super Admin: ตรวจสอบจาก env vars `ADMIN_EMAIL` และ `ADMIN_PASSWORD`
- Admin ปกติ: ตรวจสอบจาก database (`users.is_admin = true`)
- Rate limiter: 10 ครั้ง/15 นาที สำหรับ login endpoint

### 4.4 API Key Auth

ใช้ Header สำหรับ machine-to-machine authentication:

| Header | env var | ใช้กับ |
|--------|---------|--------|
| `X-AI-Key` | `AI_SIGNAL_API_KEY` | AI scripts (signal, article, evaluate, auto-run) |
| `X-MT5-Key` | `MT5_API_KEY` | MT5 EA (`/api/signals/mt5`) |

### 4.5 การเพิ่ม Route ใหม่

1. สร้างไฟล์ `server/routes/ชื่อ.js`
2. ในไฟล์:
   ```js
   const router = require('express').Router();
   const { pool } = require('../db');
   const { authMiddleware, adminMiddleware } = require('./auth');

   router.get('/', async (req, res) => { ... });
   router.post('/', adminMiddleware, async (req, res) => { ... });

   module.exports = router;
   ```
3. ลงทะเบียนใน `server/server.js` และ `api/index.js`:
   ```js
   app.use('/api/ชื่อ', require('./routes/ชื่อ'));
   ```

## 5. Vercel Deployment

### 5.1 vercel.json

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**เงื่อนไขสำคัญ:**
- ไม่ใช้ `"builds"` — Vercel auto-detect `api/index.js` เป็น serverless function
- ไม่ใช้ `"framework"` — Vercel จะตรวจจับ Express แล้วเปลี่ยนพฤติกรรม
- ใช้ `"rewrites"` (ไม่ใช่ `"routes"`) เพื่อไม่ให้ทับ static file serving
- ไฟล์ static ทั้งหมดถูก serve โดย Vercel CDN โดยตรง (ไม่ผ่าน Express)
- SPA fallback: `"/(.*)" → "/index.html"` (Vercel serve `index.html`)

### 5.2 API Serverless (api/index.js)

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('../server/db');

const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', require('../server/routes/auth'));
app.use('/api/signals', require('../server/routes/signals'));
// ... routes ทั้งหมด

let initialized = false;
module.exports = async (req, res) => {
  if (!initialized) { await initDB(); initialized = true; }
  app(req, res);
};
```

**หมายเหตุ:** `api/index.js` และ `server/server.js` ใช้ Express app ร่วมกันจาก `server/app.js` —
เพิ่ม route ใหม่只需要ลงทะเบียนใน `server/app.js` เท่านั้น

## 6. Database (PostgreSQL)

### 6.1 Tables

```sql
users (id SERIAL PK, username VARCHAR(50) UNIQUE, email VARCHAR(100) UNIQUE,
       password VARCHAR(255), created_at TIMESTAMP, vip_level VARCHAR(20) DEFAULT 'Free',
       is_admin BOOLEAN DEFAULT false)

signals (id SERIAL PK, pair VARCHAR(20), direction VARCHAR(10), entry VARCHAR(20),
         tp1 VARCHAR(20), tp2 VARCHAR(20), tp3 VARCHAR(20), sl VARCHAR(20),
         status VARCHAR(20) DEFAULT 'active', reason TEXT DEFAULT '',
         created_at TIMESTAMP DEFAULT NOW())

articles (id SERIAL PK, title VARCHAR(255), content TEXT, image TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT NOW())

brokers (id SERIAL PK, name VARCHAR(100), description TEXT DEFAULT '',
         ib_link VARCHAR(500) DEFAULT '', logo TEXT DEFAULT '',
         rating DECIMAL(2,1) DEFAULT 0)

site_settings (key VARCHAR(50) PK, value TEXT NOT NULL)
line_logs (id SERIAL PK, signal_id VARCHAR(50), target_id VARCHAR(100), target_name VARCHAR(100), plan VARCHAR(20), status VARCHAR(20), response TEXT, sent_at TIMESTAMP DEFAULT NOW())
```

### 6.2 site_settings keys

| Key | Value Format | Description |
|-----|-------------|-------------|
| `contact` | JSON `{line_id, phone, email, qr_code, facebook, website, tiktok, youtube, openchat, openchat_qr, tiktok_qr}` | ช่องทางติดต่อ |
| `banner_left` / `banner_right` | JSON `{enabled, html}` | Side banner (120×600) |
| `banner_middle` | JSON `{enabled, html}` | Middle banner (300×250) |
| `auto_signal_settings` | JSON `{apiKey, model, prompt, pairs, interval, ...}` | Auto Signal config |
| `mt5_signal_settings` | JSON `{requireApproval, aiAnalysis, targets[]}` | MT5 bridge → LINE routing |

### 6.3 การ migrate

ใช้ `server/db.js` → `initDB()`:
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- ข้อมูลเริ่มต้น (seed data) เฉพาะเมื่อตารางว่าง

## 7. MT5 EA Integration

### 7.1 EA File

`mt5/SignalReceiverATH.mq5` → Expert Advisor สำหรับ MT5

**Input Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `API_URL` | `https://forex-rouge-gamma.vercel.app/api/signals/mt5` | API endpoint |
| `API_KEY` | (mt5 api key) | MT5_API_KEY env var |
| `LOT_SIZE` | `0.01` | Lot size |
| `POLL_INTERVAL` | `60` | Seconds between checks |
| `MAGIC_NUMBER` | `20260605` | EA identifier |

### 7.2 API Endpoint สำหรับ MT5

`GET /api/signals/mt5` → return **ทุก Signal active** เป็น JSON array
- Auth: `X-MT5-Key` header
- Response: `[{ id, pair, direction, entry, tp1, tp2, tp3, sl, reason, created_at }, ...]`
- รองรับ Multi-Symbol — EA ค้นหา Symbol name อัตโนมัติ (`.m`, `.pro`, `.ecn`, `GOLD`, ฯลฯ)

### 7.3 การติดตั้งบน MT5

1. คัดลอก `SignalReceiverATH.mq5` ไปที่ `MQL5/Experts/`
2. เปิด **MetaEditor (F4)** → คอมไพล์ (F7)
3. ลาก EA ไปวางบน Chart ใดก็ได้ (รองรับ multi-symbol)
4. ตั้งค่า Tools → Options → Expert Advisors → **Allow WebRequest** สำหรับ URL

### 7.4 EA Features

- **Multi-Pair Support** — เปิด Pending ทุกคู่พร้อมกัน, ไม่เช็ค chart symbol
- **Per-Symbol Replacement** — ยกเลิก Pending เฉพาะคู่ที่มี signal ใหม่
- **Signal Persistence** — Signal หายจาก API → Pending Order ค้างไว้
- **Symbol Resolution** — ค้นหา Symbol name อัตโนมัติ (รองรับ suffix: `.m`, `.pro`, `.r`, `.ecn`, `GOLD`, ฯลฯ)
- **Price Check** — ตรวจสอบ Bid/Ask ก่อนวาง Pending
- **Processed Signal Tracking** — เก็บ Signal ID ที่ประมวลผลแล้วสูงสุด 50 รายการ

## 8. การเพิ่มหน้าใหม่

### 8.1 หน้า Public

1. **index.html**: เพิ่ม `<section class="page" id="page-ชื่อ">...</section>`
2. **js/router.js**: เพิ่ม `case 'ชื่อ'` ใน `handleRoute()` และ `showPage()`
3. **js/app.js**: เขียน `App.renderชื่อ()` ถ้าต้องการเรียก API
4. **js/api.js**: เพิ่ม API method ถ้าต้องการ

### 8.2 หน้า Admin

1. **index.html**: เพิ่ม `<div id="admin-ชื่อ" class="admin-page-content">...</div>` + `<a href="#/admin/ชื่อ">` ใน sidebar
2. **js/router.js**: เพิ่ม `case 'ชื่อ'` และ `data-page="ชื่อ"`
3. **js/admin.js**: เขียน `Admin.renderชื่อ()` หรือ setup function
4. **js/api.js**: เพิ่ม API method ถ้าต้องการ

## 9. การเพิ่ม API Route ใหม่

1. สร้างไฟล์ `server/routes/ชื่อ.js`
2. ในไฟล์:
   ```js
   const router = require('express').Router();
   const { pool } = require('../db');
   const { authMiddleware, adminMiddleware } = require('./auth');

   router.get('/', async (req, res) => { ... });
   router.post('/', adminMiddleware, async (req, res) => { ... });

   module.exports = router;
   ```
3. ลงทะเบียนใน `server/server.js` และ `api/index.js`:
   ```js
   app.use('/api/ชื่อ', require('./routes/ชื่อ'));
   ```
4. เพิ่ม API method ใน `js/api.js`

## 10. Environment Variables

### Local (.env)

```env
PORT=8080
DATABASE_URL=postgresql://user@localhost/dbname
JWT_SECRET=your-secret
ADMIN_EMAIL=admin@athtrader.com
ADMIN_PASSWORD=admin123
AI_SIGNAL_API_KEY=b544afcadfba96c8b08b8afac68d6838f5722ee885cfae53
MT5_API_KEY=d0d52fa0d8070ec18b99375dd25baa5b46338653dd5ea7c8
OPENAI_API_KEY=sk-proj-...
AI_API_URL=http://localhost:8080
```

| Key | จำเป็น | หมายเหตุ |
|-----|--------|----------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | สำหรับ sign JWT |
| `ADMIN_EMAIL` | ✅ | email สำหรับ Super Admin login |
| `ADMIN_PASSWORD` | ✅ | password สำหรับ Super Admin |
| `AI_SIGNAL_API_KEY` | ✅ | สำหรับ AI signal endpoint |
| `MT5_API_KEY` | ✅ | สำหรับ MT5 EA auth |
| `OPENAI_API_KEY` | ✅ | สำหรับ AI signal/article generation |
| `AI_API_URL` | ✅ | Base URL ของ API (local หรือ production) |
| `PG_SSL_REJECT_UNAUTHORIZED` | ❌ | `false` สำหรับ Neon |

### Vercel (Dashboard → Settings → Environment Variables)

ป้อน 8 ตัวข้างบน (ไม่รวม PORT)

## 11. Git & การ Deploy

### 11.1 Git Commands

```bash
git add -A
git commit -m "ข้อความอธิบาย"
git push origin main
```

### 11.2 Local Dev

```bash
npm run dev    # รันที่ http://localhost:8080
```

### 11.3 Vercel Deploy

Git push → Vercel auto-deploy (เชื่อมกับ GitHub)
URL: `https://forex-rouge-gamma.vercel.app`

---

**หมายเหตุ:** ไฟล์นี้เป็นเอกสารอ้างอิงสำหรับการปรับปรุงและอัปเดตระบบ ATH Trader
อัปเดตล่าสุด: 7 มิถุนายน 2569
