const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brokers');
    res.json(result.rows);
  } catch (err) {
    console.error('Get brokers error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, ibLink, logo, rating } = req.body;
    const result = await pool.query(
      'INSERT INTO brokers (name, description, ib_link, logo, rating) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, description || '', ibLink || '', logo || '', rating || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add broker error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, ibLink, logo, rating } = req.body;
    const result = await pool.query(
      'UPDATE brokers SET name=$1, description=$2, ib_link=$3, logo=$4, rating=$5 WHERE id=$6 RETURNING *',
      [name, description, ibLink, logo || '', rating, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update broker error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM brokers WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete broker error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
