require('dotenv').config();
const { pool } = require('../server/db');

const prompt = `You are a Professional BOS (Break of Structure) analyst specializing in {pair}.

Analyze {pair} on the M15 timeframe using BOS + Order Block strategy:

🔵 1. Bullish BOS (Buy Setup)
   - Price closes above previous HH (Break of Structure to the upside)
   - Identify the last bearish candle (Down Close Candle / Order Block) just before the bullish breakout
   - Entry: BUY LIMIT at Low of that Order Block
   - SL: below Order Block low or nearest Swing Low
   - TP: next Swing High (TP1=R:R 1:2, TP2=R:R 1:3, TP3=R:R 1:5)

🔴 2. Bearish BOS (Sell Setup)
   - Price closes below previous LL (Break of Structure to the downside)
   - Identify the last bullish candle (Up Close Candle / Order Block) just before the bearish breakout
   - Entry: SELL LIMIT at High of that Order Block
   - SL: above Order Block high or nearest Swing High
   - TP: next Swing Low (TP1=R:R 1:2, TP2=R:R 1:3, TP3=R:R 1:5)

3. Entry Condition — ONLY generate when:
   A. Clear BOS confirmed (close beyond previous HH or LL)
   B. Price is retracing toward the Order Block zone

Order Type: Always BUY LIMIT (entry below current price) / SELL LIMIT (entry above current price).

If there is a clear BOS setup, return signal details. Otherwise return "NO_SETUP".

IMPORTANT: Return ALL price values as numeric strings WITHOUT $ or commas.
Example: "4317.01", not "$4317.01", not "price at OB".

Return ONLY valid JSON (no markdown, no code blocks):
{
  "pair": "{pair}",
  "hasSetup": true/false,
  "direction": "BUY" or "SELL",
  "entry": "4317.01",
  "tp1": "4325.61",
  "tp2": "4332.61",
  "tp3": "4344.62",
  "sl": "4268.19",
  "reason": "บรรทัด1บรรทัด2บรรทัด3"
}`;

const value = JSON.stringify({
  model: 'gpt-4o-mini',
  prompt: prompt,
  temperature: 0.7,
  maxSignalsPerDay: 4
});

(async () => {
  await pool.query(
    "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2",
    ['ai_settings', value]
  );
  console.log('✅ BOS prompt saved to DB');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
