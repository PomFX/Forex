const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, vip_level, is_admin, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/:id/vip', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { vipLevel } = req.body;
    const result = await pool.query(
      'UPDATE users SET vip_level=$1 WHERE id=$2 RETURNING id, username, email, vip_level',
      [vipLevel, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update VIP error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/:id/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { isAdmin } = req.body;
    const val = isAdmin ? 1 : 0;
    const result = await pool.query(
      'UPDATE users SET is_admin=$1 WHERE id=$2 RETURNING id, username, email, is_admin',
      [val, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update admin status error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
