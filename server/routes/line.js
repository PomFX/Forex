const express = require('express');
const router = express.Router();

router.post('/webhook', express.json(), (req, res) => {
  const events = req.body.events || [];
  console.log('=== LINE Webhook ===');
  console.log(JSON.stringify(req.body, null, 2));

  for (const event of events) {
    if (event.source && event.source.groupId) {
      console.log('*** GROUP ID:', event.source.groupId, '***');
    }
    if (event.source && event.source.userId) {
      console.log('*** USER ID:', event.source.userId, '***');
    }
  }

  res.json({ ok: true });
});

module.exports = router;
