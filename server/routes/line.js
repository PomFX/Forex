const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  const events = req.body.events || [];

  for (const event of events) {
    if (event.source && event.source.groupId) {
      const gid = event.source.groupId;
      console.log('*** GROUP ID:', gid, '***');
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('line_group_id', $1) ON CONFLICT (key) DO UPDATE SET value=$1",
        [gid]
      );
    }
  }

  res.json({ ok: true });
});

router.get('/group-id', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key='line_group_id'");
    if (result.rows.length > 0) {
      res.json({ groupId: result.rows[0].value });
    } else {
      res.json({ groupId: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LINE Messaging API quota info
router.get('/quota', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not set' });

    const headers = { Authorization: 'Bearer ' + token };
    const [quotaRes, usageRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers }),
    ]);

    const quota = quotaRes.ok ? await quotaRes.json() : { error: await quotaRes.text() };
    const usage = usageRes.ok ? await usageRes.json() : { error: await usageRes.text() };

    res.json({ quota, usage });
  } catch (err) {
    console.error('LINE quota error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
