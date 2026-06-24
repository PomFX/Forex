const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const { sendSignalMessageAI } = require('../../scripts/line');
const router = express.Router();

const SETTINGS_KEY = 'mt5_signal_settings';

function defaultSettings() {
  return {
    requireApproval: false,
    aiAnalysis: false,
    minConfidence: 60,
    targets: [
      {
        name: 'กลุ่มหลัก',
        type: 'group',
        plan: 'full',
        id: process.env.LINE_GROUP_ID || '',
        enabled: !!process.env.LINE_GROUP_ID,
      },
    ],
  };
}

async function getSettingsRaw() {
  const result = await pool.query('SELECT value FROM site_settings WHERE key=$1', [SETTINGS_KEY]);
  if (result.rows.length === 0) return null;
  try {
    return JSON.parse(result.rows[0].value);
  } catch {
    return null;
  }
}

async function getSettings() {
  const raw = await getSettingsRaw();
  if (!raw) return defaultSettings();
  const defs = defaultSettings();
  return {
    requireApproval: raw.requireApproval ?? defs.requireApproval,
    aiAnalysis: raw.aiAnalysis ?? defs.aiAnalysis,
    minConfidence: Number.isFinite(raw.minConfidence) ? raw.minConfidence : defs.minConfidence,
    targets: Array.isArray(raw.targets) && raw.targets.length > 0
      ? raw.targets.map(t => ({ ...t, plan: t.plan === 'basic' ? 'basic' : 'full', enabled: t.enabled !== false }))
      : defs.targets,
  };
}

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    console.error('Get MT5 signal settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { requireApproval, aiAnalysis, minConfidence, targets } = req.body;
    const settings = {
      requireApproval: !!requireApproval,
      aiAnalysis: !!aiAnalysis,
      minConfidence: Number.isFinite(Number(minConfidence)) ? Math.max(0, Math.min(100, Number(minConfidence))) : 60,
      targets: Array.isArray(targets)
        ? targets
            .filter(t => t.id && String(t.id).trim() !== '')
            .map(t => ({
              name: String(t.name || '').trim() || 'ไม่มีชื่อ',
              type: t.type === 'user' ? 'user' : 'group',
              plan: t.plan === 'basic' ? 'basic' : 'full',
              id: String(t.id).trim(),
              enabled: t.enabled !== false,
            }))
        : defaultSettings().targets,
    };

    await pool.query(
      'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2',
      [SETTINGS_KEY, JSON.stringify(settings)]
    );

    res.json(settings);
  } catch (err) {
    console.error('Save MT5 signal settings error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.get('/logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      'SELECT * FROM line_logs ORDER BY sent_at DESC LIMIT $1',
      [limit]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Get LINE logs error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.post('/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSettings();
    const enabledTargets = (settings.targets || []).filter(t => t.enabled && t.id);
    if (enabledTargets.length === 0) {
      return res.status(400).json({ error: 'ไม่มีเป้าหมาย LINE ที่เปิดใช้งาน' });
    }

    const testSignal = {
      id: 'TEST',
      pair: 'XAU/USD',
      direction: 'BUY',
      entry: '3333.33',
      tp1: '3334.33',
      tp2: '3335.33',
      tp3: '3336.33',
      sl: '3332.33',
      reason: 'ทดสอบการส่งข้อความจาก MT5 Signal Settings',
    };

    const lineSent = await sendSignalMessageAI(testSignal, 'created', enabledTargets, true);
    res.json({ ok: true, lineSent, targets: enabledTargets.map(t => ({ name: t.name, id: t.id, plan: t.plan })) });
  } catch (err) {
    console.error('MT5 signal test error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
module.exports.getSettings = getSettings;
module.exports.defaultSettings = defaultSettings;