# เอกสารโครงสร้างระบบส่ง Signal MT5 → Backend → LINE

เอกสารนี้อธิบายโครงสร้าง การทำงาน และวิธีนำระบบส่ง Signal จาก MT5 ไปยัง LINE ไปใช้งานกับโปรเจกต์อื่น ๆ อย่างละเอียด

---

## 1. ภาพรวมระบบ

ระบบนี้ทำหน้าที่รับสัญญาณเทรด (Trading Signal) จาก **MetaTrader 5 (MT5)** ผ่าน EA (Expert Advisor) แล้วส่งต่อไปยัง **Backend** เพื่อประมวลผล บันทึกข้อมูล และส่งแจ้งเตือนไปยัง **LINE** ตามเงื่อนไขที่กำหนด

```
┌─────────┐     HTTP POST      ┌──────────────┐     AI/Logic      ┌─────────────┐
│  MT5    │ ─────────────────> │   Backend    │ ────────────────> │  Database   │
│   EA    │  BOS/CHoCH data    │  (Express)   │                   │ (PostgreSQL)│
└─────────┘                    └──────┬───────┘                   └─────────────┘
                                      │
                                      │ Push message
                                      ▼
                               ┌─────────────┐
                               │  LINE API   │
                               │ (Messaging) │
                               └─────────────┘
```

---

## 2. ส่วนประกอบหลัก

### 2.1 MT5 Bridge (Expert Advisor)

ไฟล์: `mt5/BOS_LuxAlgo_Bridge.mq5`

หน้าที่:
- อ่าน object BOS/CHoCH จาก indicator LuxAlgo SMC บน chart
- คำนวณ Order Block (OB), Entry, SL, TP
- ส่งข้อมูลไปยัง Backend ผ่าน `WebRequest`
- ส่ง Heartbeat เพื่อยืนยันว่า EA ทำงาน

ข้อมูลที่ส่ง:
```json
{
  "pair": "XAU/USD",
  "bosType": "bearish",
  "signalLabel": "BOS",
  "timeframe": "M15",
  "bosPrice": "4055.03",
  "obHigh": "4062.7",
  "obLow": "4024.37",
  "prevSwing": "4055.03",
  "currentPrice": "4027.93"
}
```

Input Parameters:
| Parameter | ค่าเริ่มต้น | คำอธิบาย |
|-----------|------------|----------|
| `API_URL` | `https://forex-rouge-gamma.vercel.app` | URL ของ Backend |
| `API_KEY` | "" | MT5_API_KEY จาก Environment |
| `PAIR_NAME` | "" | ปล่อยว่าง = auto-detect |
| `SEND_BOS` | true | ส่งเมื่อพบ BOS |
| `SEND_CHOCH` | true | ส่งเมื่อพบ CHoCH |
| `DEBOUNCE_BARS` | 3 | ระยะห่างขั้นต่ำระหว่าง signal |
| `HEARTBEAT_MIN` | 15 | ส่ง heartbeat ทุก N นาที |
| `DEBUG_MODE` | true | แสดง log รายละเอียด |

---

### 2.2 Backend (Express.js)

ไฟล์หลัก:
- `server/app.js` — จุดเริ่มต้นของ Express app
- `server/routes/signals.js` — จัดการ signal ทั้งหมด
- `server/routes/mt5-signal-settings.js` — ตั้งค่าการส่ง LINE
- `server/routes/line.js` — LINE webhook และ quota
- `server/db.js` — การเชื่อมต่อ PostgreSQL
- `scripts/line.js` — ฟังก์ชันส่ง LINE

---

### 2.3 Database (PostgreSQL)

ตารางหลัก:

