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

## Architecture

| Term | Definition |
|------|------------|
| **Image Storage** | รูปภาพทั้งหมดถูกเก็บเป็น Base64 Data URL (ข้อความยาวใน Database) เพื่อรองรับการ Deploy บน Vercel serverless |
| **Auth Model** | Super Admin ยืนยันตัวตนผ่าน env vars; Admin ปกติยืนยันผ่าน Database (`users` table) โดยตรวจสอบคอลัมน์ `is_admin`; ผู้ใช้ทั่วไปยืนยันผ่าน Database เช่นกัน |
