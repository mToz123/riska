/* ============================================================
   GALLERY MARYADI & RISKA — V17 App Logic
   Days Counter, Scroll Reveal, Pin, Replace, Featured
   ============================================================ */

(function() {
  'use strict';

  const API = 'http://localhost:4000';
  const ANNIVERSARY_DATE = new Date('2024-02-14'); // 14 Februari 2024

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
})();