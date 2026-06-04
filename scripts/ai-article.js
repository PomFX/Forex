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

  const prompt = `You are a professional gold (XAU/USD) market analyst. Write a daily gold analysis article in Thai language.

Current Gold Price: $${goldPrice ? goldPrice.toFixed(2) : 'N/A'}

The article should include:
1. A catchy title (in Thai) about today's gold market
2. Content covering:
   - Current gold price and daily movement
   - Key factors affecting gold today (e.g., USD strength, geopolitical events, Fed policy)
   - Technical analysis (support/resistance levels)
   - Outlook for today/this week
   - Trading recommendation (for short-term and medium-term)

Format: Return a JSON object with title and content fields.
- Title should be engaging, max 80 chars
- Content should be 3-5 paragraphs, well-formatted in Thai
- Do NOT use markdown in the content, use plain text with newlines

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "บทวิเคราะห์ทองคำประจำวันที่ ...",
  "content": "เนื้อหาบทวิเคราะห์..."
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
