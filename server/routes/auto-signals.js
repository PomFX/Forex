const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const SETTINGS_KEY = 'auto_signals';

const DEFAULT_SETTINGS = {
  autoMode: false,
  interval: 60,
  lastRunAt: null,
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

function ensureMeta(settings) {
  if (typeof settings.autoMode !== 'boolean') settings.autoMode = false;
  if (!settings.interval) settings.interval = 60;
  if (!settings.lastRunAt) settings.lastRunAt = null;
  return settings;
}

async function getSettings() {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key=$1", [SETTINGS_KEY]);
    if (result.rows.length === 0) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    return ensureMeta(JSON.parse(result.rows[0].value));
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

// GET /auto-signals/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    console.error('Get auto-signal settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /auto-signals/settings (admin only)
router.put('/settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = ensureMeta(req.body);
    await saveSettings(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save auto-signal settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /auto-signals/auto-run — called by GitHub Actions cron; auto-posts if conditions met
router.post('/auto-run', async (req, res) => {
  try {
    const apiKey = req.headers['x-ai-key'];
    const expectedKey = process.env.AI_SIGNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid AI key' });
    }

    const settings = await getSettings();

    if (!settings.autoMode) {
      return res.json({ skipped: true, reason: 'autoMode disabled' });
    }

    const now = Date.now();
    const intervalMs = (settings.interval || 60) * 60 * 1000;
    const lastRun = settings.lastRunAt ? new Date(settings.lastRunAt).getTime() : 0;

    if (now - lastRun < intervalMs) {
      const remaining = Math.round((intervalMs - (now - lastRun)) / 60000);
      return res.json({ skipped: true, reason: `next run in ~${remaining} min` });
    }

    // Collect enabled pairs
    const enabledPairs = [];
    for (const cat of Object.keys(settings)) {
      if (!Array.isArray(settings[cat])) continue;
      for (const p of settings[cat]) {
        if (p.enabled) enabledPairs.push(p.pair);
      }
    }

    if (enabledPairs.length === 0) {
      return res.json({ skipped: true, reason: 'no pairs enabled' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY not set on server' });
    }

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: openaiKey });
    const posted = [];

    for (const pair of enabledPairs) {
      try {
        const prompt = `You are a Professional BOS (Break of Structure) analyst specializing in ${pair}.

Analyze ${pair} on the M15 timeframe using BOS + Order Block strategy:

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

Return ONLY valid JSON (no markdown, no code blocks):
{
  "pair": "${pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "price at Order Block",
  "tp1": "price (R:R 1:2)",
  "tp2": "price (R:R 1:3)",
  "tp3": "price (R:R 1:5)",
  "sl": "price (below OB low for BUY / above OB high for SELL)",
  "reason": "3-line Thai: 1) BOS direction + structure 2) Order Block zone 3) Entry rationale + R:R"
}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });

        const text = completion.choices[0].message.content.trim();
        const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleaned);

        if (data.hasSetup) {
          const result = await pool.query(
            "INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) RETURNING *",
            [data.pair, data.direction, data.entry || '', data.tp1 || '', data.tp2 || '', data.tp3 || '', data.sl || '', data.reason || '']
          );
          posted.push(result.rows[0]);
          console.log(`Auto-run signal: ${data.pair} ${data.direction} (id: ${result.rows[0].id})`);
        }
      } catch (err) {
        console.error(`Auto-run analysis failed for ${pair}:`, err.message);
      }
    }

    settings.lastRunAt = new Date().toISOString();
    await saveSettings(settings);

    res.json({ posted, runAt: settings.lastRunAt });
  } catch (err) {
    console.error('Auto-run error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /auto-signals/analyze — manual analysis (admin only)
router.post('/analyze', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY not set on server' });
    }

    const settings = await getSettings();
    const enabledPairs = [];
    for (const cat of Object.keys(settings)) {
      if (!Array.isArray(settings[cat])) continue;
      for (const p of settings[cat]) {
        if (p.enabled) enabledPairs.push(p.pair);
      }
    }

    if (enabledPairs.length === 0) {
      return res.json({ results: [], message: 'ไม่มีคู่ที่เปิดใช้งาน' });
    }

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: openaiKey });
    const results = [];

    for (const pair of enabledPairs) {
      try {
        const prompt = `You are a Professional BOS (Break of Structure) analyst specializing in ${pair}.

Analyze ${pair} on the M15 timeframe using BOS + Order Block strategy:

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

Return ONLY valid JSON (no markdown, no code blocks):
{
  "pair": "${pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "price at Order Block",
  "tp1": "price (R:R 1:2)",
  "tp2": "price (R:R 1:3)",
  "tp3": "price (R:R 1:5)",
  "sl": "price (below OB low for BUY / above OB high for SELL)",
  "reason": "3-line Thai: 1) BOS direction + structure 2) Order Block zone 3) Entry rationale + R:R"
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
        console.log(`Manual analyze ${pair}: ${data.hasSetup ? data.direction : 'NO_SETUP'}`);
      } catch (err) {
        console.error(`Manual analyze failed for ${pair}:`, err.message);
        results.push({ pair, hasSetup: false, error: err.message });
      }
    }

    res.json({ results, analyzedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Manual analyze error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /auto-signals/confirm (admin only)
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
      console.log(`Manual confirm: ${s.pair} ${s.direction} (id: ${result.rows[0].id})`);
    }

    res.json({ posted });
  } catch (err) {
    console.error('Manual confirm error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
