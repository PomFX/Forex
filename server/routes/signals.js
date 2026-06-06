const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM signals ORDER BY CASE WHEN pair='XAU/USD' THEN 0 ELSE 1 END, created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error('Get signals error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { pair, direction, entry, tp1, tp2, tp3, sl, status, reason } = req.body;
    const result = await pool.query(
      'INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '', status || 'active', reason || '']
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
    const { pair, direction, entry, tp1, tp2, tp3, sl, reason } = req.body;
    if (!pair || !direction) {
      return res.status(400).json({ error: 'pair and direction required' });
    }
    const result = await pool.query(
      "INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) RETURNING *",
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '', reason || '']
    );
    console.log(`AI signal saved: ${pair} ${direction}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('AI signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// MT5 endpoint — returns all active signals for EA (multi-symbol)
router.get('/mt5', async (req, res) => {
  try {
    const apiKey = req.headers['x-mt5-key'];
    const expectedKey = process.env.MT5_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid MT5 key' });
    }
    const result = await pool.query(
      "SELECT id, pair, direction, entry, tp1, tp2, tp3, sl, reason, created_at FROM signals WHERE status='active' ORDER BY created_at DESC"
    );
    res.json(result.rows.map(s => ({
      id: s.id,
      pair: s.pair,
      direction: s.direction,
      entry: parseFloat(s.entry) || 0,
      tp1: parseFloat(s.tp1) || 0,
      tp2: parseFloat(s.tp2) || 0,
      tp3: parseFloat(s.tp3) || 0,
      sl: parseFloat(s.sl) || 0,
      reason: s.reason || '',
      created_at: s.created_at
    })));
  } catch (err) {
    console.error('MT5 signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// AI evaluate endpoint — updates signal status using X-AI-Key
router.patch('/ai/evaluate', async (req, res) => {
  try {
    const apiKey = req.headers['x-ai-key'];
    const expectedKey = process.env.AI_SIGNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid AI key' });
    }
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'id and status required' });
    }
    if (!['win', 'loss'].includes(status)) {
      return res.status(400).json({ error: 'status must be win or loss' });
    }
    const result = await pool.query(
      'UPDATE signals SET status=$1 WHERE id=$2 AND status=\'active\' RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found or already evaluated' });
    console.log(`AI evaluated signal ${id}: ${status}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('AI evaluate error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { pair, direction, entry, tp1, tp2, tp3, sl, status, reason } = req.body;
    const result = await pool.query(
      'UPDATE signals SET pair=$1, direction=$2, entry=$3, tp1=$4, tp2=$5, tp3=$6, sl=$7, status=$8, reason=$9 WHERE id=$10 RETURNING *',
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '', status, reason || '', req.params.id]
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
