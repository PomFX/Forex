# ATH Trader — Glossary

## Domain

| Term | Definition |
|------|------------|
| **User** | สมาชิกของระบบ มี `vip_level` เป็นตัวแบ่งระดับ (Free / Silver / Gold / Platinum) |
| **VIP Level** | ระดับสมาชิกที่กำหนดสิทธิ์การเข้าถึง — ไม่มีฟีเจอร์พิเศษอื่นนอกเหนือจากที่แสดงบนหน้าแพ็กเกจ |
| **Signal** | สัญญาณเทรด Forex ประกอบด้วย คู่เงิน (pair) ทิศทาง (BUY/SELL) ราคาเข้า TP1-3 SL และสถานะ (active/win/loss) |
| **Article** | บทความให้ความรู้ / ข่าวสาร มีหัวข้อ เนื้อหา และรูปประกอบ (ไม่บังคับ) |
| **Broker** | โบรกเกอร์แนะนำ มีชื่อ คะแนน คำอธิบาย ลิงก์ IB และโลโก้ |
| **Contact Channel** | ช่องทางติดต่อ (Line, Phone, Email, Facebook, TikTok, YouTube, OpenChat) พร้อม QR Code |
| **Admin** | ผู้ดูแลระบบ — มี 2 ประเภท: (1) Super Admin ผ่าน env vars (`ADMIN_EMAIL` + `ADMIN_PASSWORD`), (2) Admin ปกติที่มี `is_admin = true` ใน `users` table |

## Side Banner

| Detail | Value |
|--------|-------|
| **Position** | `position: fixed` ชิดขอบจอ (`left: 0` / `right: 0`) กึ่งกลางแนวตั้ง |
| **Image Source** | อัปโหลดที่ ImgBB → ใช้ Direct Link (`https://i.ibb.co/...`) |
| **Middle Banner** | 300×250px Medium Rectangle วางระหว่างสัญญาณเทรดล่าสุดกับบทความล่าสุด, Admin จัดการแท็บ "กลาง" |
| **Why not pipaffiliates direct?** | `ads.pipaffiliates.com` คืน HTML page ไม่ใช่ raw image |
| **Why not Base64?** | Banner รับ HTML code อิสระ (ไม่ใช่แค่รูป) — ต้องใช้ external image hosting |
| **Admin** | แท็บซ้าย/ขวา พร้อม toggle เปิด/ปิด, รับ raw HTML |
| **Banner HTML** | `<a href="...affiliate..."><img src="...imgbb..." width="120" height="600"></a>` |

## AI Article — Gold Analysis Prompt

| Detail | Value |
|--------|-------|
| **Model** | `gpt-4o-mini` (OpenAI) |
| **Role** | "นักวิเคราะห์ราคาทองคำมืออาชีพ" — H1 analysis for Day Trading |
| **Sections** | (1) Current Market Snapshot, (2) H1 Technical Analysis (Support/Resistance, RSI, MACD, EMA, Candlestick Patterns), (3) Intraday Drivers & Catalyst (DXY, Bond Yield, Economic Data), (4) Hourly Trading Strategy (Buy/Sell, SL, TP, Risk-Reward) |
| **Output Format** | JSON `{ title, content }` — ภาษาไทย กระชับตรงประเด็น |
| **Image** | QuickChart.io line chart (10-hour simulated trend, dark theme, $XAU/USD) |

## Schedule (GitHub Actions)

| Detail | Value |
|--------|-------|
| **Workflow** | `ai-signals.yml` — 2 jobs (generate → evaluate) ทุก 30 นาที |
| **Article Workflow** | `ai-article.yml` — 1 job (article) ทุก 6 ชั่วโมง |
| **Cron** | `*/30 * * * *` (signals) + `0 */6 * * *` (article) |
| **Model** | `gpt-4o-mini` (OpenAI) |
| **Manual** | `workflow_dispatch` — กดรันเองได้ที่ GitHub Actions |

## Signal Analysis — BOS + Order Block

| Detail | Value |
|--------|-------|
| **Timeframe** | M15 |
| **Method** | BOS (Break of Structure) + Order Block — ไม่ใช้ FVG/Liquidity |
| **BUY Setup** | Bullish BOS (ปิดเหนือ HH) → **BUY LIMIT** ที่ Low ของแท่ง Bearish สุดท้ายก่อน Breakout (Order Block) |
| **SELL Setup** | Bearish BOS (ปิดใต้ LL) → **SELL LIMIT** ที่ High ของแท่ง Bullish สุดท้ายก่อน Breakout (Order Block) |
| **SL** | ใต้ OB Low (Buy) / เหนือ OB High (Sell) หรือ Swing Low/High ล่าสุด |
| **TP** | TP1=R:R 1:2, TP2=R:R 1:3, TP3=R:R 1:5 — ใช้ Swing High/Low ถัดไป |
| **Max/Day** | ไม่เกิน 4 สัญญาณ/วัน |
| **Reason** | 3 บรรทัดภาษาไทย: (1) BOS + โครงสร้าง (2) Order Block (3) Entry rationale + R:R |

