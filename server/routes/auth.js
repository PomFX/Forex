const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'ath-trader-secret-key-2026';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    const user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });

    const exist = await pool.query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (exist.rows.length > 0) return res.status(400).json({ error: 'อีเมลหรือชื่อผู้ใช้นี้มีอยู่แล้ว' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1,$2,$3) RETURNING id, username, email, vip_level',
      [username, email, hash]
    );
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Admin check
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@athtrader.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ id: 0, username: 'Admin', email: ADMIN_EMAIL, isAdmin: true }, JWT_SECRET);
      return res.json({ ok: true, token, user: { id: 0, username: 'Admin', email: ADMIN_EMAIL, vipLevel: 'Platinum', role: 'admin' } });
    }

    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'ไม่พบบัญชีผู้ใช้' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    const isAdmin = user.is_admin || false;
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email, isAdmin }, JWT_SECRET);
    res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, vipLevel: user.vip_level, isAdmin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;
