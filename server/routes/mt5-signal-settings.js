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
    multiEntry: {
      enabled: false,
      entry1: 1000,
      entry2: 500,
      entry3: 500,
      sl: 1000,
      tp1: 2000,
      tp2: 3000,
      tp3: 5000,
    },
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
  const rawMulti = raw.multiEntry || {};
  const multiEntry = {
    enabled: rawMulti.enabled ?? defs.multiEntry.enabled,
    entry1: Number.isFinite(Number(rawMulti.entry1)) ? Number(rawMulti.entry1) : defs.multiEntry.entry1,
    entry2: Number.isFinite(Number(rawMulti.entry2)) ? Number(rawMulti.entry2) : defs.multiEntry.entry2,
    entry3: Number.isFinite(Number(rawMulti.entry3)) ? Number(rawMulti.entry3) : defs.multiEntry.entry3,
    sl: Number.isFinite(Number(rawMulti.sl)) ? Number(rawMulti.sl) : defs.multiEntry.sl,
    tp1: Number.isFinite(Number(rawMulti.tp1)) ? Number(rawMulti.tp1) : defs.multiEntry.tp1,
    tp2: Number.isFinite(Number(rawMulti.tp2)) ? Number(rawMulti.tp2) : defs.multiEntry.tp2,
    tp3: Number.isFinite(Number(rawMulti.tp3)) ? Number(rawMulti.tp3) : defs.multiEntry.tp3,
  };

  return {
    requireApproval: raw.requireApproval ?? defs.requireApproval,
    aiAnalysis: raw.aiAnalysis ?? defs.aiAnalysis,
    minConfidence: Number.isFinite(raw.minConfidence) ? raw.minConfidence : defs.minConfidence,
    multiEntry,
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
    const { requireApproval, aiAnalysis, minConfidence, multiEntry, targets } = req.body;

    const rawMulti = multiEntry || {};
    const clampOffset = (v) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0);

    const settings = {
      requireApproval: !!requireApproval,
      aiAnalysis: !!aiAnalysis,
      minConfidence: Number.isFinite(Number(minConfidence)) ? Math.max(0, Math.min(100, Number(minConfidence))) : 60,
      multiEntry: {
        enabled: !!rawMulti.enabled,
        entry1: clampOffset(rawMulti.entry1) || defaultSettings().multiEntry.entry1,
        entry2: clampOffset(rawMulti.entry2) || defaultSettings().multiEntry.entry2,
        entry3: clampOffset(rawMulti.entry3) || defaultSettings().multiEntry.entry3,
        sl: clampOffset(rawMulti.sl) || defaultSettings().multiEntry.sl,
        tp1: clampOffset(rawMulti.tp1) || defaultSettings().multiEntry.tp1,
        tp2: clampOffset(rawMulti.tp2) || defaultSettings().multiEntry.tp2,
        tp3: clampOffset(rawMulti.tp3) || defaultSettings().multiEntry.tp3,
      },
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

router.get('/usage', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalResult = await pool.query("SELECT COUNT(*) FROM line_logs");
    const total = parseInt(totalResult.rows[0].count);

    const monthResult = await pool.query(
      "SELECT COUNT(*) FROM line_logs WHERE sent_at >= DATE_TRUNC('month', NOW())"
    );
    const thisMonth = parseInt(monthResult.rows[0].count);

    const dayResult = await pool.query(
      "SELECT DATE(sent_at) as day, COUNT(*) as count FROM line_logs WHERE sent_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(sent_at) ORDER BY day DESC"
    );

    const duplicateResult = await pool.query(
      `SELECT signal_id, target_id, COUNT(*) as count
       FROM line_logs
       WHERE signal_id IS NOT NULL AND signal_id != ''
       GROUP BY signal_id, target_id
       HAVING COUNT(*) > 1
       ORDER BY count DESC
       LIMIT 20`
    );

    const statusResult = await pool.query(
      "SELECT status, COUNT(*) as count FROM line_logs GROUP BY status"
    );

    const sourceResult = await pool.query(
      `SELECT
         CASE WHEN signal_id = 'TEST' THEN 'test' ELSE 'signal' END as source,
         COUNT(*) as count
       FROM line_logs
       GROUP BY CASE WHEN signal_id = 'TEST' THEN 'test' ELSE 'signal' END`
    );

    res.json({
      total,
      thisMonth,
      perDay: dayResult.rows,
      duplicates: duplicateResult.rows,
      byStatus: statusResult.rows,
      bySource: sourceResult.rows,
    });
  } catch (err) {
    console.error('Get LINE usage error:', err.message);
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
      entry2: '3328.33',
      entry3: '3323.33',
      tp1: '3338.33',
      tp2: '3343.33',
      tp3: '3353.33',
      sl: '3318.33',
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