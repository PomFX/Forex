const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [users, signals, articles, brokers, vipCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM signals'),
      pool.query('SELECT COUNT(*) FROM articles'),
      pool.query('SELECT COUNT(*) FROM brokers'),
      pool.query("SELECT COUNT(*) FROM users WHERE vip_level != 'Free'"),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalSignals: parseInt(signals.rows[0].count),
      totalArticles: parseInt(articles.rows[0].count),
      totalBrokers: parseInt(brokers.rows[0].count),
      vipUsers: parseInt(vipCount.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public stats for home page
router.get('/public', async (req, res) => {
  try {
    const [signals, users] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE direction=$1 AND status=$2) as buy_wins, COUNT(*) FILTER (WHERE direction=$3 AND status=$4) as sell_wins FROM signals', ['BUY', 'win', 'SELL', 'win']),
      pool.query("SELECT COUNT(*) FROM users WHERE vip_level != 'Free'"),
    ]);
    res.json({
      totalSignals: parseInt(signals.rows[0].total),
      buyWins: 10,
      sellWins: 30,
      vipCount: 1250,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
