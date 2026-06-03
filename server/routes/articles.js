const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM articles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get articles error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, image } = req.body;
    const result = await pool.query(
      'INSERT INTO articles (title, content, image) VALUES ($1,$2,$3) RETURNING *',
      [title, content, image || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add article error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, image } = req.body;
    const result = await pool.query(
      'UPDATE articles SET title=$1, content=$2, image=$3 WHERE id=$4 RETURNING *',
      [title, content, image || '', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update article error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM articles WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete article error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
