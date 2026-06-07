const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const CONFIG_KEY = 'ea_config';

const DEFAULT_CONFIG = {
  enabled: true,
  lotSize: 0.01,
  tpMode: 1,
  allowedPairs: [],
};

const ALL_PAIRS = [
  'XAU/USD', 'XAG/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
  'AUD/USD', 'NZD/USD', 'USD/CAD', 'BTC/USD', 'ETH/USD', 'XRP/USD',
];

async function getConfig() {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key=$1", [CONFIG_KEY]);
    if (result.rows.length === 0) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    return { ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), ...JSON.parse(result.rows[0].value) };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

async function saveConfig(data) {
  await pool.query(
    "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2",
    [CONFIG_KEY, JSON.stringify(data)]
  );
}

// Admin: get config
router.get('/config', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ ...config, allPairs: ALL_PAIRS });
  } catch (err) {
    console.error('Get EA config error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Admin: save config
router.put('/config', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = req.body;
    await saveConfig(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save EA config error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// MT5: get allowed pairs (authenticated via MT5-Key)
router.get('/allowed-pairs', async (req, res) => {
  try {
    const apiKey = req.headers['x-mt5-key'];
    const expectedKey = process.env.MT5_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid MT5 key' });
    }
    const config = await getConfig();
    res.json({
      enabled: config.enabled,
      allowedPairs: config.allowedPairs,
      lotSize: config.lotSize,
      tpMode: config.tpMode,
    });
  } catch (err) {
    console.error('MT5 allowed-pairs error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// MT5: heartbeat — EA sends status log
router.get('/heartbeat', async (req, res) => {
  try {
    const apiKey = req.headers['x-mt5-key'];
    const expectedKey = process.env.MT5_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid MT5 key' });
    }
    const { status, uptime, signalsProcessed, error } = req.query;
    await pool.query(
      "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2",
      ['ea_heartbeat', JSON.stringify({ status, uptime, signalsProcessed, error, lastSeen: new Date().toISOString() })]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('EA heartbeat error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Admin: get EA logs (from heartbeat + activity)
router.get('/logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const heartbeat = await pool.query("SELECT value FROM site_settings WHERE key='ea_heartbeat'");
    const logs = heartbeat.rows.length > 0 ? JSON.parse(heartbeat.rows[0].value) : null;
    res.json({ logs });
  } catch (err) {
    console.error('Get EA logs error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Admin: clear EA logs
router.delete('/logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM site_settings WHERE key='ea_heartbeat'");
    res.json({ ok: true });
  } catch (err) {
    console.error('Clear EA logs error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
