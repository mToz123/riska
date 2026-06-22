# Wedding Gallery V17 - Professional Animated

Gallery foto pernikahan dengan emotional anchors, animated design, dan cloud storage.

## ✨ Features

- 💝 **Days Counter**: Live counter sejak 14 Februari 2024
- 🎭 **M&R Monogram**: Brand mark M❤R dengan heart SVG
- 📜 **Scroll Reveal**: Smooth fade-in animations saat scroll
- ✦ **Section Dividers**: Elegant ornamental dividers
- 🌟 **Featured Photo**: Pin momen utama dengan animated glow
- 📸 **Upload**: 100 foto sekaligus, max 15 MB per foto
- 🔄 **Replace**: Ganti foto tanpa hapus & upload ulang
- 💾 **Download All**: Download semua foto dalam 1 ZIP
- ☁️ **Cloud Storage**: Cloudinary integration (FREE 25GB)

## 🎨 Design

- **Dark romantic theme** dengan single rose accent (#d9718a)
- **Editorial layout** dengan generous whitespace
- **7 custom animations** (titleIn, fadeIn, breathe, shimmer, heartBeat, ornamentPulse, featuredGlow)
- **Fraunces + Inter** fonts dengan optical-size axes
- **Responsive** mobile-first design

## 🚀 Deploy

### Local Development

```bash
# Backend
cd backend
npm install
node server.js
# Backend runs on http://localhost:4000

# Frontend
cd frontend
npx http-server -p 5500
# Frontend runs on http://localhost:5500
```

### Production (Vercel + Cloudinary)

1. Setup Cloudinary account (https://cloudinary.com/users/register/free)
2. Copy credentials ke `backend/.env`:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
3. Use `server-cloudinary.js` instead of `server.js`
4. Deploy to Vercel via GitHub

## 📦 Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Backend**: Node.js + Express + Multer
- **Storage**: Cloudinary (cloud) atau local filesystem
- **Deploy**: Vercel (frontend + API)

## 🔒 Security

- `.gitignore` excludes uploads, .env, node_modules
- 15 MB per file limit
- 100 files per batch limit
- Image-only file filter (jpeg, jpg, png, gif, webp)

## 💝 Personal

Website ini dibuat dengan cinta untuk Maryadi & Riska.

**Anniversary**: 14 Februari 2024

---

© 2024 · Dibuat dengan cinta, untuk kita. Selamanya.
