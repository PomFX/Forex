const express = require('express');
const router = express.Router();
const { getMarketContext, PAIR_MAP } = require('../services/market-data');

const FOREX_API = 'https://open.er-api.com/v6/latest/USD';
const GOLD_API = 'https://api.gold-api.com/price/XAU';

const FOREX_MAP = {
  'EUR/USD': { from: 'EUR', to: 'USD' },
  'GBP/USD': { from: 'GBP', to: 'USD' },
  'USD/JPY': { from: 'USD', to: 'JPY' },
  'USD/CHF': { from: 'USD', to: 'CHF' },
  'AUD/USD': { from: 'AUD', to: 'USD' },
  'USD/CAD': { from: 'USD', to: 'CAD' },
};

router.get('/prices', async (req, res) => {
  try {
    const prices = {};

    const forexRes = await fetch(FOREX_API);
    const forexData = await forexRes.json();
    if (forexData.rates) {
      for (const [pair, { from, to }] of Object.entries(FOREX_MAP)) {
        let price = null;
        if (from === 'USD') {
          price = forexData.rates[to] || null;
        } else {
          price = forexData.rates[from] ? (1 / forexData.rates[from]) : null;
        }
        if (price) prices[pair] = parseFloat(price.toFixed(5));
      }
    }

    try {
      const goldRes = await fetch(GOLD_API);
      const goldData = await goldRes.json();
      if (goldData && goldData.price) {
        prices['XAU/USD'] = goldData.price;
      }
    } catch {}

    res.json(prices);
  } catch (err) {
    console.error('Market prices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

router.get('/ohlc', async (req, res) => {
  try {
    const pair = req.query.pair || 'XAU/USD';
    if (!PAIR_MAP[pair]) {
      return res.status(400).json({ error: `Unsupported pair: ${pair}` });
    }

    const result = await getMarketContext(pair);
    if (!result) {
      return res.status(503).json({ error: 'No OHLC data available — check TWELVEDATA_API_KEY' });
    }

    res.json({
      pair: result.pair,
      structure: result.structure,
      context: result.context,
      candles: result.candles.slice(-20),
    });
  } catch (err) {
    console.error('OHLC error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
