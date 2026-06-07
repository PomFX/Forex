const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const SETTINGS_KEY = 'ai_article_settings';

const DEFAULT_SETTINGS = {
  model: 'gpt-4o-mini',
  prompt: `คุณเป็นนักวิเคราะห์ราคาทองคำมืออาชีพ

เขียนบทวิเคราะห์ XAU/USD สำหรับ Day Trading (H1) ภาษาไทย กระชับตรงประเด็น

เนื้อหาต้องมี 4 หัวข้อ:
1) Current Market Snapshot — ราคาปัจจุบัน {price} USD, แนวโน้มโดยรวม
2) H1 Technical Analysis — Support/Resistance, RSI, MACD, EMA, Candlestick Patterns
3) Intraday Drivers & Catalyst — DXY, Bond Yield, Economic Data
4) Hourly Trading Strategy — Buy/Sell, SL, TP, Risk-Reward

Return JSON:
{
  "title": "หัวข้อภาษาไทย",
  "content": "เนื้อหาภาษาไทยทั้งหมด"
}`,
  temperature: 0.7,
};

async function getSettings() {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key=$1", [SETTINGS_KEY]);
    if (result.rows.length === 0) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    return { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...JSON.parse(result.rows[0].value) };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

async function saveSettings(data) {
  await pool.query(
    "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2",
    [SETTINGS_KEY, JSON.stringify(data)]
  );
}

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    console.error('Get AI article settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = req.body;
    await saveSettings(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save AI article settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

router.post('/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const settings = await getSettings();
    const model = settings.model || 'gpt-4o-mini';

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: settings.temperature || 0.7,
    });

    const text = completion.choices[0].message.content.trim();
    const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { parsed = { raw: text }; }

    res.json({ result: parsed, raw: text });
  } catch (err) {
    console.error('Test AI article error:', err.message);
    res.status(500).json({ error: 'ทดสอบ AI ล้มเหลว: ' + err.message });
  }
});

router.post('/generate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSettings();
    const model = settings.model || 'gpt-4o-mini';

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(400).json({ error: 'OPENAI_API_KEY not set on server' });

    let goldPrice = 'unknown';
    try {
      const goldRes = await fetch('https://www.gold-api.com/api/XAU/USD/price?api_key=demo');
      if (goldRes.ok) {
        const goldData = await goldRes.json();
        goldPrice = goldData.price ? String(goldData.price) : 'unknown';
      }
    } catch { /* use default */ }

    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });
    const prompt = (settings.prompt || DEFAULT_SETTINGS.prompt).replace(/\{price\}/g, goldPrice).replace(/\{date\}/g, today);

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: openaiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: settings.temperature || 0.7,
    });

    const text = completion.choices[0].message.content.trim();
    const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
    let article;
    try { article = JSON.parse(cleaned); } catch { return res.status(500).json({ error: 'AI response not valid JSON', raw: text }); }

    if (!article.title || !article.content) {
      return res.status(500).json({ error: 'AI response missing title/content', raw: article });
    }

    const result = await pool.query(
      'INSERT INTO articles (title, content, image) VALUES ($1, $2, $3) RETURNING *',
      [article.title, article.content, '']
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Generate AI article error:', err.message);
    res.status(500).json({ error: 'สร้างบทความล้มเหลว: ' + err.message });
  }
});

module.exports = router;
