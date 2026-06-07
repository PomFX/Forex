const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const SETTINGS_KEY = 'ai_settings';

const DEFAULT_SETTINGS = {
  model: 'gpt-4o-mini',
  prompt: `You are a Professional Smart Money Concepts (SMC) analyst specializing in {pair}.

Analyze {pair} on the M15 timeframe using SMC concepts:

1. Market Structure — Identify HH/HL, LH/LL. Has there been a Change of Character (CHoCH) or Break of Structure (BOS)?
2. Order Block — Are there clear Bullish or Bearish Order Blocks?
3. Fair Value Gap — Is there an imbalance (FVG) from 3-candle momentum?
4. Liquidity — Where are the buy-side / sell-side liquidity pools? Any stop hunts?
5. Entry Condition — Both conditions must be met:
   A. Clear market structure shift (BOS or CHoCH confirmed on M15)
   B. Price at a valid Order Block or FVG zone with liquidity taken nearby

If there is a clear SMC setup, return signal details. Otherwise return "NO_SETUP".

Return ONLY valid JSON (no markdown, no code blocks):
{
  "pair": "{pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "price",
  "tp1": "price",
  "tp2": "price",
  "tp3": "price",
  "sl": "price",
  "reason": "3-bullet Thai reason: 1) Market Structure 2) OB/FVG 3) Liquidity + entry rationale"
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
    const filledPrompt = prompt.replace(/\{pair\}/g, pair || 'XAU/USD');

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
