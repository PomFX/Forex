const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const MAX_WIDTH = 1200;
const QUALITY = 80;

const isVercel = !!process.env.VERCEL;
const UPLOAD_DIR = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('เฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP, GIF)'));
    cb(null, true);
  },
});

router.post('/', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพ' });

    let buffer = req.file.buffer;
    let mime = 'image/' + (path.extname(req.file.originalname).slice(1) || 'jpeg');
    if (mime === 'image/jpg') mime = 'image/jpeg';

    // Try sharp to resize + convert to WebP
    try {
      const sharp = require('sharp');
      let img = sharp(buffer);
      const meta = await img.metadata();
      if (meta.width > MAX_WIDTH) {
        img = img.resize(MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true });
      }
      const webpBuf = await img.webp({ quality: QUALITY }).toBuffer();
      buffer = webpBuf;
      mime = 'image/webp';
    } catch {
      // sharp not available — use original
    }

    // Save to filesystem for local dev
    if (!isVercel) {
      const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.webp';
      fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
    }

    // Return data URL
    const b64 = buffer.toString('base64');
    const dataUrl = 'data:' + mime + ';base64,' + b64;

    if (b64.length > 500000) {
      if (isVercel) {
        return res.status(400).json({ error: 'รูปภาพใหญ่เกินไป (สูงสุด ~500KB หลังแปลง)' });
      }
      const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.webp';
      fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
      return res.json({ url: '/uploads/' + name });
    }

    res.json({ url: dataUrl });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

// Error handling
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' });
    return res.status(400).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;
