require('dotenv').config();
const OpenAI = require('openai');

const LINE_API = 'https://api.line.me/v2/bot/message/push';

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const TARGET = process.env.LINE_GROUP_ID || process.env.LINE_USER_ID;

function formatSignalText(s, action) {
  const emoji = action === 'created' ? '🆕' : action === 'win' ? '✅' : action === 'loss' ? '❌' : '🔔';
  const dirEmoji = s.direction === 'BUY' ? '🟢' : '🔴';
  const statusText = action === 'created' ? 'สัญญาณใหม่'
    : action === 'win' ? 'ถึง TP แล้ว ✅'
    : action === 'loss' ? 'ตัดขาดทุน ❌'
    : 'อัปเดต';

  const entryLines = s.entry2 && s.entry3
    ? `💰 Entry 1: ${s.entry}\n💰 Entry 2: ${s.entry2}\n💰 Entry 3: ${s.entry3}`
    : `💰 Entry: ${s.entry}`;

  return `${emoji} ATH Trader — ${statusText}

${dirEmoji} ${s.pair}
📍 ${s.direction}
${entryLines}
🎯 TP1: ${s.tp1}${s.tp2 ? ` / TP2: ${s.tp2}` : ''}${s.tp3 ? ` / TP3: ${s.tp3}` : ''}
🛑 SL: ${s.sl || '-'}

⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}`;
}

async function sendSignalMessage(s, action) {
  if (!TOKEN || !TARGET) {
    console.warn('LINE notify: TOKEN or TARGET not set');
    return;
  }

  try {
    const res = await fetch(LINE_API, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: TARGET,
        messages: [{ type: 'text', text: formatSignalText(s, action) }],
      }),
    });
    if (res.ok) {
      console.log('LINE: sent ' + action + ' for ' + s.pair + ' #' + s.id);
    } else {
      const err = await res.text();
      console.error('LINE error:', res.status, err);
    }
  } catch (err) {
    console.error('LINE API error:', err.message);
  }
}

async function sendBOSLevelsMessage(results) {
  if (!TOKEN || !TARGET) return;
  if (!Array.isArray(results) || results.length === 0) return;

  const hasAnySignal = results.some(r => r.hasSignal);
  const lines = [];

  if (hasAnySignal) {
    lines.push('🆕 ATH Trader — มีสัญญาณใหม่');
  } else {
    lines.push('⏳ ATH Trader — ไม่มีสัญญาณขณะนี้');
  }
  lines.push('');

  for (const r of results) {
    const pair = r.pair || '?';
    const price = r.currentPrice || 'N/A';
    if (r.hasSignal) {
      lines.push('✅ ' + pair + ' @' + price + ' — มีสัญญาณ');
    } else {
      lines.push('📊 ' + pair + ' @' + price);
      if (r.swingHigh) lines.push('   🟢 BOS เหนือ ' + r.swingHigh);
      if (r.swingLow)  lines.push('   🔴 BOS ต่ำกว่า ' + r.swingLow);
    }
    lines.push('********************************');
  }

  lines.push('');
  lines.push('⏰ ' + new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }));

  try {
    const res = await fetch(LINE_API, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: TARGET,
        messages: [{ type: 'text', text: lines.join('\n') }],
      }),
    });
    if (res.ok) {
      console.log('LINE: sent BOS levels (' + results.length + ' pairs)');
    } else {
      const err = await res.text();
      console.error('LINE BOS levels error:', res.status, err);
    }
  } catch (err) {
    console.error('LINE BOS levels API error:', err.message);
  }
}

