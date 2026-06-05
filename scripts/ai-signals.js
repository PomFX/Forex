require('dotenv').config();
const OpenAI = require('openai');
const { sendSignalMessage } = require('./line');

const FOREX_MAP = {
  'EUR/USD': { from: 'EUR', to: 'USD' },
  'GBP/USD': { from: 'GBP', to: 'USD' },
  'USD/JPY': { from: 'USD', to: 'JPY' },
  'USD/CHF': { from: 'USD', to: 'CHF' },
  'AUD/USD': { from: 'AUD', to: 'USD' },
  'USD/CAD': { from: 'USD', to: 'CAD' },
};

async function fetchMarketData() {
  let forexData = {};
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.rates) {
      forexData = data.rates;
    }
  } catch (err) {
    console.warn('Forex API error:', err.message);
  }

  const results = [];

  // XAU/USD always first
  try {
    const res = await fetch('https://api.gold-api.com/price/XAU');
    const data = await res.json();
    if (data && data.price) {
      results.push({ pair: 'XAU/USD', price: data.price, change: 0 });
    }
  } catch {}

  for (const [pair, { from, to }] of Object.entries(FOREX_MAP)) {
    let price = null;
    if (from === 'USD') {
      price = forexData[to] || null;
    } else {
      price = forexData[from] ? (1 / forexData[from]) : null;
    }
    if (price) {
      results.push({ pair, price: parseFloat(price.toFixed(5)), change: 0 });
    }
  }

  return results;
}

async function generateSignal(marketData) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const marketTable = marketData.map(d =>
    `${d.pair} | Price: ${d.price} | Change: ${d.change.toFixed(2)}%`
  ).join('\n');

  const prompt = `You are a professional Smart Money Concepts (SMC) analyst specializing in XAU/USD (Gold). Analyze the H1 chart structure and determine if there is a valid SMC entry setup.

Current Market Data:
${marketTable}

SMC Analysis Framework (H1 Timeframe):

1. Market Structure (โครงสร้างตลาด)
   - Identify recent HH/HL (uptrend) or LH/LL (downtrend)
   - Look for CHoCH (Change of Character) — last break of structure before reversal
   - Look for BOS (Break of Structure) — price breaks previous HH or LL

2. Order Block (OB) — โซนคำสั่งสถาบัน
   - Bullish OB: last bearish candle before a strong upward move
   - Bearish OB: last bullish candle before a strong downward move
   - Is price currently near a valid OB?

3. Fair Value Gap (FVG) — ช่องว่างราคาที่น่าสนใจ
   - 3-candle imbalance gap
   - Is there an unfilled FVG that price may retest?

4. Liquidity (สภาพคล่อง)
   - Above recent highs (Buy-side liquidity / Stop hunts)
   - Below recent lows (Sell-side liquidity)
   - Any liquidity sweep happened recently?

5. Entry Condition — ONLY generate signal if BOTH conditions are met:
   A. Clear market structure (BOS or CHoCH confirmed)
   B. Price is at a valid OB or FVG zone with liquidity taken

CRITICAL: If there is NO clear SMC setup — return an empty array [].
Only generate 1 signal (XAU/USD only) when ALL SMC conditions align.

For each signal provide:
- pair: always "XAU/USD"
- direction: BUY or SELL
- entry: price at the OB/FVG zone
- tp1: first liquidity target (nearest HH/HL or structural level)
- tp2: second target
- tp3: third target
- sl: beyond the opposite side of the OB (below OB low for buy, above OB high for sell)
- reason: in Thai (3 lines max) explaining:
  1. Market Structure + BOS/CHoCH ที่เกิดขึ้น
  2. Order Block หรือ FVG ที่ราคากำลังทดสอบ
  3. Liquidity ถูกเก็บ + เหตุผลการเข้าเทรด

Return ONLY a valid JSON array (no markdown, no code blocks, no extra text):
[] — if no valid SMC setup

Or if conditions met:
[
  {
    "pair": "XAU/USD",
    "direction": "BUY",
    "entry": "4450.00",
    "tp1": "4470.00",
    "tp2": "4485.00",
    "tp3": "4500.00",
    "sl": "4440.00",
    "reason": "BOS เกิดขึ้น ทะลุ High เดิม 4450\nราคากำลัง Retest Order Block โซน 4440-4450\nLiquidity ถูกเก็บด้านล่าง 4430 ก่อนดีดตัวขึ้น"
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

  console.log('Fetching market data...');
  const marketData = await fetchMarketData();
  if (marketData.length === 0) {
    console.error('No market data available');
    process.exit(1);
  }
  marketData.forEach(d => console.log(`  ${d.pair}: ${d.price} (${d.change.toFixed(2)}%)`));

  console.log('\nGenerating AI signals...');
  const signals = await generateSignal(marketData);
  console.log(`Generated ${signals.length} signal(s)\n`);

  if (signals.length === 0) {
    console.log('No valid SMC setup found — skipping');
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

module.exports = { fetchMarketData, generateSignal, postSignals };
