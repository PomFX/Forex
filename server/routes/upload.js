const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_WIDTH = 1200;
const QUALITY = 80;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('เฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP, GIF)'));
    }
    cb(null, true);
  },
});

router.post('/', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพ' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const filepath = path.join(UPLOAD_DIR, filename);

    let image = sharp(req.file.buffer);
    const meta = await image.metadata();

    // Resize if too wide
    if (meta.width > MAX_WIDTH) {
      image = image.resize(MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true });
    }

    // Convert to WebP for smaller size
    const outName = filename.replace(ext, '.webp');
    const outPath = path.join(UPLOAD_DIR, outName);

    await image
      .webp({ quality: QUALITY })
      .toFile(outPath);

    // Remove original if format changed
    if (outName !== filename) {
      // just don't save the original buffer
    }

    res.json({ url: '/uploads/' + outName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Error handling for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;