## AI Article — Gold Analysis Prompt

| Detail | Value |
|--------|-------|
| **Model** | `gpt-4o-mini` (OpenAI) |
| **Role** | "นักวิเคราะห์ราคาทองคำมืออาชีพ" — H1 analysis for Day Trading |
| **Sections** | (1) Current Market Snapshot, (2) H1 Technical Analysis (Support/Resistance, RSI, MACD, EMA, Candlestick Patterns), (3) Intraday Drivers & Catalyst (DXY, Bond Yield, Economic Data), (4) Hourly Trading Strategy (Buy/Sell, SL, TP, Risk-Reward) |
| **Output Format** | JSON `{ title, content }` — ภาษาไทย กระชับตรงประเด็น |
| **Image** | QuickChart.io line chart (10-hour simulated trend, dark theme, $XAU/USD) |

## MT5 Integration

| Term | Definition |
|------|------------|
| **MT5 EA** | Expert Advisor (`SignalReceiverATH.mq5`) ที่ติดตั้งใน MetaTrader 5 — ดึง Signal ทั้งหมดจาก API แล้วเปิด Pending Order อัตโนมัติ ทุกคู่ |
| **MT5 Signal API** | API endpoint `/api/signals/mt5` คืน **ทุก Signal active** เป็น JSON array `[{...}, {...}]` |
| **Pending Order** | คำสั่งตั้งรอราคาใน MT5 — EA เลือก BUY LIMIT / BUY STOP / SELL LIMIT / SELL STOP อัตโนมัติ โดยเทียบ `entry` กับราคาตลาดปัจจุบัน |
| **Multi-Symbol** | EA 1 ตัวรันกราฟไหนก็ได้ — เปิด Pending ทุกคู่พร้อมกันโดยไม่เช็ค chart symbol |
| **Order Replacement** | เมื่อมี Signal ใหม่สำหรับคู่ใด EA จะยกเลิก Pending ของคู่นั้นเท่านั้น (ไม่แตะคู่อื่น) แล้วเปิด Pending ใหม่ |
| **Signal Persistence** | Signal หายจาก API → Pending Order ค้างไว้ จนกว่า Signal ใหม่ของคู่นั้นมาแทนที่ |
| **Symbol Resolution** | EA รองรับชื่อ Symbol หลายรูปแบบ: `XAUUSD`, `GOLD`, `XAUUSD.m`, `XAUUSD.pro`, `XAUUSD.r`, `XAUUSD.ecn`, `ETHUSDi`, `XRPUSDi` ฯลฯ — ค้นหาอัตโนมัติจากรายชื่อ Symbol ของ Broker |
| **Price Check** | ก่อนวาง Pending ตรวจสอบราคา Bid/Ask ก่อน — ถ้าไม่มี quotes จะข้ามไปรอบถัดไป |
| **Processed Signal Tracking** | เก็บ Signal ID ที่ประมวลผลแล้วสูงสุด 50 รายการ — ป้องกันการซ้ำในรอบถัดไป |
| **Auth** | API endpoint ใช้ `X-MT5-Key` header — key ถูกเก็บใน `MT5_API_KEY` env var |

## Architecture

| Term | Definition |
|------|------------|
| **Image Storage** | รูปภาพทั้งหมดถูกเก็บเป็น Base64 Data URL (ข้อความยาวใน Database) เพื่อรองรับการ Deploy บน Vercel serverless |
| **Auth Model** | Super Admin ยืนยันตัวตนผ่าน env vars; Admin ปกติยืนยันผ่าน Database (`users` table) โดยตรวจสอบคอลัมน์ `is_admin`; ผู้ใช้ทั่วไปยืนยันผ่าน Database เช่นกัน |

## AI Settings

| Detail | Value |
|--------|-------|
| **Model** | ตั้งค่าได้ (default: `gpt-4o-mini`) |
| **Prompt** | ใช้ `{pair}` placeholder, ปรับแต่งได้, ทดสอบผ่าน Admin UI |
| **Temperature** | 0-2, default 0.7 |
| **Max/Day** | จำกัดจำนวนสัญญาณต่อวัน (default: 4) |
| **Admin Page** | `/#/admin/aisettings` |
| **API** | `GET/PUT /api/ai-settings`, `POST /api/ai-settings/test` |

## AI Article Settings

| Detail | Value |
|--------|-------|
| **Model** | ตั้งค่าได้ (default: `gpt-4o-mini`) |
| **Prompt** | ใช้ `{price}` และ `{date}` placeholder |
| **Generate** | กดปุ่ม "สร้างบทความตอนนี้" ใน Admin UI หรือเรียก `POST /api/ai-article-settings/generate` |
| **Admin Page** | `/#/admin/aiarticlesettings` |
| **API** | `GET/PUT /api/ai-article-settings`, `POST /api/ai-article-settings/test`, `POST /api/ai-article-settings/generate` |

