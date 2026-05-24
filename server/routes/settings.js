const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

// Get contact settings (public)
router.get('/contact', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key='contact'");
    if (result.rows.length === 0) return res.json({});
    res.json(JSON.parse(result.rows[0].value));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update contact settings (admin)
router.put('/contact', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { line_id, phone, email, qr_code, facebook, website, tiktok, youtube, openchat, openchat_qr } = req.body;
    const data = JSON.stringify({ line_id: line_id || '', phone: phone || '', email: email || '', qr_code: qr_code || '', facebook: facebook || '', website: website || '', tiktok: tiktok || '', youtube: youtube || '', openchat: openchat || '', openchat_qr: openchat_qr || '' });
    await pool.query("UPDATE site_settings SET value=$1 WHERE key='contact'", [data]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
