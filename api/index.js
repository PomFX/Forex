require('dotenv').config();
const express = require('express');
const { initDB } = require('../server/db');
const app = require('../server/app');

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
