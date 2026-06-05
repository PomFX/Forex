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
| **Workflow** | `ai-signals.yml` — 3 jobs (generate → evaluate → article) |
| **Frequency** | วันละ 4 รอบ: 08:00 / 13:00 / 18:00 / 22:00 (เวลาไทย UTC+7) |
| **Cron** | `0 1,6,11,15 * * *` (UTC) |
| **Manual** | `workflow_dispatch` — กดรันเองได้ที่ GitHub Actions |

## Signal Analysis — SMC (Smart Money Concepts)

| Detail | Value |
|--------|-------|
| **Timeframe** | M15 |
| **Method** | SMC — Market Structure (HH/HL, LH/LL, CHoCH, BOS), Order Block, Fair Value Gap, Liquidity |
| **Condition** | สร้างสัญญาณเมื่อ SMC setup ครบเท่านั้น (BOS/CHoCH + OB/FVG + Liquidity sweep) |
| **Max/Day** | ไม่เกิน 4 สัญญาณ/วัน (1 ต่อรอบ) |
| **Reason** | 3 บรรทัดภาษาไทย: (1) Market Structure (2) OB/FVG (3) Liquidity + เหตุผลเข้า |

## AI Article — Gold Analysis Prompt

| Detail | Value |
|--------|-------|
| **Model** | `gpt-4o-mini` (OpenAI) |
| **Role** | "นักวิเคราะห์ราคาทองคำมืออาชีพ" — H1 analysis for Day Trading |
| **Sections** | (1) Current Market Snapshot, (2) H1 Technical Analysis (Support/Resistance, RSI, MACD, EMA, Candlestick Patterns), (3) Intraday Drivers & Catalyst (DXY, Bond Yield, Economic Data), (4) Hourly Trading Strategy (Buy/Sell, SL, TP, Risk-Reward) |
| **Output Format** | JSON `{ title, content }` — ภาษาไทย กระชับตรงประเด็น |
| **Image** | QuickChart.io line chart (10-hour simulated trend, dark theme, $XAU/USD) |

## Architecture

| Term | Definition |
|------|------------|
| **Image Storage** | รูปภาพทั้งหมดถูกเก็บเป็น Base64 Data URL (ข้อความยาวใน Database) เพื่อรองรับการ Deploy บน Vercel serverless |
| **Auth Model** | Super Admin ยืนยันตัวตนผ่าน env vars; Admin ปกติยืนยันผ่าน Database (`users` table) โดยตรวจสอบคอลัมน์ `is_admin`; ผู้ใช้ทั่วไปยืนยันผ่าน Database เช่นกัน |

## Status (2026-06-05)

| Item | Status |
|------|--------|
| **Vercel Deploy** | ✅ Live at `https://forex-rouge-gamma.vercel.app` |
| **AI Signals** | ✅ ทำงานได้จริง (generate → evaluate → article) |
| **Reason Field** | ✅ ครบทั้งระบบ (DB, API, Admin, Frontend) |
| **Side Banners** | ✅ HTML + Admin ซ้าย/ขวา |
| **LINE Messaging API** | ✅ Token + UserID + GroupID ใส่ใน Vercel env แล้ว |
| **LINE Webhook** | ✅ ตั้งที่ LINE Developers Console แล้ว, Group ID: `C6db4f5de05652d30ccbc307960c851cf` |
| **GitHub Secrets** | ✅ ตั้งแล้ว (OPENAI_API_KEY, AI_SIGNAL_API_KEY, AI_API_URL, LINE_CHANNEL_ACCESS_TOKEN, LINE_USER_ID, LINE_GROUP_ID) |
| **Database** | ✅ ใช้งานได้ (production DB, ได้จาก Vercel env) |
| **VIP Auto-Count** | ✅ เริ่ม 109 + เพิ่มวันละ 5-10 คน (deterministic cycle) |
| **Middle Banner** | ✅ 300×250px Medium Rectangle, Admin แท็บ "กลาง" |
| **AI Signals (SMC)** | ✅ M15 SMC: Market Structure, OB, FVG, Liquidity |
