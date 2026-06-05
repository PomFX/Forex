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
function calcAutoVipCount() {
  const BASE = 109;
  const START = new Date('2026-06-05');
  const now = new Date();
  const days = Math.max(0, Math.floor((now - START) / 86400000));
  // 10-day cycle of daily increments (5-10)
  const CYCLE = [5, 8, 6, 10, 7, 9, 5, 8, 7, 6];
  const sumCycle = CYCLE.reduce((a, b) => a + b, 0);
  const fullCycles = Math.floor(days / CYCLE.length);
  const remainder = days % CYCLE.length;
  let total = BASE + fullCycles * sumCycle;
  for (let i = 0; i < remainder; i++) total += CYCLE[i];
  return total;
}

router.get('/public', async (req, res) => {
  try {
    const [sigStats] = await Promise.all([
      pool.query(
        "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE direction='BUY' AND status='win') as buy_wins, COUNT(*) FILTER (WHERE direction='SELL' AND status='win') as sell_wins FROM signals"
      ),
    ]);
    res.json({
      totalSignals: parseInt(sigStats.rows[0].total),
      buyWins: parseInt(process.env.HOMEPAGE_BUY_WINS) || parseInt(sigStats.rows[0].buy_wins),
      sellWins: parseInt(process.env.HOMEPAGE_SELL_WINS) || parseInt(sigStats.rows[0].sell_wins),
      vipCount: calcAutoVipCount(),
    });
  } catch (err) {
    console.error('Get public stats error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// Gold (XAU/USD) stats
router.get('/gold', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='win') as wins, COUNT(*) FILTER (WHERE status='loss') as losses, COUNT(*) FILTER (WHERE status='active') as active FROM signals WHERE pair='XAU/USD'"
    );
    const r = result.rows[0];
    const total = parseInt(r.total);
    const wins = parseInt(r.wins);
    const losses = parseInt(r.losses);
    const active = parseInt(r.active);
    const winRate = total > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 0;
    res.json({ total, wins, losses, active, winRate: parseFloat(winRate) });
  } catch (err) {
    console.error('Get gold stats error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
