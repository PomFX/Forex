require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('../server/db');

const app = express();

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-AI-Key'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', require('../server/routes/auth'));
app.use('/api/signals', require('../server/routes/signals'));
app.use('/api/articles', require('../server/routes/articles'));
app.use('/api/brokers', require('../server/routes/brokers'));
app.use('/api/users', require('../server/routes/users'));
app.use('/api/stats', require('../server/routes/stats'));
app.use('/api/upload', require('../server/routes/upload'));
app.use('/api/settings', require('../server/routes/settings'));
app.use('/api/market', require('../server/routes/market'));
app.use('/uploads', express.static('/tmp/uploads'));

app.get('/api/*', (req, res) => res.status(404).json({ error: 'API not found' }));

let initialized = false;
module.exports = async (req, res) => {
  if (!initialized) {
    try {
      await initDB();
      initialized = true;
    } catch (err) {
      console.error('DB init failed:', err);
    }
  }
  app(req, res);
};
