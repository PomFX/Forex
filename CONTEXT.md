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

## Architecture

| Term | Definition |
|------|------------|
| **Image Storage** | รูปภาพทั้งหมดถูกเก็บเป็น Base64 Data URL (ข้อความยาวใน Database) เพื่อรองรับการ Deploy บน Vercel serverless |
| **Auth Model** | Super Admin ยืนยันตัวตนผ่าน env vars; Admin ปกติยืนยันผ่าน Database (`users` table) โดยตรวจสอบคอลัมน์ `is_admin`; ผู้ใช้ทั่วไปยืนยันผ่าน Database เช่นกัน |
