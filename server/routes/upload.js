const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminMiddleware } = require('./auth');
const router = express.Router();

const MAX_WIDTH = 1200;
const QUALITY = 80;

// Detect environment
const isVercel = !!process.env.VERCEL;
const UPLOAD_DIR = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
    const baseName = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const outName = baseName + '.webp';
    const outPath = path.join(UPLOAD_DIR, outName);

    try {
      const sharp = require('sharp');
      let image = sharp(req.file.buffer);
      const meta = await image.metadata();
      if (meta.width > MAX_WIDTH) {
        image = image.resize(MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true });
      }
      await image.webp({ quality: QUALITY }).toFile(outPath);
    } catch {
      // sharp failed — save original
      const fallbackName = baseName + ext;
      fs.writeFileSync(path.join(UPLOAD_DIR, fallbackName), req.file.buffer);
      return res.json({ url: '/api/upload/file/' + fallbackName });
    }

    res.json({ url: '/api/upload/file/' + outName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve uploaded files via /api/upload/file/:name
router.get('/file/:file', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
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