//+------------------------------------------------------------------+
//| AI-powered LINE message generator                                 |
//| Reads signal values and lets AI craft a concise Thai message.     |
//+------------------------------------------------------------------+
function buildSignalPrompt(s, action, detailLevel = 'full') {
  const actionText = action === 'created' ? 'สัญญาณใหม่'
    : action === 'win' ? 'ถึงเป้า TP แล้ว'
    : action === 'loss' ? 'ตัดขาดทุน SL'
    : 'อัปเดตสัญญาณ';

  const isBasic = detailLevel === 'basic';
  const entryInfo = s.entry2 && s.entry3
    ? `- ราคาเข้า (Entry): ${s.entry || '-'} / Entry 2: ${s.entry2 || '-'} / Entry 3: ${s.entry3 || '-'}`
    : `- ราคาเข้า (Entry): ${s.entry || '-'}`;
  const tpInfo = isBasic
    ? `- TP1: ${s.tp1 || '-'}`
    : `- TP1: ${s.tp1 || '-'} / TP2: ${s.tp2 || '-'} / TP3: ${s.tp3 || '-'}`;
  const extraNote = isBasic
    ? 'นี่คือข้อความแบบสั้น (Basic Plan): ให้แสดงเฉพาะ TP1 เท่านั้น ไม่ต้องพูดถึง TP2/TP3'
    : 'นี่คือข้อความแบบเต็ม (Full Plan): ให้แสดง TP1/TP2/TP3 ครบถ้วน';

  return `คุณเป็นนักวิเคราะห์ Forex มืออาชีพของ ATH Trader กำลังส่งแจ้งเตือนสัญญาณเทรดไปยังกลุ่ม LINE ของสมาชิก

ข้อมูลสัญญาณ:
- สถานะ: ${actionText}
- คู่เงิน: ${s.pair}
- ทิศทาง: ${s.direction}
${entryInfo}
${tpInfo}
- SL: ${s.sl || '-'}
- เหตุผล/บริบท: ${(s.reason || '-').replace(/\n/g, ' ')}
- เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}

${extraNote}

กรุณาเขียนข้อความแจ้งเตือนภาษาไทย กระชับ มืออาชีพ ไม่เกิน 15 บรรทัด ใช้อิโมจิช่วยให้อ่านง่าย
ให้เน้นข้อมูล Entry, SL, TP และแนวโน้มของสัญญาณ ไม่ต้องมีคำทักทายหรือลงท้ายเกินจำเป็น

ตอบกลับเป็นข้อความล้วน ไม่ต้องใส่ markdown หรือ code block`;
}

async function logLineNotification({ signalId, targetId, targetName, plan, status, response }) {
  try {
    const { pool } = require('../server/db');
    if (!pool) return;
    await pool.query(
      `INSERT INTO line_logs (signal_id, target_id, target_name, plan, status, response)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [signalId, targetId, targetName || '', plan || 'full', status, response || '']
    );
  } catch (err) {
    // Fail silently — logging should never break LINE delivery
    console.error('LINE log error:', err.message);
  }
}

async function generateAIMessage(s, action, detailLevel = 'full') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set — falling back to default message');
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildSignalPrompt(s, action, detailLevel) }],
      temperature: 0.6,
      max_tokens: 400,
    });

    const text = completion.choices[0].message.content.trim();
    return text.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
  } catch (err) {
    console.error('AI message generation error:', err.message);
    return null;
  }
}

async function sendSignalMessageToTargets(s, action, targets, logToDb = false) {
  // Group targets by plan so we generate one AI message per detail level
  const planBuckets = {};
  for (const t of targets) {
    if (!t.id || t.enabled === false) continue;
    const plan = t.plan === 'basic' ? 'basic' : 'full';
    if (!planBuckets[plan]) planBuckets[plan] = [];
    planBuckets[plan].push(t);
  }

  const results = [];
  for (const [plan, planTargets] of Object.entries(planBuckets)) {
    const text = await generateAIMessage(s, action, plan);
    const messageText = text || formatSignalText(s, action);

    for (const target of planTargets) {
      let responseText = '';
      let ok = false;
      try {
        const res = await fetch(LINE_API, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: target.id,
            messages: [{ type: 'text', text: messageText }],
          }),
        });
        responseText = res.ok ? 'OK' : await res.text();
        ok = res.ok;
        if (res.ok) {
          console.log('LINE: AI message sent ' + action + ' for ' + s.pair + ' #' + s.id + ' → ' + target.id + ' (' + plan + ')');
        } else {
          console.error('LINE AI message error:', res.status, responseText, '→', target.id);
        }
      } catch (err) {
        responseText = err.message;
        console.error('LINE AI message API error:', err.message, '→', target.id);
      }
      results.push({ id: target.id, name: target.name, plan, ok, error: ok ? '' : responseText });
      if (logToDb) {
        await logLineNotification({
          signalId: String(s.id),
          targetId: target.id,
          targetName: target.name,
          plan,
          status: ok ? 'sent' : 'failed',
          response: responseText,
        });
      }
    }
  }
  return results;
}

async function sendSignalMessageAI(s, action, targets, logToDb = false) {
  if (!TOKEN) {
    console.warn('LINE notify: TOKEN not set');
    return false;
  }

  // If explicit targets provided, send to each
  if (Array.isArray(targets) && targets.length > 0) {
    const results = await sendSignalMessageToTargets(s, action, targets, logToDb);
    return results.every(r => r.ok);
  }

  // Fallback to legacy single target
  if (!TARGET) {
    console.warn('LINE notify: TARGET not set');
    return false;
  }
  return sendSignalMessageToTargets(s, action, [{ name: 'default', type: 'group', plan: 'full', id: TARGET, enabled: true }], logToDb);
}

module.exports = { sendSignalMessage, sendBOSLevelsMessage, sendSignalMessageAI };
