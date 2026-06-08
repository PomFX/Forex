require('dotenv').config();
const OpenAI = require('openai');
const { sendSignalMessage } = require('./line');

const API_BASE = process.env.AI_API_URL || 'http://localhost:8080';

async function fetchOHLCContext(pair) {
  try {
    const res = await fetch(`${API_BASE}/api/market/ohlc?pair=${pair}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.context || null;
  } catch (err) {
    console.warn('OHLC fetch error:', err.message);
    return null;
  }
}

async function generateSignal(marketData) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const ohlcContext = await fetchOHLCContext('XAU/USD');

  const marketTable = marketData.map(d =>
    `${d.pair} | Price: ${d.price} | Change: ${d.change.toFixed(2)}%`
  ).join('\n');

  const prompt = `You are a Professional BOS (Break of Structure) analyst specializing in XAU/USD (Gold). Analyze the M15 chart structure using BOS + Order Block strategy.

Current Market Data:
${marketTable}

M15 OHLC Structure (Real Data):
${ohlcContext || 'ไม่มีข้อมูล OHLC — ใช้ราคาปัจจุบันประเมินเท่าที่ทำได้'}

BOS Analysis Framework (M15 Timeframe):

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

CRITICAL: If there is NO clear BOS setup — return an empty array [].
Only generate 1 signal (XAU/USD only) when ALL conditions align.

IMPORTANT: Return ALL price values as numeric strings WITHOUT $ or commas.
Example: "4317.01", not "$4317.01", not "price at OB".

For each signal provide:
- pair: always "XAU/USD"
- direction: BUY or SELL
- entry: numeric string (below current for BUY LIMIT, above current for SELL LIMIT)
- tp1: numeric string (R:R ~1:2)
- tp2: numeric string (R:R ~1:3)
- tp3: numeric string (R:R ~1:5)
- sl: numeric string (below OB low for buy, above OB high for sell)
- reason: in Thai (3 lines max) explaining:
  1. BOS ที่เกิดขึ้น + โครงสร้างตลาด
  2. Order Block zone ที่รอ Retest
  3. Entry rationale + R:R

Return ONLY a valid JSON array (no markdown, no code blocks, no extra text):
[] — if no valid BOS setup

Or if conditions met:
[
  {
    "pair": "XAU/USD",
    "direction": "BUY",
    "entry": "4445.00",
    "tp1": "4470.00",
    "tp2": "4485.00",
    "tp3": "4500.00",
    "sl": "4435.00",
    "reason": "BOS ทะลุ High เดิม 4460\nรอ Buy Limit ที่ Low ของแท่ง Bearish สุดท้าย 4445\nSL ใต้ OB 4435 TP1 4470 (R:R 1:2)"
  }
]`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const text = completion.choices[0].message.content.trim();
  const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
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
  console.log('Fetching OHLC market data from server...\n');

  const marketData = [{ pair: 'XAU/USD', price: 0, change: 0 }];

  console.log('Generating AI signals...');
  const signals = await generateSignal(marketData);
  console.log(`Generated ${signals.length} signal(s)\n`);

  if (signals.length === 0) {
    console.log('No valid BOS setup found — skipping');
    return;
  }

  console.log('Posting to API...');
  await postSignals(signals);

  console.log('\n=== Done ===');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { fetchOHLCContext, generateSignal, postSignals };
