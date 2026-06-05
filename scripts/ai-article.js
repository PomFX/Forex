require('dotenv').config();
const OpenAI = require('openai');

async function fetchGoldPrice() {
  try {
    const res = await fetch('https://api.gold-api.com/price/XAU');
    const data = await res.json();
    return data && data.price ? data.price : null;
  } catch { return null; }
}

function generateChartUrl(price) {
  const base = price || 4400;
  const points = [];
  const labels = [];
  const now = new Date();
  for (let i = 9; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(d.getHours() - i);
    labels.push(d.getHours() + ':00');
    const offset = (Math.random() - 0.5) * 60;
    points.push((base + offset).toFixed(2));
  }
  const chart = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'XAU/USD',
        data: points,
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255,215,0,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#FFD700',
      }],
    },
    options: {
      plugins: {
        legend: { labels: { color: '#FFD700', font: { size: 14, weight: 'bold' } } },
      },
      scales: {
        x: { ticks: { color: '#888', maxTicksLimit: 5 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#888', callback: 'function(v){return "$"+v.toFixed(2)}' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  };
  return 'https://quickchart.io/chart?width=700&height=350&backgroundColor=%23111111&format=png&c=' + encodeURIComponent(JSON.stringify(chart));
}

async function generateArticle(goldPrice) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `บทบาทของคุณคือ "นักวิเคราะห์ราคาทองคำมืออาชีพ" ช่วยทำการวิเคราะห์แนวโน้มราคาทองคำ (XAU/USD) ประจำรายชั่วโมง (กรอบเวลา H1) เพื่อใช้ประกอบการตัดสินใจซื้อขายในระยะสั้น (Day Trading)

Current Gold Price: $${goldPrice ? goldPrice.toFixed(2) : 'N/A'}

กรุณาวิเคราะห์และจัดทำรายงานตามหัวข้อต่อไปนี้:

1. สถานการณ์ปัจจุบัน (Current Market Snapshot)
- ราคา Spot ล่าสุด, ราคาทองคำแท่งไทย (ถ้ามี)
- แรงซื้อ/แรงขายในชั่วโมงที่ผ่านมา (Bullish / Bearish / Sideways)

2. การวิเคราะห์ทางเทคนิครายชั่วโมง (H1 Technical Analysis)
- แนวรับ (Support) และ แนวต้าน (Resistance) ที่สำคัญใน 1-3 ชั่วโมงข้างหน้า
- สัญญาณจากเครื่องมือทางเทคนิค (เช่น RSI อยู่ในเขต Overbought/Oversold หรือยัง?, MACD, หรือเส้น EMA 50/200 ในกรอบ H1 แสดงแนวโน้มอย่างไร?)
- รูปแบบแท่งเทียน (Candlestick Patterns) ที่น่าสนใจในกราฟรายชั่วโมง เช่น Pin Bar, Engulfing

3. ปัจจัยขับเคลื่อนและข่าวสารระหว่างวัน (Intraday Drivers & Catalyst)
- ดัชนีดอลลาร์ (Dollar Index - DXY) และอัตราผลตอบแทนพันธบัตรสหรัฐฯ (Bond Yield) กำลังเคลื่อนไหวไปในทิศทางใดและส่งผลต่อทองคำอย่างไรในชั่วโมงนี้?
- มีการประกาศตัวเลขเศรษฐกิจสำคัญของสหรัฐฯ หรือภูมิภาคอื่น (เช่น CPI, Non-Farm, Jobless Claims, หรือถ้อยแถลงของ Fed) ที่กำลังจะเกิดขึ้นในอีกไม่กี่ชั่วโมงข้างหน้าหรือไม่?

4. กลยุทธ์การเทรดรายชั่วโมง (Hourly Trading Strategy)
- แนะนำแผนการเข้าซื้อ (Buy) หรือ ขาย (Sell) ที่เหมาะสมตามแนวรับ-แนวต้าน (เช่น Buy on Dip หรือ Breakout)
- จุดตัดขาดทุน (Stop Loss) และ จุดทำกำไร (Take Profit) ที่คุ้มค่าต่อความเสี่ยง (Risk-Reward Ratio)

ข้อสำคัญ: เนื้อหาทั้งหมดต้องเป็นภาษาไทยเท่านั้น ห้ามใช้ภาษาอังกฤษ

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "บทวิเคราะห์ทองคำประจำวันที่ ...",
  "content": "เขียนเนื้อหาบทวิเคราะห์ทั้ง 4 หัวข้อด้านบนเป็นข้อความภาษาไทย กระชับ ตรงประเด็น แบ่งเป็นข้อๆ"
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const text = completion.choices[0].message.content.trim();
  const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

async function postArticle(article) {
  const apiUrl = process.env.AI_API_URL || 'http://localhost:8080';
  const apiKey = process.env.AI_SIGNAL_API_KEY;
  if (!apiKey) { console.error('AI_SIGNAL_API_KEY not set'); return; }

  const res = await fetch(`${apiUrl}/api/articles/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Key': apiKey,
    },
    body: JSON.stringify(article),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`✔ Article saved: ${article.title} (id: ${data.id})`);
  } else {
    console.error(`✖ ${data.error}`);
  }
}

async function main() {
  console.log('=== AI Gold Article Generator ===\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  console.log('Fetching gold price...');
  const goldPrice = await fetchGoldPrice();
  console.log(`Gold price: ${goldPrice ? '$' + goldPrice.toFixed(2) : 'N/A'}`);

  console.log('\nGenerating article...');
  const article = await generateArticle(goldPrice);
  console.log(`Title: ${article.title}`);

  console.log('\nGenerating chart...');
  const chartUrl = generateChartUrl(goldPrice);
  article.image = chartUrl;
  console.log('Chart URL generated');

  console.log('\nPosting article...');
  await postArticle(article);

  console.log('\n=== Done ===');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { fetchGoldPrice, generateArticle, postArticle };
