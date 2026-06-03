require('dotenv').config();

const FOREX_MAP = {
  'EUR/USD': { from: 'EUR', to: 'USD' },
  'GBP/USD': { from: 'GBP', to: 'USD' },
  'USD/JPY': { from: 'USD', to: 'JPY' },
  'USD/CHF': { from: 'USD', to: 'CHF' },
  'AUD/USD': { from: 'AUD', to: 'USD' },
  'USD/CAD': { from: 'USD', to: 'CAD' },
};

async function fetchCurrentPrices() {
  const prices = {};

  let forexData = {};
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.rates) forexData = data.rates;
  } catch (err) {
    console.warn('Forex API error:', err.message);
  }

  for (const [pair, { from, to }] of Object.entries(FOREX_MAP)) {
    let price = null;
    if (from === 'USD') {
      price = forexData[to] || null;
    } else {
      price = forexData[from] ? (1 / forexData[from]) : null;
    }
    if (price) prices[pair] = parseFloat(price.toFixed(5));
  }

  try {
    const res = await fetch('https://api.metals.live/v1/spot/gold');
    const data = await res.json();
    if (data && data.length > 0) {
      prices['XAU/USD'] = data[0].price || data[0].xauPrice || 2350;
    }
  } catch {}

  return prices;
}

async function getActiveSignals() {
  const apiUrl = process.env.AI_API_URL || 'http://localhost:8080';
  const res = await fetch(`${apiUrl}/api/signals`);
  if (!res.ok) throw new Error('Failed to fetch signals: ' + res.status);
  const signals = await res.json();
  return signals.filter(s => s.status === 'active');
}

async function evaluateAndUpdate(signal, prices) {
  const currentPrice = prices[signal.pair];
  if (!currentPrice) {
    console.log(`  ⏭ ${signal.pair} #${signal.id}: no price data`);
    return;
  }

  const entry = parseFloat(signal.entry);
  const tp1 = parseFloat(signal.tp1);
  const sl = parseFloat(signal.sl);
  if (isNaN(entry) || isNaN(tp1) || isNaN(sl)) {
    console.log(`  ⏭ ${signal.pair} #${signal.id}: invalid entry/TP/SL`);
    return;
  }

  let newStatus = null;

  if (signal.direction === 'BUY') {
    if (currentPrice >= tp1) {
      newStatus = 'win';
    } else if (currentPrice <= sl) {
      newStatus = 'loss';
    }
  } else if (signal.direction === 'SELL') {
    if (currentPrice <= tp1) {
      newStatus = 'win';
    } else if (currentPrice >= sl) {
      newStatus = 'loss';
    }
  }

  if (newStatus) {
    const apiUrl = process.env.AI_API_URL || 'http://localhost:8080';
    const apiKey = process.env.AI_SIGNAL_API_KEY;
    if (!apiKey) {
      console.error('AI_SIGNAL_API_KEY not set');
      return;
    }

    const res = await fetch(`${apiUrl}/api/signals/ai/evaluate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Key': apiKey,
      },
      body: JSON.stringify({ id: signal.id, status: newStatus }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`  ✔ #${signal.id} ${signal.pair} ${signal.direction} → ${newStatus} (price: ${currentPrice}, TP1: ${tp1}, SL: ${sl})`);
    } else {
      console.log(`  ✖ #${signal.id}: ${data.error}`);
    }
  } else {
    console.log(`  - #${signal.id} ${signal.pair} ${signal.direction}: still active (price: ${currentPrice}, entry: ${entry})`);
  }
}

async function main() {
  console.log('=== Signal Evaluation ===\n');

  console.log('Fetching current prices...');
  const prices = await fetchCurrentPrices();
  Object.entries(prices).forEach(([pair, price]) => console.log(`  ${pair}: ${price}`));

  console.log('\nFetching active signals...');
  const signals = await getActiveSignals();
  console.log(`Found ${signals.length} active signal(s)\n`);

  for (const s of signals) {
    await evaluateAndUpdate(s, prices);
  }

  console.log('\n=== Done ===');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { fetchCurrentPrices, getActiveSignals, evaluateAndUpdate };
