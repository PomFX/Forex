const express = require('express');
const router = express.Router();

const FOREX_API = 'https://open.er-api.com/v6/latest/USD';
const GOLD_API = 'https://api.metals.live/v1/spot/gold';

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
      if (goldData && goldData.length > 0) {
        prices['XAU/USD'] = goldData[0].price || goldData[0].xauPrice || null;
      }
    } catch {}

    res.json(prices);
  } catch (err) {
    console.error('Market prices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

module.exports = router;
