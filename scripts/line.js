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

  return `${emoji} ATH Trader — ${statusText}

${dirEmoji} ${s.pair}
📍 ${s.direction}
💰 Entry: ${s.entry}
🎯 TP1: ${s.tp1}${s.tp2 ? ` / TP2: ${s.tp2}` : ''}${s.tp3 ? ` / TP3: ${s.tp3}` : ''}
🛑 SL: ${s.sl || '-'}

⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}`;
}

async function sendSignalMessage(s, action) {
  if (!TOKEN || !TARGET) {
    console.warn('LINE notify: TOKEN or TARGET not set');
    return;
  }
  if (s.pair !== 'XAU/USD') return;

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

module.exports = { sendSignalMessage };
