const express = require('express');
const cors = require('cors');

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-AI-Key', 'X-MT5-Key'],
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/signals', require('./routes/signals'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/market', require('./routes/market'));
app.use('/api/line', require('./routes/line'));
app.use('/api/auto-signals', require('./routes/auto-signals'));
app.use('/api/ai-settings', require('./routes/ai-settings'));
app.use('/api/ai-article-settings', require('./routes/ai-article-settings'));
app.use('/api/ea', require('./routes/ea-dashboard'));
app.use('/api/mt5-signal-settings', require('./routes/mt5-signal-settings'));

module.exports = app;
