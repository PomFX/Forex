const API_KEY = () => process.env.TWELVEDATA_API_KEY || '';
const BASE = 'https://api.twelvedata.com';

const PAIR_MAP = {
  'XAU/USD': 'XAU/USD',
  'XAG/USD': 'XAG/USD',
  'EUR/USD': 'EUR/USD',
  'GBP/USD': 'GBP/USD',
  'USD/JPY': 'USD/JPY',
  'USD/CHF': 'USD/CHF',
  'AUD/USD': 'AUD/USD',
  'NZD/USD': 'NZD/USD',
  'USD/CAD': 'USD/CAD',
  'BTC/USD': 'BTC/USD',
  'ETH/USD': 'ETH/USD',
  'XRP/USD': 'XRP/USD',
};

async function fetchOHLC(pair, interval = '15min', outputsize = 40) {
  const symbol = PAIR_MAP[pair];
  if (!symbol) return null;
  const key = API_KEY();
  if (!key) return null;

  const url = `${BASE}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${key}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status === 'error') {
    console.error(`TwelveData error for ${pair}:`, data.message);
    return null;
  }

  const values = data.values;
  if (!values || !Array.isArray(values)) return null;

  return values.map(v => ({
    datetime: v.datetime,
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseInt(v.volume || 0),
  }));
}

function findPivotHighs(candles, left = 2, right = 2) {
  const pivots = [];
  for (let i = left; i < candles.length - right; i++) {
    let isPivot = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) { isPivot = false; break; }
    }
    if (isPivot) pivots.push({ index: i, price: candles[i].high, time: candles[i].datetime, type: 'high' });
  }
  return pivots;
}

function findPivotLows(candles, left = 2, right = 2) {
  const pivots = [];
  for (let i = left; i < candles.length - right; i++) {
    let isPivot = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].low <= candles[i].low) { isPivot = false; break; }
    }
    if (isPivot) pivots.push({ index: i, price: candles[i].low, time: candles[i].datetime, type: 'low' });
  }
  return pivots;
}

function detectStructure(candles, pivotHighs, pivotLows) {
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;

  const recentHighs = pivotHighs.filter(p => p.index >= candles.length - 10).map(p => p.price);
  const recentLows = pivotLows.filter(p => p.index >= candles.length - 10).map(p => p.price);

  const prevHH = recentHighs.length >= 2 ? recentHighs[recentHighs.length - 2] : null;
  const prevLL = recentLows.length >= 2 ? recentLows[recentLows.length - 2] : null;
  const lastHH = recentHighs.length > 0 ? recentHighs[recentHighs.length - 1] : null;
  const lastLL = recentLows.length > 0 ? recentLows[recentLows.length - 1] : null;

  let trend = 'neutral';
  let bosDetected = null;

  if (prevHH && lastHH && last.close > lastHH && last.close > prevHH) {
    trend = 'bullish';
    bosDetected = 'bullish';
  } else if (prevLL && lastLL && last.close < lastLL && last.close < prevLL) {
    trend = 'bearish';
    bosDetected = 'bearish';
  }

  const latestPivotHigh = pivotHighs.length > 0 ? pivotHighs[pivotHighs.length - 1] : null;
  const latestPivotLow = pivotLows.length > 0 ? pivotLows[pivotLows.length - 1] : null;

  const direction = trend === 'bullish' ? 'BUY' : trend === 'bearish' ? 'SELL' : 'NEUTRAL';

  return {
    currentPrice: last.close,
    trend,
    bosDetected,
    direction,
    swingHighs: pivotHighs.map(p => ({ price: p.price, time: p.time })),
    swingLows: pivotLows.map(p => ({ price: p.price, time: p.time })),
    recentHighs: recentHighs.slice(-3),
    recentLows: recentLows.slice(-3),
    latestSwingHigh: latestPivotHigh ? latestPivotHigh.price : null,
    latestSwingLow: latestPivotLow ? latestPivotLow.price : null,
    lastCandle: { open: last.open, high: last.high, low: last.low, close: last.close },
    prevCandle: prev ? { open: prev.open, high: prev.high, low: prev.low, close: prev.close } : null,
  };
}

function buildContext(structure) {
  if (!structure) return 'ไม่มีข้อมูลราคาย้อนหลัง (OHLC)';

  const lines = [
    `ราคาปัจจุบัน: $${structure.currentPrice.toFixed(2)}`,
    `แนวโน้ม: ${structure.trend === 'bullish' ? 'ขาขึ้น' : structure.trend === 'bearish' ? 'ขาลง' : ' sideways'}`,
    `BOS ที่ตรวจพบ: ${structure.bosDetected === 'bullish' ? 'Bullish BOS (ทะลุ HH)': structure.bosDetected === 'bearish' ? 'Bearish BOS (ทะลุ LL)' : 'ไม่พบ BOS ล่าสุด'}`,
    ``,
    `Swing High ล่าสุด: ${structure.latestSwingHigh !== null ? '$' + structure.latestSwingHigh.toFixed(2) : 'ไม่มีข้อมูล'}`,
    `Swing Low ล่าสุด: ${structure.latestSwingLow !== null ? '$' + structure.latestSwingLow.toFixed(2) : 'ไม่มีข้อมูล'}`,
    `Swing Highs ย้อนหลัง: [${structure.swingHighs.slice(-3).map(s => '$' + s.price.toFixed(2)).join(', ')}]`,
    `Swing Lows ย้อนหลัง: [${structure.swingLows.slice(-3).map(s => '$' + s.price.toFixed(2)).join(', ')}]`,
    ``,
    `แท่งล่าสุด: Open=$${structure.lastCandle.open.toFixed(2)} High=$${structure.lastCandle.high.toFixed(2)} Low=$${structure.lastCandle.low.toFixed(2)} Close=$${structure.lastCandle.close.toFixed(2)}`,
  ];

  if (structure.prevCandle) {
    lines.push(`แท่งก่อนหน้า: Open=$${structure.prevCandle.open.toFixed(2)} High=$${structure.prevCandle.high.toFixed(2)} Low=$${structure.prevCandle.low.toFixed(2)} Close=$${structure.prevCandle.close.toFixed(2)}`);
  }

  return lines.join('\n');
}

async function getMarketContext(pair) {
  const candles = await fetchOHLC(pair);
  if (!candles || candles.length < 10) return null;

  const pivotHighs = findPivotHighs(candles, 2, 2);
  const pivotLows = findPivotLows(candles, 2, 2);
  const structure = detectStructure(candles, pivotHighs, pivotLows);
  const context = buildContext(structure);

  return { candles, structure, context, pair };
}

module.exports = { fetchOHLC, findPivotHighs, findPivotLows, detectStructure, buildContext, getMarketContext, PAIR_MAP };
