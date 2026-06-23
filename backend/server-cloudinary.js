/**
 * Wedding Gallery Backend V17 - Cloudinary Integration (Vercel-ready)
 * 100 foto / 15 MB per batch
 * Cloud storage via Cloudinary (FREE 25GB)
 * - Photos → Cloudinary folder `wedding-gallery/`
 * - Metadata (pinned photo) → Cloudinary context (no filesystem)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// === METADATA STORE via Cloudinary context API (Vercel-compatible) ===
// "pinned" photo stored as context (pinned=true) on the photo resource itself.
// No filesystem reads/writes — works in serverless.
async function getPinned() {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'wedding-gallery/',
      max_results: 500,
      context: true
    });
    const pinned = result.resources.find(r => r.context && r.context.custom && r.context.custom.pinned === 'true');
    if (!pinned) return null;
    return path.basename(pinned.public_id);
  } catch (e) {
    console.error('getPinned error:', e.message);
    return null;
  }
}

async function setPinned(filename) {
  // Unpin all first
  const all = await cloudinary.api.resources({
    type: 'upload',
    prefix: 'wedding-gallery/',
    max_results: 500
  });
  for (const r of all.resources) {
    try {
      await cloudinary.uploader.add_context('pinned=false', r.public_id);
    } catch (_) {}
  }
  if (filename) {
    const publicId = `wedding-gallery/${filename.replace(/\.[^.]+$/, '')}`;
    await cloudinary.uploader.add_context('pinned=true', publicId);
  }
}

// CORS — allow localhost dev + Vercel production
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:4000',
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/maryadi-riska\.vercel\.app$/
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => typeof o === 'string' ? o === origin : o.test(origin))) {
      return cb(null, true);
    }
    cb(new Error('CORS: ' + origin + ' not allowed'));
  },
  credentials: true
}));

app.use(express.json());

// Multer config - memory storage for Cloudinary upload
const upload = multer({
  storage: multer.memoryStorage(),
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

// Upload to Cloudinary helper
async function uploadToCloudinary(fileBuffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'wedding-gallery',
        public_id: filename.replace(/\.[^.]+$/, ''), // remove extension
        resource_type: 'image',
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    
    const readable = Readable.from(fileBuffer);
    readable.pipe(uploadStream);
  });
}

// === ROUTES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Wedding Gallery API V17 - Cloudinary',
    cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
  });
});

// List all photos
app.get('/api/photos', async (req, res) => {
  try {
    const pinned = await getPinned();

    // Get all photos from Cloudinary
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'wedding-gallery/',
      max_results: 500,
      context: true
    });

    const photos = result.resources.map(resource => {
      const filename = path.basename(resource.public_id);
      return {
        filename: filename,
        url: resource.secure_url,
        size: resource.bytes,
        uploaded: resource.created_at,
        pinned: pinned === filename
      };
    });

    // Sort: pinned first, then by upload date desc
    photos.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.uploaded) - new Date(a.uploaded);
    });

    res.json({ success: true, data: photos, pinned });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload photos (multiple)
app.post('/api/upload', upload.array('photos', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploaded = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const filename = `${name}-${uniqueSuffix}${ext}`;

        const result = await uploadToCloudinary(file.buffer, filename);

        uploaded.push({
          filename: filename,
          url: result.secure_url,
          size: result.bytes,
          uploaded: result.created_at
        });
      } catch (uploadErr) {
        errors.push({ file: file.originalname, error: uploadErr.message });
      }
    }

    if (uploaded.length === 0) {
      return res.status(500).json({ 
        success: false, 
        message: 'All uploads failed', 
        errors 
      });
    }

    res.json({ 
      success: true, 
      data: uploaded,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete photo
app.delete('/api/photos/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const publicId = `wedding-gallery/${filename.replace(/\.[^.]+$/, '')}`;

    await cloudinary.uploader.destroy(publicId);

    // Clear pinned if this was the pinned photo
    const pinned = await getPinned();
    if (pinned === filename) {
      await setPinned(null);
    }

    res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Pin/unpin photo
app.put('/api/photos/:filename/pin', async (req, res) => {
  try {
    const { filename } = req.params;
    const current = await getPinned();

    if (current === filename) {
      await setPinned(null);
      return res.json({ success: true, pinned: false, message: 'Photo unpinned' });
    } else {
      await setPinned(filename);
      return res.json({ success: true, pinned: true, message: 'Photo pinned' });
    }
  } catch (error) {
    console.error('Pin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Replace photo
app.put('/api/photos/:filename/replace', upload.single('photo'), async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const publicId = `wedding-gallery/${filename.replace(/\.[^.]+$/, '')}`;
    
    // Delete old photo
    await cloudinary.uploader.destroy(publicId);

    // Upload new photo with same filename
    const ext = path.extname(req.file.originalname);
    const name = filename.replace(/\.[^.]+$/, '');
    const newFilename = `${name}${ext}`;

    const result = await uploadToCloudinary(req.file.buffer, newFilename);

    res.json({ 
      success: true, 
      data: {
        filename: newFilename,
        url: result.secure_url,
        size: result.bytes,
        uploaded: result.created_at
      }
    });
  } catch (error) {
    console.error('Replace error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Download all photos (ZIP)
app.get('/api/download-all', async (req, res) => {
  try {
    // Get all photos from Cloudinary
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'wedding-gallery/',
      max_results: 500
    });

    if (result.resources.length === 0) {
      return res.status(404).json({ success: false, message: 'No photos to download' });
    }

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment('wedding-gallery.zip');
    archive.pipe(res);

    // Download each photo and add to archive
    for (const resource of result.resources) {
      const filename = path.basename(resource.public_id) + path.extname(resource.secure_url);
      const response = await fetch(resource.secure_url);
      const buffer = Buffer.from(await response.arrayBuffer());
      archive.append(buffer, { name: filename });
    }

    await archive.finalize();
  } catch (error) {
    console.error('Download all error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Wedding Gallery Backend V17 running on http://localhost:${PORT}`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME || 'NOT CONFIGURED'}`);
  console.log(`📸 Upload limit: 100 photos / 15 MB per photo`);
});