## EA Dashboard

| Detail | Value |
|--------|-------|
| **Master Toggle** | เปิด/ปิด EA จาก Server |
| **Lot Size** | ตั้งค่าขนาด Lot จาก Server |
| **TP Mode** | เลือก TP1/TP2/TP3 |
| **Allowed Pairs** | เลือกคู่เงินที่ให้ EA เข้า Order ได้ |
| **Heartbeat** | EA ส่งสถานะมาที่ `GET /api/ea/heartbeat` ทุก Poll |
| **Account Monitor** | EA ส่ง Broker/Login/Name/Balance/Profit มาให้ `POST /api/ea/heartbeat` ทุก 5 นาที → แสดงใน Dashboard |
| **Activity Log** | ดู Log การทำงานของ EA + ลบได้ |
| **Admin Page** | `/#/admin/eadashboard` |
| **API** | `GET/PUT /api/ea/config`, `GET /api/ea/allowed-pairs`, `GET /api/ea/heartbeat`, `GET/DELETE /api/ea/accounts`, `GET/DELETE /api/ea/logs` |

## Performance Dashboard

| Detail | Value |
|--------|-------|
| **Summary** | สัญญาณทั้งหมด / ชนะ / แพ้ / Win Rate / Active |
| **By Pair** |  Win Rate แยกตามคู่เงิน |
| **By Month** |  Win Rate แยกตามเดือน |
| **Admin Page** | `/#/admin/performance` |
| **API** | `GET /api/stats/performance` |

## Shared Express App

| Detail | Value |
|--------|-------|
| **File** | `server/app.js` — สร้าง Express app + middleware + routes ทั้งหมด |
| **server.js** | import app.js → เพิ่ม static + SPA fallback → initDB → listen |
| **api/index.js** | import app.js → initDB → export serverless handler |
| **ข้อดี** | เพิ่ม route ครั้งเดียว ไม่ต้องลงทะเบียนซ้ำ 2 ที่ |

## Status (2026-06-08)

| Item | Status |
|------|--------|
| **Vercel Deploy** | ✅ Live at `https://forex-rouge-gamma.vercel.app` |
| **AI Signals** | ✅ ทำงานได้จริง (generate → evaluate) ทุก 30 นาที |
| **AI Article** | ✅ แยก workflow (`ai-article.yml`) ทุก 6 ชั่วโมง |
| **Reason Field** | ✅ ครบทั้งระบบ (DB, API, Admin, Frontend) |
| **Side Banners** | ✅ HTML + Admin ซ้าย/ขวา |
| **LINE Messaging API** | ✅ Token + UserID + GroupID ใส่ใน Vercel env แล้ว |
| **LINE Webhook** | ✅ ตั้งที่ LINE Developers Console แล้ว, Group ID: `C6db4f5de05652d30ccbc307960c851cf` |
| **GitHub Secrets** | ✅ ตั้งแล้ว (OPENAI_API_KEY, AI_SIGNAL_API_KEY, AI_API_URL, LINE_CHANNEL_ACCESS_TOKEN, LINE_USER_ID, LINE_GROUP_ID) |
| **Database** | ✅ ใช้งานได้ (production DB, ได้จาก Vercel env) |
| **VIP Auto-Count** | ✅ เริ่ม 109 + เพิ่มวันละ 5-10 คน (deterministic cycle) |
| **Middle Banner** | ✅ 300×250px Medium Rectangle, Admin แท็บ "กลาง" |
| **AI Signals (BOS+OB)** | ✅ BOS + Order Block, LIMIT orders only, R:R 1:2/1:3/1:5 |
| **MT5 Multi-Symbol** | ✅ API คืนทุก signal active (array), EA เปิด Pending ทุกคู่พร้อมกัน |
| **MT5 Per-Symbol Replacement** | ✅ ยกเลิก Pending เฉพาะคู่ที่มี signal ใหม่, ไม่แตะคู่อื่น |
| **MT5 Price Guard** | ✅ ตรวจสอบ Bid/Ask ก่อนวาง Pending — ถ้าไม่มีราคาข้ามรอบ |
| **AI Settings** | ✅ Admin UI + API (GET/PUT/test) |
| **AI Article Settings** | ✅ Admin UI + API (GET/PUT/test/generate) |
| **EA Dashboard** | ✅ Admin UI + API (config, allowed-pairs, heartbeat, logs, accounts) |
| **EA Account Monitor** | ✅ EA ส่ง Broker/Login/Name/Balance/Profit → Server → แสดงใน Dashboard |
| **Performance** | ✅ Admin UI + API (`GET /api/stats/performance`) |
| **Shared Express App** | ✅ `server/app.js` — routes registered once |