#### `signals`
เก็บสัญญาณเทรดทั้งหมด
```sql
CREATE TABLE signals (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  entry VARCHAR(20),
  tp1 VARCHAR(20),
  tp2 VARCHAR(20),
  tp3 VARCHAR(20),
  sl VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  reason TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `line_logs`
เก็บประวัติการส่ง LINE
```sql
CREATE TABLE line_logs (
  id SERIAL PRIMARY KEY,
  signal_id VARCHAR(50),
  target_id VARCHAR(100) NOT NULL,
  target_name VARCHAR(100) DEFAULT '',
  plan VARCHAR(20) DEFAULT 'full',
  status VARCHAR(20) NOT NULL,
  response TEXT DEFAULT '',
  sent_at TIMESTAMP DEFAULT NOW()
);
```

#### `site_settings`
เก็บการตั้งค่าต่าง ๆ ในรูป JSON
```sql
CREATE TABLE site_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL
);
```

คีย์ที่ใช้:
- `mt5_signal_settings` — การตั้งค่า MT5 → LINE
- `line_group_id` — Group ID ที่บันทึกจาก webhook

---

## 3. Data Flow แบบละเอียด

### 3.1 การรับ Signal จาก MT5

1. EA ตรวจพบ BOS/CHoCH ใหม่บน chart
2. EA คำนวณค่า Entry, SL, TP1-3
3. EA ส่ง POST ไปที่ `/api/signals/mt5/bos-candidate`
4. Backend ตรวจสอบ `X-MT5-Key`
5. Backend โหลดการตั้งค่าจาก `mt5_signal_settings`
6. ถ้าเปิด AI analysis → เรียก OpenAI ประเมิน Confidence และ R:R
7. ถ้า Confidence ต่ำกว่าเกณฑ์ → reject
8. บันทึก signal ลง `signals`
9. ถ้าไม่ต้อง Admin approve → ส่ง LINE
10. ตอบกลับ EA ด้วย `{ hasSetup: true, signalId, ... }`

### 3.2 การส่ง LINE

1. Backend โหลดเป้าหมายจาก `mt5_signal_settings.targets`
2. กรองเฉพาะเป้าหมายที่ `enabled = true`
3. จัดกลุ่มเป้าหมายตาม `plan` (full/basic)
4. เรียก OpenAI เขียนข้อความแยกตาม plan
5. ส่ง push message ไปยังแต่ละเป้าหมาย
6. บันทึกผลลัพธ์ลง `line_logs`

### 3.3 การตรวจ Win/Loss

1. GitHub Actions รันทุก 30 นาที (`evaluate-signals.yml`)
2. เรียก `scripts/evaluate-signals.js`
3. ดึง active signals ทั้งหมด
4. ดึงราคาปัจจุบันจาก external API
5. เปรียบเทียบราคากับ TP1 และ SL
6. อัปเดต status เป็น `win` หรือ `loss`
7. ส่งข้อความแจ้งเตือน LINE

---

## 4. API Endpoints

### Signal Endpoints

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/signals` | Public | ดึงสัญญาณทั้งหมด |
| POST | `/api/signals` | Admin JWT | สร้างสัญญาณด้วยมือ |
| POST | `/api/signals/ai` | X-AI-Key | สร้างสัญญาณจาก AI |
| GET | `/api/signals/mt5` | X-MT5-Key | ดึง active signals ให้ EA |
| POST | `/api/signals/mt5/bos-candidate` | X-MT5-Key | รับ BOS/CHoCH จาก MT5 |
| POST | `/api/signals/:id/approve` | Admin JWT | อนุมัติ pending signal |
| PATCH | `/api/signals/ai/evaluate` | X-AI-Key | อัปเดต status win/loss |

