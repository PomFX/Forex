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
    console.error('Get contact error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// Update contact settings (admin)
router.put('/contact', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { line_id, phone, email, qr_code, facebook, website, tiktok, youtube, openchat, openchat_qr, tiktok_qr } = req.body;
    const data = JSON.stringify({ line_id: line_id || '', phone: phone || '', email: email || '', qr_code: qr_code || '', facebook: facebook || '', website: website || '', tiktok: tiktok || '', youtube: youtube || '', openchat: openchat || '', openchat_qr: openchat_qr || '', tiktok_qr: tiktok_qr || '' });
    await pool.query("UPDATE site_settings SET value=$1 WHERE key='contact'", [data]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Update contact error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// Banner settings
async function getBannerFromDB(key) {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key=$1", [key]);
    if (result.rows.length === 0) return { html: '', enabled: false };
    return JSON.parse(result.rows[0].value);
  } catch { return { html: '', enabled: false }; }
}

async function saveBannerToDB(key, data) {
  await pool.query("INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2", [key, JSON.stringify(data)]);
}

router.get('/banner', async (req, res) => {
  try {
    const side = ['left', 'right', 'middle'].includes(req.query.side) ? req.query.side : 'right';
    const data = await getBannerFromDB('banner_' + side);
    res.json(data);
  } catch (err) {
    console.error('Get banner error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/banner', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const side = ['left', 'right', 'middle'].includes(req.query.side) ? req.query.side : 'right';
    const { html, enabled } = req.body;
    await saveBannerToDB('banner_' + side, { html: html || '', enabled: !!enabled });
    res.json({ ok: true });
  } catch (err) {
    console.error('Update banner error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
