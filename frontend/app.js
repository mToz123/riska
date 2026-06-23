/* ============================================================
   GALLERY MARYADI & RISKA — V17 App Logic
   Days Counter, Scroll Reveal, Pin, Replace, Featured
   ============================================================ */

(function() {
  'use strict';

  // Use relative path so it works in both localhost dev and Vercel production
  // (same origin: frontend served from /, backend at /api/* on Vercel)
  const API = '';
  const ANNIVERSARY_DATE = new Date('2024-02-14'); // 14 Februari 2024

  // ============================================================
  // PASSWORD GATE
  // ============================================================
  // Client-side gate — cocok untuk gallery pribadi 2 orang.
  // Bukan security-grade, tapi cukup untuk nahan tamu случайный.
  // Hash sederhana (bukan crypto) supaya tidak kelihatan plaintext di DevTools.
  const GATE_HASH = '589dfcd1'; // FNV-1a fingerprint of 'riska'
  const GATE_SESSION_KEY = 'wedding-gallery-unlocked';

  const gate = document.getElementById('gate');
  const gateForm = document.getElementById('gate-form');
  const gateInput = document.getElementById('gate-input');
  const gateError = document.getElementById('gate-error');
  const gateSubmit = gateForm ? gateForm.querySelector('button[type="submit"]') : null;

  // Lightweight hash (FNV-1a 32-bit) — konsisten antara runs, cukup untuk fingerprint sederhana
  function fingerprint(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function showError(msg) {
    if (!gateError) return;
    gateError.textContent = msg;
    gateError.classList.add('is-visible');
  }

  function clearError() {
    if (!gateError) return;
    gateError.textContent = '';
    gateError.classList.remove('is-visible');
  }

  function unlock() {
    sessionStorage.setItem(GATE_SESSION_KEY, '1');
    if (gate) {
      gate.classList.add('is-leaving');
      setTimeout(() => { gate.remove(); }, 420);
    }
  }

  function lock() {
    sessionStorage.removeItem(GATE_SESSION_KEY);
    if (gate) {
      gate.classList.remove('is-leaving');
    }
  }

  function tryUnlock(value) {
    if (fingerprint(value) === GATE_HASH) {
      clearError();
      unlock();
      return true;
    }
    return false;
  }

  // Init: kalau session ini udah unlock, skip gate
  if (sessionStorage.getItem(GATE_SESSION_KEY) === '1' && gate) {
    gate.remove();
  } else if (gate) {
    // Trap focus in gate
    setTimeout(() => gateInput && gateInput.focus(), 80);

    // ESC to lock (back to gate)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sessionStorage.getItem(GATE_SESSION_KEY) === '1') {
        // Only re-lock if user is on gate (shouldn't happen since gate is removed, but safe)
      }
    });
  }

  // Form submit
  if (gateForm) {
    gateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = (gateInput.value || '').trim();
      if (!value) {
        showError('Kode belum diisi.');
        gateInput.focus();
        return;
      }
      if (gateSubmit) gateSubmit.disabled = true;
      // Tiny artificial delay to avoid instant reveal
      setTimeout(() => {
        if (!tryUnlock(value)) {
          showError('Kode akses salah. Coba lagi ya.');
          gateInput.select();
          gateInput.focus();
          if (gateSubmit) gateSubmit.disabled = false;
        }
      }, 250);
    });

    // Clear error saat user mulai ngetik ulang
    gateInput.addEventListener('input', clearError);
  }

  const els = {
    gallery:        document.getElementById('gallery'),
    metaCount:      document.getElementById('meta-count'),
    heroPhotoCount: document.getElementById('hero-photo-count'),
    daysNum:        document.getElementById('days-num'),
    year:           document.getElementById('year'),

    uploadZone:     document.getElementById('upload-zone'),
    fileInput:      document.getElementById('file-input'),
    uploadStatus:   document.getElementById('upload-status'),

    featuredSection: document.getElementById('momen-utama'),
    featuredImg:     document.getElementById('featured-img'),
    featuredCaption: document.getElementById('featured-caption'),
    featuredChange:  document.getElementById('featured-change'),
    featuredUnpin:   document.getElementById('featured-unpin'),
    replaceInput:    document.getElementById('replace-input'),

    lightbox:       document.getElementById('lightbox'),
    lightboxImg:    document.getElementById('lightbox-img'),
    lightboxClose:  document.getElementById('lightbox-close'),
    lightboxPrev:   document.getElementById('lightbox-prev'),
    lightboxNext:   document.getElementById('lightbox-next'),
    lightboxCounter:document.getElementById('lightbox-counter'),
    lightboxDate:   document.getElementById('lightbox-date'),
    lightboxPin:    document.getElementById('lightbox-pin'),
    lightboxPinLabel:document.getElementById('lightbox-pin-label'),
    lightboxReplace:document.getElementById('lightbox-replace'),
    lightboxReplaceInput: document.getElementById('lightbox-replace-input'),
    lightboxDelete: document.getElementById('lightbox-delete'),

    downloadAllBtn: document.getElementById('download-all-btn'),
    toastRegion:    document.getElementById('toast-region'),
  };

  let photos = [];
  let currentLightboxIndex = -1;
  let currentPinned = null;

  // === Days Counter ===
  function updateDaysCounter() {
    const now = new Date();
    const diff = now - ANNIVERSARY_DATE;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (els.daysNum) {
      els.daysNum.textContent = days;
    }
  }

  // === Scroll Reveal (Intersection Observer) ===
  function setupScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if (!revealElements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -80px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }

  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    els.toastRegion.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'all 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  }

  function shortName(filename) {
    const m = filename.match(/^(.+?)-(\d+)-\d+\.[^.]+$/);
    if (m) return m[1].replace(/[-_]/g, ' ');
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  }

  // === API ===
  async function fetchPhotos() {
    try {
      const res = await fetch(`${API}/api/photos`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      photos = json.data || [];
      currentPinned = json.pinned || null;
      renderAll();
    } catch (e) {
      toast('Gagal memuat galeri', 'error');
      console.error(e);
    }
  }

  async function uploadPhotos(files) {
    if (!files.length) return;
    if (files.length > 100) { toast('Maksimal 100 foto sekaligus', 'error'); return; }
    const oversized = Array.from(files).filter(f => f.size > 15 * 1024 * 1024);
    if (oversized.length) { toast(`${oversized.length} foto lebih dari 15MB`, 'error'); return; }

    const form = new FormData();
    Array.from(files).forEach(f => form.append('photos', f));

    els.uploadStatus.textContent = `Mengunggah ${files.length} foto…`;

    try {
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload gagal');
      }
      const json = await res.json();
      toast(`${json.data.length} foto berhasil diunggah`, 'success');
      els.uploadStatus.textContent = `${json.data.length} foto diunggah · ${fmtSize(files.reduce((a, f) => a + f.size, 0))}`;
      setTimeout(() => { els.uploadStatus.textContent = ''; }, 4000);
      await fetchPhotos();
    } catch (e) {
      toast(e.message || 'Gagal mengunggah', 'error');
      els.uploadStatus.textContent = '';
      console.error(e);
    }
  }

  async function deletePhoto(filename) {
    if (!confirm(`Hapus foto "${shortName(filename)}"?`)) return;
    try {
      const res = await fetch(`${API}/api/photos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus');
      toast('Foto dihapus', 'success');
      closeLightbox();
      await fetchPhotos();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function togglePin(filename) {
    try {
      const res = await fetch(`${API}/api/photos/${encodeURIComponent(filename)}/pin`, { method: 'PUT' });
      if (!res.ok) throw new Error('Gagal memperbarui momen utama');
      const json = await res.json();
      toast(json.pinned ? `★ "${shortName(filename)}" dijadikan momen utama` : 'Pin dilepas', 'success');
      await fetchPhotos();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function replacePhoto(oldFilename, newFile) {
    if (!newFile) return;
    if (newFile.size > 10 * 1024 * 1024) { toast('File lebih dari 10MB', 'error'); return; }

    const form = new FormData();
    form.append('photo', newFile);

    try {
      const res = await fetch(`${API}/api/photos/${encodeURIComponent(oldFilename)}/replace`, {
        method: 'PUT',
        body: form
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Gagal mengganti foto');
      }
      toast('Foto diganti', 'success');
      closeLightbox();
      await fetchPhotos();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function downloadAll() {
    window.open(`${API}/api/download-all`, '_blank');
  }

  function downloadOne(photo) {
    const a = document.createElement('a');
    a.href = `${API}${photo.url}`;
    a.download = photo.filename;
    a.click();
  }

  // === Render ===
  function renderAll() {
    // Meta count
    const count = photos.length;
    if (els.metaCount) {
      els.metaCount.textContent = count === 0 ? '—' : count.toString().padStart(2, '0');
    }
    if (els.heroPhotoCount) {
      els.heroPhotoCount.textContent = count === 0 ? '—' : count;
    }

    renderFeatured();
    renderGallery();
  }

  function renderFeatured() {
    if (!currentPinned || photos.length === 0) {
      els.featuredSection.hidden = true;
      return;
    }
    const pinnedPhoto = photos.find(p => p.filename === currentPinned);
    if (!pinnedPhoto) {
      els.featuredSection.hidden = true;
      return;
    }

    els.featuredSection.hidden = false;
    els.featuredImg.src = `${API}${pinnedPhoto.url}`;
    els.featuredImg.alt = `Momen utama — ${shortName(currentPinned)}`;
    els.featuredCaption.textContent = `★ ${shortName(currentPinned)} · ${fmtSize(pinnedPhoto.size)} · ${fmtDate(pinnedPhoto.uploaded)}`;

    els.featuredChange.onclick = () => {
      els.replaceInput.dataset.targetFilename = currentPinned;
      els.replaceInput.click();
    };
    els.featuredUnpin.onclick = () => togglePin(currentPinned);
  }

  function renderGallery() {
    els.gallery.innerHTML = '';

    if (photos.length === 0) {
      document.getElementById('empty').hidden = false;
      return;
    }
    document.getElementById('empty').hidden = true;

    photos.forEach((photo, index) => {
      const item = document.createElement('article');
      item.className = 'gallery-item' + (photo.pinned ? ' is-pinned' : '');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `Foto ${index + 1}: ${shortName(photo.filename)}`);

      if (photo.pinned) {
        const pin = document.createElement('div');
        pin.className = 'gallery-item-pin';
        pin.setAttribute('aria-hidden', 'true');
        pin.textContent = '★';
        item.appendChild(pin);
      }

      const img = document.createElement('img');
      img.src = `${API}${photo.url}`;
      img.alt = `Momen ${index + 1}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      item.appendChild(img);

      // === Caption berjalan + date stamp ===
      // Marquee brand berjalan di atas foto, date stamp static di bawah.
      const caption = document.createElement('div');
      caption.className = 'gallery-item-caption';
      const marquee = document.createElement('div');
      marquee.className = 'gallery-item-marquee';
      // Duplicate text untuk seamless loop
      const marqueeText = 'Maryadi \u2665 Riska \u00B7 14 Februari 2024 \u00B7 Selamanya \u00B7 ';
      marquee.innerHTML = `<span class="marquee-track">${marqueeText.repeat(4)}</span>`;
      const dateStamp = document.createElement('div');
      dateStamp.className = 'gallery-item-date';
      dateStamp.textContent = `Diunggah ${fmtDate(photo.uploaded)}`;
      caption.appendChild(marquee);
      caption.appendChild(dateStamp);
      item.appendChild(caption);

      const overlay = document.createElement('div');
      overlay.className = 'gallery-item-overlay';

      const actions = document.createElement('div');
      actions.className = 'gallery-item-actions';

      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'btn btn-ghost btn-sm';
      dlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Unduh</span>';
      dlBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadOne(photo); });

      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'btn btn-ghost btn-sm';
      pinBtn.innerHTML = photo.pinned
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>Lepas</span>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>Utama</span>';
      pinBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePin(photo.filename); });

      actions.appendChild(dlBtn);
      actions.appendChild(pinBtn);
      overlay.appendChild(actions);
      item.appendChild(overlay);

      item.addEventListener('click', () => openLightbox(index));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(index);
        }
      });

      // === 3D Tilt Effect ===
      // Touch/mouse interaksi bikin card goyang dengan perspective 3D
      let tiltRAF = null;
      const applyTilt = (rect, clientX, clientY) => {
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -8; // max ±8deg
        const rotateY = ((x - centerX) / centerX) * 8;
        if (tiltRAF) cancelAnimationFrame(tiltRAF);
        tiltRAF = requestAnimationFrame(() => {
          item.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });
      };
      const resetTilt = () => {
        if (tiltRAF) cancelAnimationFrame(tiltRAF);
        item.style.transform = '';
      };
      item.addEventListener('mousemove', (e) => {
        const rect = item.getBoundingClientRect();
        applyTilt(rect, e.clientX, e.clientY);
      });
      item.addEventListener('mouseleave', resetTilt);
      item.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          const rect = item.getBoundingClientRect();
          applyTilt(rect, e.touches[0].clientX, e.touches[0].clientY);
        }
      }, {passive: true});
      item.addEventListener('touchend', resetTilt);

      els.gallery.appendChild(item);
    });
  }

  // === Lightbox ===
  function openLightbox(index) {
    if (index < 0 || index >= photos.length) return;
    currentLightboxIndex = index;
    updateLightbox();
    els.lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    els.lightboxClose.focus();
  }

  function closeLightbox() {
    els.lightbox.hidden = true;
    document.body.style.overflow = '';
    currentLightboxIndex = -1;
  }

  function updateLightbox() {
    if (currentLightboxIndex < 0) return;
    const photo = photos[currentLightboxIndex];
    els.lightboxImg.src = `${API}${photo.url}`;
    els.lightboxImg.alt = shortName(photo.filename);
    els.lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${photos.length}`;
    if (els.lightboxDate) {
      els.lightboxDate.textContent = fmtDate(photo.uploaded);
    }
    els.lightboxPrev.disabled = currentLightboxIndex === 0;
    els.lightboxNext.disabled = currentLightboxIndex === photos.length - 1;

    if (photo.pinned) {
      els.lightboxPinLabel.textContent = 'Lepas utama';
    } else {
      els.lightboxPinLabel.textContent = 'Jadikan utama';
    }

    els.lightboxPin.onclick = () => togglePin(photo.filename);
    els.lightboxReplace.onclick = () => {
      els.lightboxReplaceInput.dataset.targetFilename = photo.filename;
      els.lightboxReplaceInput.click();
    };
    els.lightboxDelete.onclick = () => deletePhoto(photo.filename);
  }

  function nextPhoto() {
    if (currentLightboxIndex < photos.length - 1) { currentLightboxIndex++; updateLightbox(); }
  }
  function prevPhoto() {
    if (currentLightboxIndex > 0) { currentLightboxIndex--; updateLightbox(); }
  }

  // === Upload ===
  function setupUpload() {
    els.uploadZone.addEventListener('click', () => els.fileInput.click());
    els.uploadZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
    });
    els.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length) uploadPhotos(files);
      e.target.value = '';
    });

    let dragCounter = 0;
    ['dragenter', 'dragover'].forEach(evt =>
      els.uploadZone.addEventListener(evt, (e) => {
        e.preventDefault();
        if (evt === 'dragenter') dragCounter++;
        els.uploadZone.classList.add('drag-over');
      })
    );
    ['dragleave', 'drop'].forEach(evt =>
      els.uploadZone.addEventListener(evt, (e) => {
        e.preventDefault();
        if (evt === 'dragleave') {
          dragCounter--;
          if (dragCounter <= 0) { dragCounter = 0; els.uploadZone.classList.remove('drag-over'); }
        }
        if (evt === 'drop') {
          dragCounter = 0;
          els.uploadZone.classList.remove('drag-over');
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
          if (files.length) uploadPhotos(files);
          else toast('File harus berupa gambar', 'error');
        }
      })
    );

    els.replaceInput.addEventListener('change', (e) => {
      const targetFilename = els.replaceInput.dataset.targetFilename;
      const file = e.target.files[0];
      if (targetFilename && file) replacePhoto(targetFilename, file);
      e.target.value = '';
      delete els.replaceInput.dataset.targetFilename;
    });

    els.lightboxReplaceInput.addEventListener('change', (e) => {
      const targetFilename = els.lightboxReplaceInput.dataset.targetFilename;
      const file = e.target.files[0];
      if (targetFilename && file) replacePhoto(targetFilename, file);
      e.target.value = '';
      delete els.lightboxReplaceInput.dataset.targetFilename;
    });
  }

  function init() {
    if (els.year) els.year.textContent = new Date().getFullYear();
    
    updateDaysCounter();
    setInterval(updateDaysCounter, 60000); // Update every minute

    setupScrollReveal();
    setupUpload();

    els.lightboxClose.addEventListener('click', closeLightbox);
    els.lightboxPrev.addEventListener('click', prevPhoto);
    els.lightboxNext.addEventListener('click', nextPhoto);
    els.lightbox.addEventListener('click', (e) => {
      if (e.target === els.lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (els.lightbox.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
    });

    els.downloadAllBtn.addEventListener('click', downloadAll);

    fetchPhotos();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================================
  // STAR TRAIL PARTICLES — Bintang mengikuti scroll/touch
  // ============================================================
  const starCanvas = document.createElement('canvas');
  starCanvas.className = 'star-trail-canvas';
  starCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;mix-blend-mode:screen;opacity:0.85';
  document.body.appendChild(starCanvas);
  const ctx = starCanvas.getContext('2d');
  const stars = [];
  const maxStars = 80;

  function resizeCanvas() {
    starCanvas.width = window.innerWidth;
    starCanvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function createStar(x, y) {
    const size = Math.random() * 2 + 1;
    const vx = (Math.random() - 0.5) * 1.5;
    const vy = (Math.random() - 0.5) * 1.5;
    const life = 60 + Math.random() * 30; // 1-1.5s at 60fps
    stars.push({x, y, vx, vy, size, life, age: 0, opacity: 1});
    if (stars.length > maxStars) stars.shift();
  }

  function updateStars() {
    ctx.clearRect(0, 0, starCanvas.width, starCanvas.height);
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.age++;
      s.x += s.vx;
      s.y += s.vy;
      s.opacity = 1 - (s.age / s.life);
      if (s.age >= s.life || s.opacity <= 0) {
        stars.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255, 215, 130, ${s.opacity * 0.9})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(updateStars);
  }
  updateStars();

  // Spawn stars on mouse move (throttle)
  let lastStarTime = 0;
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastStarTime > 50) {
      createStar(e.clientX, e.clientY);
      lastStarTime = now;
    }
  });

  // Spawn stars on touch move
  document.addEventListener('touchmove', (e) => {
    const now = Date.now();
    if (now - lastStarTime > 50 && e.touches.length > 0) {
      createStar(e.touches[0].clientX, e.touches[0].clientY);
      lastStarTime = now;
    }
  }, {passive: true});

  // Spawn stars on scroll (a bit)
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const delta = Math.abs(window.scrollY - lastScrollY);
    if (delta > 10) {
      const x = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
      const y = window.innerHeight / 2 + (Math.random() - 0.5) * 200;
      createStar(x, y);
      lastScrollY = window.scrollY;
    }
  }, {passive: true});

})();