### Settings Endpoints

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/mt5-signal-settings` | Admin JWT | ดึงการตั้งค่า |
| PUT | `/api/mt5-signal-settings` | Admin JWT | บันทึกการตั้งค่า |
| POST | `/api/mt5-signal-settings/test` | Admin JWT | ทดสอบส่ง LINE |
| GET | `/api/mt5-signal-settings/usage` | Admin JWT | สถิติการใช้งาน |
| GET | `/api/mt5-signal-settings/logs` | Admin JWT | ประวัติการส่ง LINE |

### LINE Endpoints

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| POST | `/api/line/webhook` | Public | รับ event จาก LINE |
| GET | `/api/line/group-id` | Public | ดึง Group ID ล่าสุด |
| GET | `/api/line/quota` | Admin JWT | ดึงโควต้า LINE |

---

## 5. โครงสร้างการตั้งค่า (mt5_signal_settings)

```json
{
  "requireApproval": false,
  "aiAnalysis": true,
  "minConfidence": 60,
  "targets": [
    {
      "name": "กลุ่มหลัก",
      "type": "group",
      "plan": "full",
      "id": "C252380b9b0491d2a43578b1a405401ed",
      "enabled": true
    },
    {
      "name": "ผู้ใช้ VIP",
      "type": "user",
      "plan": "basic",
      "id": "U52530716c5af4c76d44d1abcef802cb7",
      "enabled": true
    }
  ]
}
```

ฟิลด์:
- `requireApproval` — ต้องให้ Admin อนุมัติก่อนส่ง LINE
- `aiAnalysis` — เปิด/ปิด AI วิเคราะห์
- `minConfidence` — เกณฑ์ Confidence ขั้นต่ำ (0-100)
- `targets` — รายการเป้าหมาย LINE
  - `name` — ชื่อที่แสดงใน Admin
  - `type` — `group` หรือ `user`
  - `plan` — `full` (TP1-3) หรือ `basic` (TP1)
  - `id` — LINE Group ID หรือ User ID
  - `enabled` — เปิด/ปิดการใช้งาน

---

## 6. Environment Variables

| ตัวแปร | จำเป็น | คำอธิบาย |
|--------|--------|----------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret สำหรับ JWT |
| `ADMIN_EMAIL` | ✅ | Super Admin email |
| `ADMIN_PASSWORD` | ✅ | Super Admin password |
| `MT5_API_KEY` | ✅ | API key สำหรับ MT5 bridge |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `AI_SIGNAL_API_KEY` | ✅ | API key สำหรับ AI scripts |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | LINE OA access token |
| `LINE_CHANNEL_SECRET` | ❌ | LINE OA channel secret |
| `LINE_GROUP_ID` | ❌ | กลุ่ม LINE เริ่มต้น |
| `LINE_USER_ID` | ❌ | ผู้ใช้ LINE เริ่มต้น |
| `AI_API_URL` | ✅ | Base URL ของ backend |

---

## 7. การตั้งค่า LINE Official Account

### 7.1 สร้าง OA
1. เข้า [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider และ Messaging API channel
3. คัดลอก `Channel Secret` จากแท็บ Basic settings
4. ไปที่แท็บ Messaging API → Issue `Channel Access Token`

### 7.2 เปิดสิทธิ์เข้ากลุ่ม
ใน Messaging API ตั้งค่า:
- **Allow bot to join group chats** → Enabled

### 7.3 ตั้งค่า Webhook
- **Webhook URL**: `{YOUR_API_URL}/api/line/webhook`
- **Use webhook**: Enabled

### 7.4 เอา Group ID
1. เชิญ OA เข้ากลุ่ม
2. ให้มีคนส่งข้อความในกลุ่ม 1 ครั้ง
3. เปิด `{YOUR_API_URL}/api/line/group-id`
4. เอา Group ID ไปใส่ใน MT5 Signal Settings

---

## 8. การติดตั้ง MT5 EA

1. คัดลอก `BOS_LuxAlgo_Bridge.mq5` ไปที่ `MQL5/Experts/`
2. เปิด MetaEditor และ Compile (F7)
3. ลาก EA ลง Chart
4. ตั้งค่า Input:
   - `API_URL` = URL ของ backend
   - `API_KEY` = `MT5_API_KEY`
5. เปิดสิทธิ์ WebRequest ใน MT5:
   - Tools → Options → Expert Advisors → Allow WebRequest
   - เพิ่ม URL ของ backend

---

## 9. GitHub Actions Workflows

### `evaluate-signals.yml`
รันทุก 30 นาทีเพื่อตรวจสอบ active signals และอัปเดต win/loss

```yaml
name: Evaluate Active Signals
on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: node scripts/evaluate-signals.js
        env:
          AI_SIGNAL_API_KEY: ${{ secrets.AI_SIGNAL_API_KEY }}
          AI_API_URL: ${{ secrets.AI_API_URL }}
          LINE_CHANNEL_ACCESS_TOKEN: ${{ secrets.LINE_CHANNEL_ACCESS_TOKEN }}
          LINE_GROUP_ID: ${{ secrets.LINE_GROUP_ID }}
          LINE_USER_ID: ${{ secrets.LINE_USER_ID }}
