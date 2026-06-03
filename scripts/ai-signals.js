require('dotenv').config();
const OpenAI = require('openai');

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

  const prompt = `You are a professional Forex analyst specializing in XAU/USD (Gold). Analyze the current market data and generate 1-3 trading signals. CRITICAL: You MUST include at least one XAU/USD (Gold) signal in every response.

Current Market Data:
${marketTable}

Instructions:
- ALWAYS include XAU/USD (Gold) as the first signal — this is mandatory
- Choose additional pairs if market conditions warrant
- For each signal provide: pair, direction (BUY/SELL), entry price, TP1, TP2, TP3, SL
- Entry should be near current price with a reasonable spread
- TP levels should be realistic (20-100 pips from entry depending on pair)
- SL should be logical (15-50 pips opposite direction)

Return ONLY a valid JSON array (no markdown, no code blocks, no extra text):
[
  {
    "pair": "XAU/USD",
    "direction": "BUY",
    "entry": "2350.00",
    "tp1": "2360.00",
    "tp2": "2370.00",
    "tp3": "2385.00",
    "sl": "2340.00"
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
