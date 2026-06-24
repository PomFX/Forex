require('dotenv').config();
const OpenAI = require('openai');
const { sendSignalMessage, sendBOSLevelsMessage } = require('./line');

const API_BASE = process.env.AI_API_URL || 'http://localhost:8080';

async function fetchOHLCContext(pair) {
  try {
    const res = await fetch(`${API_BASE}/api/market/ohlc?pair=${pair}`);
    if (!res.ok) return { context: null, currentPrice: null, swingHigh: null, swingLow: null };
    const data = await res.json();
    const s = data.structure || {};
    return {
      context: data.context || null,
      currentPrice: s.currentPrice || null,
      swingHigh: s.latestSwingHigh || null,
      swingLow: s.latestSwingLow || null,
    };
  } catch (err) {
    console.warn('OHLC fetch error:', err.message);
    return { context: null, currentPrice: null, swingHigh: null, swingLow: null };
  }
}

async function getEnabledPairs() {
  try {
    const res = await fetch(`${API_BASE}/api/auto-signals/settings`);
    if (!res.ok) return ['XAU/USD'];
    const settings = await res.json();
    const pairs = [];
    for (const cat of ['commodities', 'forex', 'crypto']) {
      if (!Array.isArray(settings[cat])) continue;
      for (const p of settings[cat]) {
        if (p.enabled) pairs.push(p.pair);
      }
    }
    return pairs.length > 0 ? pairs : ['XAU/USD'];
  } catch {
    return ['XAU/USD'];
  }
}

function buildPrompt(pair, ohlcContext, currentPrice) {
  const mkt = `${pair} | Price: ${currentPrice !== null ? currentPrice : 'N/A'}`;
  return `You are a Professional BOS (Break of Structure) analyst specializing in ${pair}. Analyze the M5 chart structure using BOS + Order Block strategy.

Current Market Data:
${mkt}

M5 OHLC Structure (Real Data):
${ohlcContext || 'ไม่มีข้อมูล OHLC — ใช้ราคาปัจจุบันประเมินเท่าที่ทำได้'}

BOS Analysis Framework (M5 Timeframe):

🔵 1. Bullish BOS (Buy Setup)
   - Price closes above previous HH (Break of Structure to the upside)
   - Identify the last bearish candle (Down Close Candle / Order Block) before the breakout
   - Entry: BUY LIMIT at Low of that Order Block
   - SL: below Order Block low or nearest Swing Low
   - TP: next Swing High (TP1=R:R 1:2, TP2=R:R 1:3, TP3=R:R 1:5)

🔴 2. Bearish BOS (Sell Setup)
   - Price closes below previous LL (Break of Structure to the downside)
   - Identify the last bullish candle (Up Close Candle / Order Block) before the breakout
   - Entry: SELL LIMIT at High of that Order Block
   - SL: above Order Block high or nearest Swing High
   - TP: next Swing Low (TP1=R:R 1:2, TP2=R:R 1:3, TP3=R:R 1:5)

3. Entry Condition — ONLY generate when:
   A. Clear BOS confirmed (close beyond previous HH or LL)
   B. Price is retracing toward the Order Block zone

CRITICAL: If there is NO clear BOS setup — return "NO_SETUP".
Only generate signal when ALL conditions align.

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
}

If no setup, return: {"pair": "${pair}", "hasSetup": false}`;
}

async function generatePairSignal(pair) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const ohlc = await fetchOHLCContext(pair);
  const prompt = buildPrompt(pair, ohlc.context, ohlc.currentPrice);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const text = completion.choices[0].message.content.trim();
  const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
  const data = JSON.parse(cleaned);
  const signals = data.hasSetup ? [data] : [];

  return { signals, swingHigh: ohlc.swingHigh, swingLow: ohlc.swingLow, currentPrice: ohlc.currentPrice };
}

async function postSignals(signals) {
  const apiUrl = process.env.AI_API_URL || 'http://localhost:8080';
  const apiKey = process.env.AI_SIGNAL_API_KEY;

  if (!apiKey) {
    console.error('AI_SIGNAL_API_KEY not set');
    return;
  }

  const results = [];
  for (const s of signals) {
    try {
      const res = await fetch(`${apiUrl}/api/signals/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Key': apiKey,
        },
        body: JSON.stringify(s),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✔ ${s.pair} ${s.direction} saved (id: ${data.id})`);
        await sendSignalMessage({ ...s, id: data.id }, 'created');
        results.push({ ok: true, data });
      } else {
        console.error(`✖ ${s.pair}: ${data.error}`);
        results.push({ ok: false, error: data.error });
      }
    } catch (err) {
      console.error(`✖ ${s.pair}: ${err.message}`);
      results.push({ ok: false, error: err.message });
    }
  }
  return results;
}

async function main() {
  console.log('=== AI Signal Generator ===\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  console.log(`API URL: ${API_BASE}`);
  const pairs = await getEnabledPairs();
  console.log(`Enabled pairs: ${pairs.join(', ')}\n`);

  const posted = [];
  const bosData = [];

  for (const pair of pairs) {
    console.log(`Analyzing ${pair}...`);
    const { signals, swingHigh, swingLow, currentPrice } = await generatePairSignal(pair);
    if (signals.length > 0) {
      console.log(`  ✔ ${pair}: ${signals[0].direction} signal generated`);
      const saved = await postSignals(signals);
      posted.push(...saved.filter(r => r.ok));
    } else {
      console.log(`  ✖ ${pair}: no BOS setup`);
    }
    bosData.push({ pair, currentPrice, swingHigh, swingLow, hasSignal: signals.length > 0 });
  }

  // ปิดการส่งสรุป BOS levels เพื่อประหยัดโควต้า LINE
  // await sendBOSLevelsMessage(bosData);
  console.log(`\n=== Done — ${posted.length} signal(s) posted ===`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { fetchOHLCContext, generatePairSignal, postSignals };