```

---

## 10. การนำไปใช้กับโปรเจกต์อื่น

### 10.1 สิ่งที่ต้องมี
- Node.js backend (Express)
- PostgreSQL database
- LINE Messaging API channel
- MT5 (ถ้าต้องการรับ signal จาก MT5)
- OpenAI API key (ถ้าต้องการ AI analysis)

### 10.2 ขั้นตอน Migration

1. คัดลอกไฟล์เหล่านี้ไปยังโปรเจกต์ใหม่:
   - `server/routes/signals.js`
   - `server/routes/mt5-signal-settings.js`
   - `server/routes/line.js`
   - `scripts/line.js`
   - `scripts/evaluate-signals.js`
   - `mt5/BOS_LuxAlgo_Bridge.mq5`

2. ปรับ `server/app.js` ให้ register routes ใหม่

3. สร้างตารางในฐานข้อมูลตาม Schema ข้างต้น

4. ตั้งค่า Environment Variables

5. ตั้งค่า LINE OA และ Webhook

6. ติดตั้ง EA ใน MT5 และตั้งค่า API_URL/API_KEY

7. สร้าง GitHub Actions workflow สำหรับ evaluate signals (ถ้าต้องการ)

### 10.3 จุดที่ควรปรับแต่ง

- ชื่อโปรเจกต์/แบรนด์ในข้อความ LINE
- รูปแบบ prompt สำหรับ AI
- ตัวเลือก pair ใน MT5 EA
- เกณฑ์ Confidence เริ่มต้น
- จำนวน target ใน MT5 Signal Settings

---

## 11. การทำงานของ AI

### 11.1 AI Analysis (ก่อนบันทึก Signal)
ส่งข้อมูล Entry/SL/TP ให้ OpenAI ประเมิน:
- Confidence (0-100%)
- Risk:Reward ที่ดีที่สุด
- สรุปจุดเด่น/จุดเสี่ยง

### 11.2 AI Message Generation (ก่อนส่ง LINE)
สร้างข้อความแจ้งเตือนภาษาไทย พร้อม emoji ตาม plan:
- **Full Plan**: แสดง Entry, SL, TP1, TP2, TP3
- **Basic Plan**: แสดง Entry, SL, TP1 เท่านั้น

---

## 12. Troubleshooting

### MT5 ไม่ส่งข้อมูลมา Backend
- ตรวจ `API_URL` และ `API_KEY`
- ตรวจสอบว่าเปิด Allow WebRequest ใน MT5
- ดู log ใน MT5 Experts/Journal

### LINE ส่งไม่ได้
- ตรวจ `LINE_CHANNEL_ACCESS_TOKEN`
- ตรวจโควต้า LINE คงเหลือ
- ตรวจว่าเป้าหมาย ID ถูกต้อง
- ตรวจว่าบอทอยู่ในกลุ่ม (กรณีส่งกลุ่ม)

### AI ไม่ทำงาน
- ตรวจ `OPENAI_API_KEY`
- ตรวจว่าเปิด `aiAnalysis` ใน settings
- ดู log error ใน Vercel/Server

### Win/Loss ไม่อัปเดต
- ตรวจสอบว่า GitHub Actions workflow `evaluate-signals.yml` รันหรือไม่
- ตรวจสอบ `AI_SIGNAL_API_KEY` และ `AI_API_URL`

---

## 13. ความปลอดภัย

- เก็บ API keys และ tokens ใน Environment Variables เท่านั้น
- ไม่ commit secrets ลง repository
- ใช้ `X-MT5-Key` และ `X-AI-Key` สำหรับ machine-to-machine auth
- ใช้ JWT + Admin middleware สำหรับ Admin endpoints
- ตรวจสอบ signature ของ LINE webhook (แนะนำ) ด้วย `LINE_CHANNEL_SECRET`

---

## 14. ข้อจำกัดและข้อควรระวัง

- แพลนฟรี LINE Messaging API มีโควต้า 300 ข้อความ/เดือน
- การส่งข้อความบ่อยเกินไปอาจหมดโควต้าเร็ว
- AI analysis ใช้ OpenAI token เพิ่มเติม
- ราคาจาก external API อาจมี delay หรือไม่เสถียร
- ควรมี Admin อนุมัติก่อนส่งในช่วงทดสอบ

---

## 15. สรุป

ระบบนี้เป็นโซลูชันแบบ modular ที่สามารถแยกส่วนและนำไปใช้กับโปรเจกต์อื่นได้ โดยมีจุดเด่นคือ:

- รับ signal จาก MT5 โดยตรง
- AI ช่วยกรองและสร้างข้อความ
- รองรับหลายเป้าหมายและหลายระดับข้อมูล
- บันทึก log ครบถ้วน
- ตรวจสอบ Win/Loss อัตโนมัติ
- Dashboard แสดงสถิติและโควต้า

หากต้องการนำไปใช้กับเว็บอื่น ให้ปรับชื่อแบรนด์ และตั้งค่า Environment ให้ครบตามเอกสารนี้
