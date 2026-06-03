const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set');
  process.exit(1);
}

// Rate limiter for auth endpoints
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  const attempts = rateLimitMap.get(ip).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (attempts.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'ขออภัย กรุณาลองใหม่อีกครั้งในภายหลัง' });
  }
  attempts.push(now);
  rateLimitMap.set(ip, attempts);
  next();
}

setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW;
  for (const [ip, attempts] of rateLimitMap) {
    const filtered = attempts.filter(t => t > cutoff);
    if (filtered.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, filtered);
  }
}, 60000);

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

const MIN_PASSWORD_LENGTH = 8;

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย ' + MIN_PASSWORD_LENGTH + ' ตัวอักษร' });
    }

    const exist = await pool.query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (exist.rows.length > 0) return res.status(400).json({ error: 'อีเมลหรือชื่อผู้ใช้นี้มีอยู่แล้ว' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1,$2,$3) RETURNING id, username, email, vip_level',
      [username, email, hash]
    );
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.post('/login', rateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ id: 0, username: 'Admin', email: ADMIN_EMAIL, isAdmin: true }, JWT_SECRET);
      return res.json({ ok: true, token, user: { id: 0, username: 'Admin', email: ADMIN_EMAIL, vipLevel: 'Platinum', role: 'admin', isAdmin: true } });
    }

    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'ไม่พบบัญชีผู้ใช้' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    const isAdmin = user.is_admin ? true : false;
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email, isAdmin }, JWT_SECRET);
    res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, vipLevel: user.vip_level, role: isAdmin ? 'admin' : 'user', isAdmin } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;
