'use strict';

const Upload = (() => {
  const MAX_PHOTOS = 8;
  const MAX_PX     = 1200;
  const QUALITY    = 0.78;
  let _photos      = []; // [{id, base64, caption, mimeType, width, height, orientation, local, relatorioId}]
  let _dbReady     = false;
  let _idb         = null;

  /* ── IndexedDB init ───────────────────────── */
  async function _initIDB() {
    if (_dbReady) return;
    return new Promise((res, rej) => {
      const req = indexedDB.open('lteSondaPhotos', 1);
      req.onerror = () => rej(req.error);
      req.onsuccess = () => { _idb = req.result; _dbReady = true; res(); };
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', {keyPath:'id'});
          store.createIndex('relatorioId','relatorioId',{unique:false});
        }
      };
    });
  }

  async function _idbSave(photo) {
    await _initIDB();
    return new Promise((res,rej) => {
      const tx  = _idb.transaction('photos','readwrite');
      const req = tx.objectStore('photos').put(photo);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  }

  async function _idbGetByReport(relatorioId) {
    await _initIDB();
    return new Promise((res,rej) => {
      const tx    = _idb.transaction('photos','readonly');
      const idx   = tx.objectStore('photos').index('relatorioId');
      const req   = idx.getAll(relatorioId);
      req.onsuccess = () => res(req.result||[]);
      req.onerror   = () => rej(req.error);
    });
  }

  async function _idbDelete(id) {
    await _initIDB();
    return new Promise((res,rej) => {
      const tx  = _idb.transaction('photos','readwrite');
      const req = tx.objectStore('photos').delete(id);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  }

  /* ── Image compression ────────────────────── */
  function _compress(file) {
    return new Promise((res,rej) => {
      const reader = new FileReader();
      reader.onerror = () => rej(new Error('Falha ao ler arquivo'));
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => rej(new Error('Imagem inválida'));
        img.onload = () => {
          let {width:w, height:h} = img;
          const orientation = w >= h ? 'landscape' : 'portrait';
          if (w > MAX_PX || h > MAX_PX) {
            if (w > h) { h = Math.round(h*(MAX_PX/w)); w = MAX_PX; }
            else       { w = Math.round(w*(MAX_PX/h)); h = MAX_PX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width=w; canvas.height=h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle='#ffffff';
          ctx.fillRect(0,0,w,h);
          ctx.drawImage(img,0,0,w,h);
          const base64 = canvas.toDataURL('image/jpeg', QUALITY);
          res({ base64, width:w, height:h, orientation, mimeType:'image/jpeg', originalName:file.name });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Open upload modal ────────────────────── */
  function openUploadModal() {
    if (_photos.length >= MAX_PHOTOS) {
      UI.toast(`Máximo de ${MAX_PHOTOS} fotos por relatório.`,'w'); return;
    }
    UI.openModal(`
      <h3 class="gradient-text"><i class="fa fa-camera"></i> Adicionar Fotos</h3>
      <p style="font-size:12px;color:var(--dim);margin-bottom:16px;">
        Até ${MAX_PHOTOS} fotos por relatório. Formatos: JPG, PNG, JPEG.
        ${_photos.length>0?`<strong style="color:var(--accent)">${_photos.length}/${MAX_PHOTOS} fotos adicionadas.</strong>`:''}
      </p>
      <div class="upload-drop-zone" id="photo-drop-zone" onclick="document.getElementById('photo-file-input').click()"
           ondragover="event.preventDefault();this.classList.add('dz-over')"
           ondragleave="this.classList.remove('dz-over')"
           ondrop="Upload._handleDrop(event)">
        <i class="fa fa-cloud-upload-alt"></i>
        <p><strong>Clique ou arraste as fotos aqui</strong></p>
        <p>PNG, JPG, JPEG — máx ${MAX_PHOTOS - _photos.length} foto(s)</p>
        <input type="file" id="photo-file-input" accept="image/png,image/jpeg,image/jpg"
               multiple style="display:none" onchange="Upload._handleFiles(this.files)">
      </div>
      <div style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">Salvar no servidor (Firebase)?</div>
            <div style="font-size:11px;color:var(--dim);margin-top:2px;">Desligado = salva apenas neste dispositivo</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="photo-server" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="mbtns">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Fechar</button>
      </div>`);
  }

  async function _handleFiles(files) {
    const remaining = MAX_PHOTOS - _photos.length;
    const toProcess = Array.from(files).slice(0, remaining);
    if (!toProcess.length) { UI.toast(`Máximo de ${MAX_PHOTOS} fotos atingido.`,'w'); return; }
    UI.loader(true,'Processando imagens...');
    try {
      for (const file of toProcess) {
        const compressed = await _compress(file);
        const saveServer = document.getElementById('photo-server')?.checked ?? true;
        const photo = {
          id:          uid(),
          base64:      compressed.base64,
          caption:     '',
          mimeType:    compressed.mimeType,
          width:       compressed.width,
          height:      compressed.height,
          orientation: compressed.orientation,
          local:       !saveServer,
          relatorioId: null,
          originalName:compressed.originalName,
        };
        _photos.push(photo);
      }
      UI.toast(`${toProcess.length} foto(s) adicionada(s)!`,'s');
      UI.closeModal();
      renderGallery();
    } catch(e) { UI.toast('Erro ao processar imagem: '+e.message,'e'); }
    UI.loader(false);
  }

  function _handleDrop(e) {
    e.preventDefault();
    document.getElementById('photo-drop-zone')?.classList.remove('dz-over');
    _handleFiles(e.dataTransfer.files);
  }

  /* ── Gallery in editor ────────────────────── */
  function renderGallery() {
    const wrap = document.getElementById('photo-gallery-wrap');
    if (!wrap) return;

    if (!_photos.length) {
      wrap.innerHTML = `<div class="photo-empty-state">
        <i class="fa fa-camera" style="font-size:32px;color:var(--border);display:block;margin-bottom:10px;"></i>
        <p style="color:var(--dim);font-size:13px;">Nenhuma foto adicionada.</p>
        <button class="btn btn-secondary btn-sm" onclick="Upload.openUploadModal()" style="margin-top:10px;">
          <i class="fa fa-plus"></i> Adicionar Fotos
        </button>
      </div>`;
      return;
    }

    let html = `<div class="photo-grid">`;
    _photos.forEach((p,i) => {
      html += `<div class="photo-thumb-card">
        <div class="photo-thumb-img-wrap">
          <img src="${p.base64}" alt="Foto ${i+1}" class="photo-thumb-img">
          <div class="photo-thumb-overlay">
            <button class="photo-action-btn" onclick="Upload.removePhoto('${p.id}')" title="Remover">
              <i class="fa fa-trash"></i>
            </button>
            <span class="photo-orient-badge">${p.orientation==='landscape'?'🔄 Paisagem':'📱 Retrato'}</span>
          </div>
        </div>
        <div class="photo-caption-wrap">
          <input type="text" class="photo-caption-input"
                 placeholder="Legenda da foto ${i+1}..."
                 value="${sanitize(p.caption)}"
                 maxlength="100"
                 onchange="Upload.updateCaption('${p.id}',this.value)">
        </div>
        <div class="photo-meta">
          <span>${p.orientation==='landscape'?'Paisagem':'Retrato'}</span>
          <span>${p.local?'💾 Local':'☁ Servidor'}</span>
        </div>
      </div>`;
    });
    html += `</div>`;

    if (_photos.length < MAX_PHOTOS) {
      html += `<button class="btn btn-secondary btn-sm" onclick="Upload.openUploadModal()" style="margin-top:12px;">
        <i class="fa fa-plus"></i> Adicionar mais fotos (${_photos.length}/${MAX_PHOTOS})
      </button>`;
    }
    wrap.innerHTML = html;
  }

  function updateCaption(id, val) {
    const p = _photos.find(x=>x.id===id);
    if (p) p.caption = val.trim().slice(0,100);
  }

  function removePhoto(id) {
    _photos = _photos.filter(p=>p.id!==id);
    renderGallery();
    UI.toast('Foto removida.','w');
  }

  /* ── Save/Load photos ─────────────────────── */
  async function savePhotos(relatorioId) {
    const CU = Auth.getCU();
    for (const p of _photos) {
      p.relatorioId = relatorioId;
      if (p.local) {
        await _idbSave(p);
      } else {
        try {
          // Store in Firestore (base64 < 900KB per doc)
          const sizeKB = Math.round(p.base64.length * 0.75 / 1024);
          if (sizeKB < 900) {
            await fbDB.collection('fotos').doc(p.id).set({
              relatorioId, base64:p.base64, caption:p.caption,
              mimeType:p.mimeType, width:p.width, height:p.height,
              orientation:p.orientation, userId:CU.uid,
              createdAt:serverTS(),
            });
          } else {
            // Too large for Firestore, fallback to local
            p.local = true;
            await _idbSave(p);
            UI.toast('Foto grande salva localmente (>900KB).','w');
          }
        } catch(e) {
          p.local = true;
          await _idbSave(p);
        }
      }
    }
  }

  async function loadPhotos(relatorioId) {
    _photos = [];
    try {
      // From IndexedDB
      const local = await _idbGetByReport(relatorioId);
      _photos = [...local];
    } catch(e) { console.warn('IDB load error:',e); }
    try {
      // From Firestore
      const snap = await fbDB.collection('fotos').where('relatorioId','==',relatorioId).get();
      const firestoreIds = new Set(_photos.map(p=>p.id));
      snap.docs.forEach(d => {
        if (!firestoreIds.has(d.id)) _photos.push({id:d.id,...d.data(), local:false});
      });
    } catch(e) { console.warn('Firestore photos load:',e); }
    renderGallery();
  }

  /* ── Generate A4 photo page (print/PDF) ───── */
  function generatePhotoPage() {
    if (!_photos.length) return '';

    const portrait  = _photos.filter(p=>p.orientation==='portrait');
    const landscape = _photos.filter(p=>p.orientation==='landscape');

    let html = `<div class="photo-page-a4" id="photo-page-a4">
      <div class="photo-page-header">
        <h2>📸 Registro Fotográfico</h2>
        <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
      </div>`;

    // Layout: landscape = 2/row, portrait = 4/row
    // Mixed: arrange in a smart grid
    const cols = landscape.length > portrait.length ? 2 : 4;
    const rowH  = cols === 2 ? '180px' : '150px';

    html += `<div class="photo-page-grid" style="grid-template-columns:repeat(${cols},1fr);">`;
    _photos.forEach((p, i) => {
      html += `<div class="photo-page-item">
        <div class="photo-page-img-wrap" style="height:${rowH};">
          <img src="${p.base64}" alt="Foto ${i+1}" class="photo-page-img">
        </div>
        <div class="photo-page-caption">
          ${p.caption||`Foto ${i+1}`}
        </div>
      </div>`;
    });
    html += `</div></div>`;
    return html;
  }

  function getPhotos()    { return _photos; }
  function setPhotos(arr) { _photos = arr||[]; renderGallery(); }
  function clearPhotos()  { _photos = []; renderGallery(); }

  // expose internal handlers for inline events
  window.Upload = { openUploadModal, removePhoto, updateCaption,
    savePhotos, loadPhotos, generatePhotoPage,
    getPhotos, setPhotos, clearPhotos,
    _handleFiles, _handleDrop };

  return window.Upload;
})();
