const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const SETTINGS_KEY = 'auto_signals';

const DEFAULT_PAIRS = {
  commodities: [
    { pair: 'XAU/USD', label: 'ทองคำ (XAU/USD)', enabled: true },
    { pair: 'XAG/USD', label: 'เงิน (XAG/USD)', enabled: false },
  ],
  forex: [
    { pair: 'EUR/USD', label: 'EUR/USD', enabled: false },
    { pair: 'GBP/USD', label: 'GBP/USD', enabled: false },
    { pair: 'USD/JPY', label: 'USD/JPY', enabled: false },
    { pair: 'USD/CHF', label: 'USD/CHF', enabled: false },
    { pair: 'AUD/USD', label: 'AUD/USD', enabled: false },
    { pair: 'NZD/USD', label: 'NZD/USD', enabled: false },
    { pair: 'USD/CAD', label: 'USD/CAD', enabled: false },
  ],
  crypto: [
    { pair: 'BTC/USD', label: 'BTC/USD', enabled: false },
    { pair: 'ETH/USD', label: 'ETH/USD', enabled: false },
    { pair: 'XRP/USD', label: 'XRP/USD', enabled: false },
  ],
};

async function getSettings() {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key=$1", [SETTINGS_KEY]);
    if (result.rows.length === 0) return DEFAULT_PAIRS;
    return JSON.parse(result.rows[0].value);
  } catch {
    return DEFAULT_PAIRS;
  }
}

async function saveSettings(data) {
  await pool.query(
    "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2",
    [SETTINGS_KEY, JSON.stringify(data)]
  );
}

// GET /auto-signals/settings — get pair toggle settings (public for now, but admin-only for write)
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    console.error('Get auto-signal settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /auto-signals/settings — save pair toggle settings (admin only)
router.put('/settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await saveSettings(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save auto-signal settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /auto-signals/analyze — run SMC analysis for enabled pairs
router.post('/analyze', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { OpenAI } = require('openai');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY not set on server' });
    }

    // Fetch current prices for enabled pairs
    const settings = await getSettings();
    const enabledPairs = [];
    for (const cat of Object.keys(settings)) {
      for (const p of settings[cat]) {
        if (p.enabled) enabledPairs.push(p.pair);
      }
    }

    if (enabledPairs.length === 0) {
      return res.json({ results: [], message: 'ไม่มีคู่ที่เปิดใช้งาน' });
    }

    const openai = new OpenAI({ apiKey });
    const results = [];

    for (const pair of enabledPairs) {
      try {
        const prompt = `You are a Professional Smart Money Concepts (SMC) analyst specializing in ${pair}.

Analyze ${pair} on the M15 timeframe using SMC concepts:

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
  "pair": "${pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "price",
  "tp1": "price",
  "tp2": "price",
  "tp3": "price",
  "sl": "price",
  "reason": "3-bullet Thai reason: 1) Market Structure 2) OB/FVG 3) Liquidity + entry rationale"
}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });

        const text = completion.choices[0].message.content.trim();
        const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleaned);
        results.push(data);
        console.log(`Auto-signal analyzed ${pair}: ${data.hasSetup ? data.direction : 'NO_SETUP'}`);
      } catch (err) {
        console.error(`Auto-signal analysis failed for ${pair}:`, err.message);
        results.push({ pair, hasSetup: false, error: err.message });
      }
    }

    res.json({ results, analyzedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Auto-signal analyze error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /auto-signals/confirm — confirm and post analyzed signals (admin only, uses AI key internally)
router.post('/confirm', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { signals } = req.body;
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return res.status(400).json({ error: 'No signals to confirm' });
    }

    const posted = [];
    for (const s of signals) {
      const result = await pool.query(
        "INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) RETURNING *",
        [s.pair, s.direction, s.entry || '', s.tp1 || '', s.tp2 || '', s.tp3 || '', s.sl || '', s.reason || '']
      );
      posted.push(result.rows[0]);
      console.log(`Auto-signal confirmed: ${s.pair} ${s.direction} (id: ${result.rows[0].id})`);
    }

    res.json({ posted });
  } catch (err) {
    console.error('Auto-signal confirm error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
