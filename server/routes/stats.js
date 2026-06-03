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
    console.error('Get stats error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// Public stats for home page
router.get('/public', async (req, res) => {
  try {
    const [sigStats, vipStats] = await Promise.all([
      pool.query(
        "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE direction='BUY' AND status='win') as buy_wins, COUNT(*) FILTER (WHERE direction='SELL' AND status='win') as sell_wins FROM signals"
      ),
      pool.query("SELECT COUNT(*) FROM users WHERE vip_level != 'Free'"),
    ]);
    res.json({
      totalSignals: parseInt(sigStats.rows[0].total),
      buyWins: parseInt(process.env.HOMEPAGE_BUY_WINS) || parseInt(sigStats.rows[0].buy_wins),
      sellWins: parseInt(process.env.HOMEPAGE_SELL_WINS) || parseInt(sigStats.rows[0].sell_wins),
      vipCount: parseInt(process.env.HOMEPAGE_VIP_COUNT) || parseInt(vipStats.rows[0].count),
    });
  } catch (err) {
    console.error('Get public stats error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
