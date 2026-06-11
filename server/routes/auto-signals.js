const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const { getMarketContext } = require('../services/market-data');
const router = express.Router();

function parsePrice(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  const cleaned = String(v).replace(/[^0-9.]/g, '');
  return cleaned || '';
}

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
        let ohlcContext = '';
        try {
          const ctx = await getMarketContext(pair);
          if (ctx && ctx.context) ohlcContext = '\nReal M5 OHLC Structure:\n' + ctx.context + '\n';
        } catch {}

        const prompt = `You are a Professional BOS (Break of Structure) analyst specializing in ${pair}.${ohlcContext}

Analyze ${pair} on the M5 timeframe using BOS + Order Block strategy:

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
  "pair": "${pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "4317.01",
  "tp1": "4325.61",
  "tp2": "4332.61",
  "tp3": "4344.62",
  "sl": "4268.19",
  "reason": "บรรทัด1\\nบรรทัด2\\nบรรทัด3"
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
          [data.pair, data.direction, parsePrice(data.entry), parsePrice(data.tp1), parsePrice(data.tp2), parsePrice(data.tp3), parsePrice(data.sl), data.reason || '']
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
        let ohlcContext = '';
        try {
          const ctx = await getMarketContext(pair);
          if (ctx && ctx.context) ohlcContext = '\nReal M5 OHLC Structure:\n' + ctx.context + '\n';
        } catch {}

        const prompt = `You are a Professional BOS (Break of Structure) analyst specializing in ${pair}.${ohlcContext}

Analyze ${pair} on the M5 timeframe using BOS + Order Block strategy:

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
  "pair": "${pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "4317.01",
  "tp1": "4325.61",
  "tp2": "4332.61",
  "tp3": "4344.62",
  "sl": "4268.19",
  "reason": "บรรทัด1\\nบรรทัด2\\nบรรทัด3"
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
        [s.pair, s.direction, parsePrice(s.entry), parsePrice(s.tp1), parsePrice(s.tp2), parsePrice(s.tp3), parsePrice(s.sl), s.reason || '']
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

// POST /auto-signals/cron — external cron endpoint (every 1h), sends LINE
router.post('/cron', async (req, res) => {
  try {
    const apiKey = req.headers['x-ai-key'];
    const expectedKey = process.env.AI_SIGNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid AI key' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY not set' });
    }

    const settings = await getSettings();
    const enabledPairs = [];
    for (const cat of ['commodities', 'forex', 'crypto']) {
      if (!Array.isArray(settings[cat])) continue;
      for (const p of settings[cat]) {
        if (p.enabled) enabledPairs.push(p.pair);
      }
    }
    if (enabledPairs.length === 0) {
      return res.json({ skipped: true, reason: 'no pairs enabled' });
    }

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: openaiKey });

    const results = [];
    for (const pair of enabledPairs) {
      // Small delay to respect TwelveData rate limit (8/min)
      if (results.length > 0) await new Promise(r => setTimeout(r, 2000));
      try {
        let ohlcContext = '';
        let swingHigh = null, swingLow = null, currentPrice = null;
        try {
          const ctx = await getMarketContext(pair);
          if (ctx) {
            ohlcContext = '\nReal M5 OHLC Structure:\n' + (ctx.context || '') + '\n';
            const s = ctx.structure || {};
            swingHigh = s.latestSwingHigh || null;
            swingLow = s.latestSwingLow || null;
            currentPrice = s.currentPrice || null;
          }
        } catch {}

        const prompt = `You are a Professional BOS (Break of Structure) analyst specializing in ${pair}.${ohlcContext}

Analyze ${pair} on the M5 timeframe using BOS + Order Block strategy:

🔵 1. Bullish BOS (Buy Setup) — close above previous HH → BUY LIMIT at OB Low
🔴 2. Bearish BOS (Sell Setup) — close below previous LL → SELL LIMIT at OB High

Entry Condition — ONLY generate when clear BOS confirmed + price retracing to OB zone.

IMPORTANT: Return ALL price values as numeric strings WITHOUT $ or commas.
Example: "1.08750", not "$1.08750", not "price at OB".

Return ONLY valid JSON (no markdown):
{
  "pair": "${pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "1.08750",
  "tp1": "1.09200",
  "tp2": "1.09500",
  "tp3": "1.09800",
  "sl": "1.08400",
  "reason": "บรรทัด1\\nบรรทัด2\\nบรรทัด3"
}

If no setup: {"pair": "${pair}", "hasSetup": false}`;

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
            [data.pair, data.direction, parsePrice(data.entry), parsePrice(data.tp1), parsePrice(data.tp2), parsePrice(data.tp3), parsePrice(data.sl), data.reason || '']
          );
          console.log(`[Cron] Signal saved: ${pair} ${data.direction} (id: ${result.rows[0].id})`);
          results.push({ pair, hasSignal: true, signalId: result.rows[0].id, direction: data.direction });
        }
        results.push({ pair, hasSignal: false, swingHigh, swingLow, currentPrice });
      } catch (err) {
        console.error(`[Cron] Error for ${pair}:`, err.message);
        results.push({ pair, hasSignal: false, error: err.message });
      }
    }

    // Send LINE notification
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const lineTarget = process.env.LINE_GROUP_ID || process.env.LINE_USER_ID;
    if (lineToken && lineTarget) {
      const lines = [];
      const hasAnySignal = results.some(r => r.hasSignal);
      lines.push(hasAnySignal ? '🆕 ATH Trader — มีสัญญาณใหม่' : '⏳ ATH Trader — ไม่มีสัญญาณขณะนี้');
      lines.push('');

      for (const r of results) {
        const p = r.pair || '?';
        const price = r.currentPrice || 'N/A';
        if (r.hasSignal) {
          lines.push('✅ ' + p + ' @' + price + ' — ' + (r.direction || '') + ' #' + r.signalId);
        } else {
          lines.push('📊 ' + p + ' @' + price);
          if (r.swingHigh) lines.push('   🟢 BOS เหนือ ' + r.swingHigh);
          if (r.swingLow)  lines.push('   🔴 BOS ต่ำกว่า ' + r.swingLow);
        }
        lines.push('********************************');
      }

      lines.push('');
      const now = new Date();
      lines.push('⏰ ' + now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }));

      try {
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + lineToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: lineTarget,
            messages: [{ type: 'text', text: lines.join('\n') }],
          }),
        });
        console.log('[Cron] LINE sent');
      } catch (err) {
        console.error('[Cron] LINE error:', err.message);
      }
    }

    res.json({ posted: results.filter(r => r.hasSignal).length, results });
  } catch (err) {
    console.error('[Cron] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
