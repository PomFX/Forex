const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;
const isLocal = connStr && (connStr.includes('@localhost') || connStr.includes('host='));

const pool = new Pool({
  connectionString: connStr,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_level VARCHAR(20) DEFAULT 'Free'`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS signals (
        id SERIAL PRIMARY KEY,
        pair VARCHAR(20) NOT NULL,
        direction VARCHAR(10) NOT NULL,
        entry VARCHAR(20),
        tp1 VARCHAR(20),
        tp2 VARCHAR(20),
        tp3 VARCHAR(20),
        sl VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE articles ALTER COLUMN image TYPE TEXT USING image::TEXT`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS brokers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT DEFAULT '',
        ib_link VARCHAR(500) DEFAULT '',
        logo TEXT DEFAULT '',
        rating DECIMAL(2,1) DEFAULT 0
      );
      ALTER TABLE brokers ALTER COLUMN logo TYPE TEXT USING logo::TEXT;
    `);

    // Seed data if empty
    const brokerCount = await client.query('SELECT COUNT(*) FROM brokers');
    if (parseInt(brokerCount.rows[0].count) === 0) {
      await client.query(`INSERT INTO brokers (name, description, ib_link, rating) VALUES
        ('KVB Prime', 'โบรกเกอร์ Forex ชั้นนํา ได้รับการยอมรับระดับโลก ให้บริการเทรด Forex, CFD, สินค้าโภคภัณฑ์ พร้อมสเปรดตํ่าและ执行力รวดเร็ว', 'https://www.kvbplus.com/prime', 4.8),
        ('Exness', 'โบรกเกอร์ระดับโลกที่มีปริมาณการเทรดสูง ตลอด 24/7 เงื่อนไขการเทรดดีที่สุด', 'https://www.exness.com/ib', 4.7),
        ('XM', 'โบรกเกอร์ที่ได้รับความนิยมสูง โบนัสต้อนรับมากมาย บริการลูกค้า 24/5', 'https://www.xm.com/ib', 4.5)`);
    }

    const signalCount = await client.query('SELECT COUNT(*) FROM signals');
    if (parseInt(signalCount.rows[0].count) === 0) {
      await client.query(`INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status) VALUES
        ('EUR/USD', 'BUY', '1.08750', '1.09200', '1.09500', '1.09800', '1.08400', 'active'),
        ('GBP/USD', 'SELL', '1.26500', '1.26000', '1.25700', '1.25400', '1.26900', 'active'),
        ('XAU/USD', 'BUY', '2035.00', '2042.00', '2048.00', '2055.00', '2028.00', 'win'),
        ('USD/JPY', 'SELL', '150.200', '149.800', '149.500', '149.200', '150.600', 'loss')`);
    }

    const articleCount = await client.query('SELECT COUNT(*) FROM articles');
    if (parseInt(articleCount.rows[0].count) === 0) {
      await client.query(`INSERT INTO articles (title, content) VALUES
        ('เทคนิควิเคราะห์ Forex สำหรับมือใหม่', 'การเทรด Forex เป็นการลงทุนที่มีความเสี่ยงสูง ผู้เริ่มต้นควรศึกษาเทคนิคพื้นฐาน เช่น การวิเคราะห์แนวรับแนวต้าน, การใช้ RSI และ MACD, และการบริหารความเสี่ยงด้วย Risk Management ที่ดี.'),
        ('วิธีเลือกโบรกเกอร์ Forex ที่น่าเชื่อถือ', 'การเลือกโบรกเกอร์เป็นขั้นตอนสําคัญที่สุด ควรดูที่ใบอนุญาต, ความน่าเชื่อถือ, สเปรด, ค่าคอมมิชชั่น, และระบบฝาก-ถอน ที่สะดวกรวดเร็ว.'),
        ('วิเคราะห์ทองคํา XAU/USD ประจําสัปดาห์', 'ราคาทองคํายังคงได้รับแรงหนุนจากความไม่แน่นอนทางเศรษฐกิจโลก และนโยบายดอกเบี้ยของธนาคารกลางสหรัฐฯ นักวิเคราะห์คาดว่าราคาจะเคลื่อนไหวในกรอบ 2030-2060 ดอลลาร์.')`);
    }

    // Contact settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const contactExists = await client.query("SELECT COUNT(*) FROM site_settings WHERE key='contact'");
    if (parseInt(contactExists.rows[0].count) === 0) {
      await client.query(`INSERT INTO site_settings (key, value) VALUES ('contact', '{"line_id":"@athtrader","phone":"","email":"contact@athtrader.com","qr_code":"","facebook":"","website":""}')`);
    }

    console.log('Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
