const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM signals ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get signals error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { pair, direction, entry, tp1, tp2, tp3, sl, status } = req.body;
    const result = await pool.query(
      'INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '', status || 'active']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// AI signal endpoint (authenticated via API key, no JWT needed)
router.post('/ai', async (req, res) => {
  try {
    const apiKey = req.headers['x-ai-key'];
    const expectedKey = process.env.AI_SIGNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid AI key' });
    }
    const { pair, direction, entry, tp1, tp2, tp3, sl } = req.body;
    if (!pair || !direction) {
      return res.status(400).json({ error: 'pair and direction required' });
    }
    const result = await pool.query(
      "INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'active') RETURNING *",
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '']
    );
    console.log(`AI signal saved: ${pair} ${direction}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('AI signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { pair, direction, entry, tp1, tp2, tp3, sl, status } = req.body;
    const result = await pool.query(
      'UPDATE signals SET pair=$1, direction=$2, entry=$3, tp1=$4, tp2=$5, tp3=$6, sl=$7, status=$8 WHERE id=$9 RETURNING *',
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '', status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM signals WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
