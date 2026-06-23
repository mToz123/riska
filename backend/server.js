/**
 * Wedding Gallery Backend
 * Public gallery - upload, delete, download photos
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const META_FILE = path.join(__dirname, 'metadata.json');

// Ensure uploads dir exists
if (!fsSync.existsSync(UPLOAD_DIR)) {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// === METADATA STORE (pinned photos) ===
async function loadMeta() {
  try {
    const raw = await fs.readFile(META_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { pinned: null, order: {} };
  }
}

async function saveMeta(meta) {
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
}

// CORS
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:4000'],
  credentials: true
}));

app.use(express.json());

// Multer config - store photos with original name + timestamp to avoid collision
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, name + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 100 // max 100 files per batch
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'));
  }
});

// === ROUTES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Wedding Gallery API is running' });
});

// List all photos
app.get('/api/photos', async (req, res) => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const meta = await loadMeta();
    const photos = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(filename => {
        const filepath = path.join(UPLOAD_DIR, filename);
        const stats = fsSync.statSync(filepath);
        return {
          filename,
          url: `/uploads/${filename}`,
          size: stats.size,
          uploaded: stats.birthtime,
          pinned: meta.pinned === filename,
          customOrder: meta.order?.[filename] ?? null
        };
      })
      .sort((a, b) => {
        // Pinned photo first
        if (a.pinned && !b.pinned) return -1;
        if (b.pinned && !a.pinned) return 1;
        // Then by custom order
        const ao = a.customOrder ?? Infinity;
        const bo = b.customOrder ?? Infinity;
        if (ao !== bo) return ao - bo;
        // Then newest first
        return new Date(b.uploaded) - new Date(a.uploaded);
      });

    res.json({ success: true, data: photos, pinned: meta.pinned });
  } catch (error) {
    console.error('List photos error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle pin status (set as "momen paling atas")
app.put('/api/photos/:filename/pin', async (req, res) => {
  try {
    const { filename } = req.params;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    const filepath = path.join(UPLOAD_DIR, filename);
    if (!fsSync.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const meta = await loadMeta();
    meta.pinned = meta.pinned === filename ? null : filename;
    await saveMeta(meta);

    res.json({ success: true, pinned: meta.pinned });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Replace photo (delete old, upload new in its place)
app.put('/api/photos/:filename/replace', upload.single('photo'), async (req, res) => {
  try {
    const { filename } = req.params;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const oldPath = path.join(UPLOAD_DIR, filename);
    const wasPinned = false;
    const meta = await loadMeta();
    const pinnedHere = meta.pinned === filename;

    // Delete old file if exists
    try { await fs.unlink(oldPath); } catch {}

    // Move new upload to take over old filename
    const ext = path.extname(req.file.filename);
    const newFilename = filename.replace(/\.[^.]+$/, '') + ext;
    const newPath = path.join(UPLOAD_DIR, newFilename);
    await fs.rename(req.file.path, newPath);

    // Preserve pin status if it was pinned
    if (pinnedHere) {
      meta.pinned = newFilename;
      await saveMeta(meta);
    }

    res.json({
      success: true,
      data: {
        oldFilename: filename,
        newFilename,
        url: `/uploads/${newFilename}`,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Replace error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload photos (multiple)
app.post('/api/upload', upload.array('photos', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }
    
    const uploaded = req.files.map(file => ({
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      size: file.size,
      originalname: file.originalname
    }));
    
    res.json({ success: true, data: uploaded });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete photo
app.delete('/api/photos/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.unlink(filepath);
    
    res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download single photo
app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  // Security: prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Invalid filename');
  }
  
  const filepath = path.join(UPLOAD_DIR, filename);
  if (!fsSync.existsSync(filepath)) {
    return res.status(404).send('Photo not found');
  }
  
  res.sendFile(filepath);
});

// Download all photos as ZIP
app.get('/api/download-all', async (req, res) => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const photos = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    
    if (photos.length === 0) {
      return res.status(404).json({ success: false, error: 'No photos to download' });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const zipName = `wedding-gallery-${timestamp}.zip`;
    
    res.attachment(zipName);
    res.setHeader('Content-Type', 'application/zip');
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).send('Error creating archive');
    });
    
    archive.pipe(res);
    
    for (const photo of photos) {
      const filepath = path.join(UPLOAD_DIR, photo);
      archive.file(filepath, { name: photo });
    }
    
    archive.finalize();
  } catch (error) {
    console.error('Download all error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large (max 10MB)' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Wedding Gallery backend running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${UPLOAD_DIR}`);
});
