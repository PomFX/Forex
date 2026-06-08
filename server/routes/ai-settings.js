const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const { getMarketContext } = require('../services/market-data');
const router = express.Router();

const SETTINGS_KEY = 'ai_settings';

const DEFAULT_SETTINGS = {
  model: 'gpt-4o-mini',
  prompt: `You are a Professional BOS (Break of Structure) analyst specializing in {pair}.{ohlc}

Analyze {pair} on the M15 timeframe using BOS + Order Block strategy:

🔵 1. Bullish BOS (Buy Setup)
   - Price closes above previous HH (Break of Structure to the upside)
   - Identify the last bearish candle (Down Close Candle / Order Block) just before the bullish breakout
   - Entry: BUY LIMIT at Low of that Order Block
   - SL: below Order Block low or nearest Swing Low
   - TP: next Swing High (TP1=R:R 1:2, TP2=R:R 1:3, TP3=R:R 1:5)

🔴 2. Bearish BOS (Sell Setup)
   - Price closes below previous LL (Break of Structure to the downside)
   - Identify the last bullish candle (Up Close Candle / Order Block) just before the bearish breakout
   - Entry: SELL LIMIT at High of that Order Block
   - SL: above Order Block high or nearest Swing High
   - TP: next Swing Low (TP1=R:R 1:2, TP2=R:R 1:3, TP3=R:R 1:5)

3. Entry Condition — ONLY generate when:
   A. Clear BOS confirmed (close beyond previous HH or LL)
   B. Price is retracing toward the Order Block zone

Order Type: Always BUY LIMIT (entry below current price) / SELL LIMIT (entry above current price).

If there is a clear BOS setup, return signal details. Otherwise return "NO_SETUP".

IMPORTANT: Return ALL price values as numeric strings WITHOUT $ or commas.
Example: "4317.01", not "$4317.01", not "price at OB".

Return ONLY valid JSON (no markdown, no code blocks):
{
  "pair": "{pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "4317.01",
  "tp1": "4325.61",
  "tp2": "4332.61",
  "tp3": "4344.62",
  "sl": "4268.19",
  "reason": "บรรทัด1บรรทัด2บรรทัด3"
}`,
  temperature: 0.7,
  maxSignalsPerDay: 4,
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
    console.error('Get AI settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = req.body;
    await saveSettings(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save AI settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

router.post('/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { prompt, pair } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(400).json({ error: 'OPENAI_API_KEY not set on server' });

    const settings = await getSettings();
    const model = settings.model || 'gpt-4o-mini';
    const targetPair = pair || 'XAU/USD';

    let ohlcContext = '';
    try {
      const ctx = await getMarketContext(targetPair);
      if (ctx && ctx.context) ohlcContext = '\n\nReal M15 OHLC Structure:\n' + ctx.context;
    } catch {}

    const filledPrompt = prompt
      .replace(/\{pair\}/g, targetPair)
      .replace(/\{ohlc\}/g, ohlcContext);

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: openaiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: filledPrompt }],
      temperature: settings.temperature || 0.7,
    });

    const text = completion.choices[0].message.content.trim();
    const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { parsed = { raw: text }; }

    res.json({ result: parsed, raw: text });
  } catch (err) {
    console.error('Test AI settings error:', err.message);
    res.status(500).json({ error: 'ทดสอบ AI ล้มเหลว: ' + err.message });
  }
});

module.exports = router;
