const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');
const { sendSignalMessageAI } = require('../../scripts/line');
const { getSettings: getMt5Settings } = require('./mt5-signal-settings');
const OpenAI = require('openai');
const router = express.Router();

function parsePrice(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  const cleaned = String(v).replace(/[^0-9.]/g, '');
  return cleaned || '';
}

function getPointForPair(pair) {
  const p = String(pair || '').toUpperCase();
  if (p.includes('XAU') || p.includes('GOLD') || p.includes('XAG') || p.includes('SILV') ||
      p.includes('XPT') || p.includes('XPD') || p.includes('BTC') || p.includes('ETH')) {
    return 0.01;
  }
  if (p.includes('JPY')) return 0.001;
  return 0.0001;
}

function fmtPrice(v) {
  if (!isFinite(v)) return '';
  const s = v.toFixed(5);
  return s.replace(/\.?0+$/, '');
}

async function analyzeSignalWithAI(signalData) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `คุณเป็นนักวิเคราะห์สัญญาณ Forex มืออาชีพ จงประเมินสัญญาณต่อไปนี้และตอบกลับเป็น JSON เท่านั้น

สัญญาณ:
- คู่เงิน: ${signalData.pair}
- ทิศทาง: ${signalData.direction}
- Entry: ${signalData.entry}
- SL: ${signalData.sl}
- TP1: ${signalData.tp1}
- TP2: ${signalData.tp2}
- TP3: ${signalData.tp3}
- เหตุผล: ${(signalData.reason || '').replace(/\n/g, ' ')}

ให้คำนวณ:
1. Risk:Reward ที่ดีที่สุด (จาก Entry ถึง TP3 เทียบ SL)
2. ความมั่นใจ (confidence) 0-100 จากตำแหน่ง Entry/SL/TP และโครงสร้าง BOS/OB
3. สรุปจุดเด่น/จุดเสี่ยงของ setup นี้สั้น ๆ ภาษาไทย

ตอบกลับ JSON ตัวอย่าง:
{
  "riskReward": "1:5.2",
  "confidence": 78,
  "summary": "BUY LIMIT ที่ OB low มี RR สูง แต่ SL ใกล้ entry ควรระวัง fake breakout"
}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
    });

    const text = completion.choices[0].message.content.trim()
      .replace(/^```json\s*/, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();

    return JSON.parse(text);
  } catch (err) {
    console.error('AI signal analysis error:', err.message);
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM signals ORDER BY CASE WHEN pair='XAU/USD' THEN 0 ELSE 1 END, created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error('Get signals error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { pair, direction, entry, tp1, tp2, tp3, sl, status, reason } = req.body;
    const result = await pool.query(
      'INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '', status || 'active', reason || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// AI signal endpoint (authenticated via API key, no JWT needed)
router.post('/ai', async (req, res) => {
  try {
    const apiKey = req.headers['x-ai-key'];
    const expectedKey = process.env.AI_SIGNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid AI key' });
    }
    const { pair, direction, entry, tp1, tp2, tp3, sl, reason } = req.body;
    if (!pair || !direction) {
      return res.status(400).json({ error: 'pair and direction required' });
    }
    const result = await pool.query(
      "INSERT INTO signals (pair, direction, entry, tp1, tp2, tp3, sl, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) RETURNING *",
      [pair, direction, parsePrice(entry), parsePrice(tp1), parsePrice(tp2), parsePrice(tp3), parsePrice(sl), reason || '']
    );
    console.log(`AI signal saved: ${pair} ${direction}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('AI signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// MT5 endpoint — returns all active signals for EA (multi-symbol)
router.get('/mt5', async (req, res) => {
  try {
    const apiKey = req.headers['x-mt5-key'];
    const expectedKey = process.env.MT5_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid MT5 key' });
    }
    const result = await pool.query(
      "SELECT id, pair, direction, entry, entry2, entry3, tp1, tp2, tp3, sl, reason, created_at FROM signals WHERE status='active' ORDER BY created_at DESC"
    );
    res.json(result.rows.map(s => ({
      id: s.id,
      pair: s.pair,
      direction: s.direction,
      entry: parseFloat(s.entry) || 0,
      entry2: parseFloat(s.entry2) || 0,
      entry3: parseFloat(s.entry3) || 0,
      tp1: parseFloat(s.tp1) || 0,
      tp2: parseFloat(s.tp2) || 0,
      tp3: parseFloat(s.tp3) || 0,
      sl: parseFloat(s.sl) || 0,
      reason: s.reason || '',
      created_at: s.created_at
    })));
  } catch (err) {
    console.error('MT5 signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// AI evaluate endpoint — updates signal status using X-AI-Key
router.patch('/ai/evaluate', async (req, res) => {
  try {
    const apiKey = req.headers['x-ai-key'];
    const expectedKey = process.env.AI_SIGNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid AI key' });
    }
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'id and status required' });
    }
    if (!['win', 'loss'].includes(status)) {
      return res.status(400).json({ error: 'status must be win or loss' });
    }
    const result = await pool.query(
      'UPDATE signals SET status=$1 WHERE id=$2 AND status=\'active\' RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found or already evaluated' });
    console.log(`AI evaluated signal ${id}: ${status}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('AI evaluate error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { pair, direction, entry, tp1, tp2, tp3, sl, status, reason } = req.body;
    const result = await pool.query(
      'UPDATE signals SET pair=$1, direction=$2, entry=$3, tp1=$4, tp2=$5, tp3=$6, sl=$7, status=$8, reason=$9 WHERE id=$10 RETURNING *',
      [pair, direction, entry || '', tp1 || '', tp2 || '', tp3 || '', sl || '', status, reason || '', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM signals WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

//+------------------------------------------------------------------+
//| MT5 BOS/CHoCH Bridge endpoint (X-Fusion / LuxAlgo SMC)           |
//| Receives raw BOS data from MT5, converts to LIMIT signal,        |
//| saves to DB, and returns hasSetup so EA knows it was processed.  |
//+------------------------------------------------------------------+
router.post('/mt5/bos-candidate', async (req, res) => {
  try {
    const apiKey = req.headers['x-mt5-key'];
    const expectedKey = process.env.MT5_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(403).json({ hasSetup: false, error: 'Invalid MT5 key' });
    }

    const {
      pair,
      bosType,
      signalLabel,
      timeframe,
      bosPrice,
      obHigh,
      obLow,
      prevSwing,
      currentPrice,
    } = req.body;

    if (!pair || !bosType || !obHigh || !obLow) {
      return res.status(400).json({ hasSetup: false, error: 'pair, bosType, obHigh, obLow required' });
    }

    const isBullish = (String(bosType).toLowerCase() === 'bullish');
    const direction = isBullish ? 'BUY' : 'SELL';

    // Parse numeric values
    const fEntry    = parseFloat(isBullish ? obLow  : obHigh);
    const fObHigh   = parseFloat(obHigh);
    const fObLow    = parseFloat(obLow);
    const fBosPrice = parseFloat(bosPrice || (isBullish ? fObHigh : fObLow));
    const fPrevSwing= parseFloat(prevSwing || fBosPrice);
    const fCurrent  = parseFloat(currentPrice || fEntry);

    if (!fEntry || !fObHigh || !fObLow) {
      return res.status(400).json({ hasSetup: false, error: 'invalid price values' });
    }

    const settings = await getMt5Settings();
    const multi = settings.multiEntry || {};
    const multiEnabled = !!multi.enabled;

    let fEntry1 = fEntry;
    let fEntry2 = null;
    let fEntry3 = null;
    let sl, tp1, tp2, tp3;

    if (multiEnabled && fCurrent) {
      const pointSize = parseFloat(req.body.point) || getPointForPair(pair);
      const e1Off = Number(multi.entry1) || 1000;
      const e2Off = Number(multi.entry2) || 500;
      const e3Off = Number(multi.entry3) || 500;
      const slOff = Number(multi.sl) || 1000;
      const tp1Off = Number(multi.tp1) || 2000;
      const tp2Off = Number(multi.tp2) || 3000;
      const tp3Off = Number(multi.tp3) || 5000;

      if (isBullish) {
        fEntry1 = fCurrent - e1Off * pointSize;
        fEntry2 = fEntry1 - e2Off * pointSize;
        fEntry3 = fEntry2 - e3Off * pointSize;
        sl      = fEntry3 - slOff * pointSize;
        tp1     = fEntry1 + tp1Off * pointSize;
        tp2     = fEntry1 + tp2Off * pointSize;
        tp3     = fEntry1 + tp3Off * pointSize;
      } else {
        fEntry1 = fCurrent + e1Off * pointSize;
        fEntry2 = fEntry1 + e2Off * pointSize;
        fEntry3 = fEntry2 + e3Off * pointSize;
        sl      = fEntry3 + slOff * pointSize;
        tp1     = fEntry1 - tp1Off * pointSize;
        tp2     = fEntry1 - tp2Off * pointSize;
        tp3     = fEntry1 - tp3Off * pointSize;
      }
    } else {
      // OB height used as a volatility/protection buffer
      const obHeight = Math.abs(fObHigh - fObLow);
      const buffer   = Math.max(obHeight * 0.10, fEntry * 0.0001); // min 0.01%

      if (isBullish) {
        sl  = fObLow  - buffer;
        const risk = Math.abs(fEntry - sl);
        tp1 = fEntry + risk * 2;
        tp2 = fEntry + risk * 3;
        tp3 = fEntry + risk * 5;
      } else {
        sl  = fObHigh + buffer;
        const risk = Math.abs(sl - fEntry);
        tp1 = fEntry - risk * 2;
        tp2 = fEntry - risk * 3;
        tp3 = fEntry - risk * 5;
      }
    }

    const fmt = fmtPrice;

    let reasonLines = [
      `LuxAlgo SMC — ${signalLabel || 'BOS/CHoCH'} (${timeframe || 'M15'})`,
      `BOS price: ${fmt(fBosPrice)} | Current: ${fmt(fCurrent)} | PrevSwing: ${fmt(fPrevSwing)}`,
    ];

    if (multiEnabled) {
      reasonLines.push(`Multi-Entry: E1=${fmt(fEntry1)} / E2=${fmt(fEntry2)} / E3=${fmt(fEntry3)} | SL=${fmt(sl)} | R:R based TP1-3`);
    } else {
      reasonLines.push(`Order Block: ${fmt(fObLow)} - ${fmt(fObHigh)} | LIMIT @ ${fmt(fEntry1)} | R:R 1:2/1:3/1:5`);
    }

    // AI advanced analysis (R:R, confidence)
    let aiAnalysis = null;
    if (settings.aiAnalysis) {
      aiAnalysis = await analyzeSignalWithAI({
        pair, direction, entry: fmt(fEntry1), sl: fmt(sl), tp1: fmt(tp1), tp2: fmt(tp2), tp3: fmt(tp3),
        reason: reasonLines.join('\n'),
      });
      if (aiAnalysis) {
        const confidenceNum = Number(aiAnalysis.confidence) || 0;
        if (confidenceNum < settings.minConfidence) {
          console.log(`[MT5 Bridge] AI rejected ${pair} ${direction}: confidence ${confidenceNum}% < ${settings.minConfidence}%`);
          return res.json({
            hasSetup: false,
            rejected: true,
            reason: `AI confidence ${confidenceNum}% ต่ำกว่าเกณฑ์ ${settings.minConfidence}%`,
            aiAnalysis,
          });
        }
        reasonLines.push('');
        reasonLines.push(`AI Analysis — Confidence: ${confidenceNum}% | R:R: ${aiAnalysis.riskReward}`);
        reasonLines.push(aiAnalysis.summary);
      }
    }

    const reason = reasonLines.join('\n');
    const status = settings.requireApproval ? 'pending' : 'active';

    const result = await pool.query(
      `INSERT INTO signals
         (pair, direction, entry, entry2, entry3, tp1, tp2, tp3, sl, status, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [pair, direction, fmt(fEntry1), fmt(fEntry2), fmt(fEntry3), fmt(tp1), fmt(tp2), fmt(tp3), fmt(sl), status, reason]
    );

    const signal = result.rows[0];
    console.log(`[MT5 Bridge] ${signalLabel || 'BOS'} ${direction} ${pair} @ ${signal.entry}${multiEnabled ? '/' + signal.entry2 + '/' + signal.entry3 : ''} (SL ${signal.sl}) [status=${status}]`);

    // ส่ง LINE ถ้าไม่ต้องการ Admin approval และมีเป้าหมายที่เปิดใช้งาน
    let lineSent = false;
    if (status === 'active') {
      const enabledTargets = (settings.targets || []).filter(t => t.enabled && t.id);
      if (enabledTargets.length > 0) {
        try {
        lineSent = await sendSignalMessageAI(signal, 'created', enabledTargets, true);
        } catch (lineErr) {
          console.error('[MT5 Bridge] LINE send error:', lineErr.message);
        }
      } else {
        console.warn('[MT5 Bridge] No enabled LINE targets');
      }
    }

    res.json({
      hasSetup: true,
      signalId: signal.id,
      pair: signal.pair,
      direction: signal.direction,
      entry: signal.entry,
      entry2: signal.entry2,
      entry3: signal.entry3,
      sl: signal.sl,
      tp1: signal.tp1,
      tp2: signal.tp2,
      tp3: signal.tp3,
      reason: signal.reason,
      status: signal.status,
      pendingApproval: status === 'pending',
      aiAnalysis,
      lineSent,
    });
  } catch (err) {
    console.error('MT5 BOS candidate error:', err.message);
    res.status(500).json({ hasSetup: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

//+------------------------------------------------------------------+
//| Approve a pending MT5 signal and send LINE notification          |
//+------------------------------------------------------------------+
router.post('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE signals SET status='active' WHERE id=$1 AND status='pending' RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signal not found or not pending' });
    }
    const signal = result.rows[0];

    const settings = await getMt5Settings();
    const enabledTargets = (settings.targets || []).filter(t => t.enabled && t.id);
    let lineSent = false;
    if (enabledTargets.length > 0) {
      try {
        lineSent = await sendSignalMessageAI(signal, 'created', enabledTargets, true);
      } catch (lineErr) {
        console.error('[Approve] LINE send error:', lineErr.message);
      }
    }

    res.json({ ok: true, signal, lineSent });
  } catch (err) {
    console.error('Approve signal error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
