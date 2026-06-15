// app.js — PDF Merger logic

let files = []; // { file: File, id: string }
let pages = []; // { fileId: string, pageIdx: number, rotation: 0 }
let dragSrcIdx = null;
let pagesDragSrcIdx = null;

let pagesFiles = []; // { file: File, id: string } - for Pages tab
let pagesFilesMode = false; // track if we're using pagesFiles or files

// ── Tab routing ──────────────────────────────────────────────
function showTab(name) {
  document.getElementById('tab-merge').classList.toggle('hidden', name !== 'merge');
  document.getElementById('tab-pages').classList.toggle('hidden', name !== 'pages');
  document.getElementById('tab-split').classList.toggle('hidden', name !== 'split');
  document.getElementById('tab-history').classList.toggle('hidden', name !== 'history');
  
  document.querySelectorAll('.nav-link').forEach((el, i) => {
    el.classList.toggle('active', 
      (i === 0 && name === 'merge') || 
      (i === 1 && name === 'pages') || 
      (i === 2 && name === 'split') ||
      (i === 3 && name === 'history'));
  });
  
  if (name === 'pages') renderPages();
  if (name === 'split') renderSplit();
  if (name === 'history') renderHistory();
}

// ── File input ───────────────────────────────────────────────
document.getElementById('fileInput').addEventListener('change', (e) => {
  addFiles([...e.target.files]);
  e.target.value = ''; // reset so same file can be re-added
});

function addFiles(newFiles) {
  const pdfs = newFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
  if (!pdfs.length) return;
  pdfs.forEach(f => files.push({ file: f, id: crypto.randomUUID() }));
  renderFileList();
}

// ── Drag & drop on dropzone ──────────────────────────────────
const dropzone = document.getElementById('dropzone');

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files]);
});

// ── Pages Tab File Input ────────────────────────────────────
document.getElementById('pagesFileInput').addEventListener('change', (e) => {
  addPagesFiles([...e.target.files]);
  e.target.value = '';
});

function addPagesFiles(newFiles) {
  const pdfs = newFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
  if (!pdfs.length) return;
  pdfs.forEach(f => pagesFiles.push({ file: f, id: crypto.randomUUID() }));
  pagesFilesMode = true;
  extractPagesFromFiles();
  renderPages();
}

// ── Drag & drop on pages dropzone ──────────────────────────
const pagesDropzone = document.getElementById('pages-dropzone');

pagesDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  pagesDropzone.classList.add('drag-over');
});

pagesDropzone.addEventListener('dragleave', () => pagesDropzone.classList.remove('drag-over'));

pagesDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  pagesDropzone.classList.remove('drag-over');
  addPagesFiles([...e.dataTransfer.files]);
});

// ── Render file list ─────────────────────────────────────────
function renderFileList() {
  const section = document.getElementById('file-list-section');
  const list = document.getElementById('file-list');
  const count = document.getElementById('file-count');

  if (!files.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  count.textContent = files.length;

  list.innerHTML = files.map((item, idx) => `
    <li class="file-item"
        draggable="true"
        data-idx="${idx}"
        ondragstart="onDragStart(event,${idx})"
        ondragover="onDragOver(event,${idx})"
        ondrop="onDropItem(event,${idx})"
        ondragend="onDragEnd()">
      <span class="drag-handle">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="4" cy="4" r="1.2" fill="#ccc"/>
          <circle cx="4" cy="10" r="1.2" fill="#ccc"/>
          <circle cx="10" cy="4" r="1.2" fill="#ccc"/>
          <circle cx="10" cy="10" r="1.2" fill="#ccc"/>
        </svg>
      </span>
      <div class="file-icon">PDF</div>
      <div class="file-info">
        <div class="file-name" title="${escHtml(item.file.name)}">${escHtml(item.file.name)}</div>
        <div class="file-size">${formatSize(item.file.size)}</div>
      </div>
      <span class="file-order">${idx + 1}</span>
      <button class="btn-remove" title="Remove" onclick="removeFile('${item.id}')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </li>
  `).join('');

  extractPages();
}

function removeFile(id) {
  files = files.filter(f => f.id !== id);
  renderFileList();
}

function clearFiles() {
  files = [];
  renderFileList();
  setStatus('');
}

function removePagesFile(id) {
  pagesFiles = pagesFiles.filter(f => f.id !== id);
  extractPagesFromFiles();
  renderPages();
}

function clearPagesFiles() {
  pagesFiles = [];
  pages = [];
  renderPages();
}
// ── Drag-to-reorder (within list) ────────────────────────────
function onDragStart(e, idx) {
  dragSrcIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.classList.add('dragging'), 0);
}

function onDragOver(e, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.file-item').forEach((el, i) => {
    el.classList.toggle('drag-target', i === idx && i !== dragSrcIdx);
  });
}

function onDropItem(e, idx) {
  e.preventDefault();
  if (dragSrcIdx === null || dragSrcIdx === idx) return;
  const moved = files.splice(dragSrcIdx, 1)[0];
  files.splice(idx, 0, moved);
  dragSrcIdx = null;
  renderFileList();
}

function onDragEnd() {
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.remove('dragging', 'drag-target');
  });
  dragSrcIdx = null;
}

// ── Extract and render pages ─────────────────────────────────
async function extractPages() {
  pages = [];
  for (const item of files) {
    try {
      const buf = await item.file.arrayBuffer();
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.load(buf);
      const pageCount = doc.getPageCount();
      for (let i = 0; i < pageCount; i++) {
        pages.push({ fileId: item.id, pageIdx: i, rotation: 0 });
      }
    } catch (err) {
      console.error('Failed to load PDF:', err);
    }
  }
}

async function extractPagesFromFiles() {
  pages = [];
  const sourceFiles = pagesFilesMode ? pagesFiles : files;
  for (const item of sourceFiles) {
    try {
      const buf = await item.file.arrayBuffer();
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.load(buf);
      const pageCount = doc.getPageCount();
      for (let i = 0; i < pageCount; i++) {
        pages.push({ fileId: item.id, pageIdx: i, rotation: 0 });
      }
    } catch (err) {
      console.error('Failed to load PDF:', err);
    }
  }
}
async function renderPages() {
  const container = document.getElementById('pages-container');
  const empty = document.getElementById('pages-empty');

  const sourceFiles = pagesFilesMode ? pagesFiles : files;
  if (!sourceFiles.length) {
    container.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.classList.remove('hidden');

  container.innerHTML = '';

  for (const file of sourceFiles) {
    const filePages = pages.filter(p => p.fileId === file.id);
    if (!filePages.length) continue;

    const group = document.createElement('div');
    group.className = 'pdf-pages-group';
    
    const header = document.createElement('div');
    header.className = 'pdf-pages-header';
    header.innerHTML = `
      <span>${escHtml(file.file.name)}</span>
      <div class="pdf-pages-header-actions">
        <button class="btn-secondary" onclick="rotatePdfPages('${file.id}', 90)">Rotate All +90°</button>
        <button class="btn-secondary" onclick="deletePdfPages('${file.id}')">Delete All</button>
      </div>
    `;
    group.appendChild(header);

    if (pagesFilesMode) {
      header.innerHTML = `
        <span>${escHtml(file.file.name)}</span>
        <div class="pdf-pages-header-actions">
          <button class="btn-secondary" onclick="rotatePdfPages('${file.id}', 90)">Rotate All +90°</button>
          <button class="btn-secondary" onclick="deletePdfPages('${file.id}')">Delete All</button>
          <button class="btn-secondary danger" onclick="removePagesFile('${file.id}')">Remove File</button>
        </div>
      `;
    }
    const grid = document.createElement('div');
    grid.className = 'pages-grid';

    for (let i = 0; i < filePages.length; i++) {
      const page = filePages[i];
      const pageNum = pages.indexOf(page);
      
      const item = document.createElement('div');
      item.className = 'page-item';
      item.draggable = true;
      item.dataset.pageIdx = pageNum;
      
      item.addEventListener('dragstart', (e) => {
        pagesDragSrcIdx = pageNum;
        setTimeout(() => e.target.closest('.page-item').classList.add('dragging'), 0);
      });
      
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (pagesDragSrcIdx !== pageNum) {
          item.classList.add('drag-target');
        }
      });
      
      item.addEventListener('dragleave', (e) => {
        item.classList.remove('drag-target');
      });
      
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (pagesDragSrcIdx !== null && pagesDragSrcIdx !== pageNum) {
          const moved = pages.splice(pagesDragSrcIdx, 1)[0];
          const newIdx = pages.indexOf(page);
          pages.splice(newIdx, 0, moved);
          pagesDragSrcIdx = null;
          renderPages();
        }
      });
      
      item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging', 'drag-target');
        pagesDragSrcIdx = null;
      });

      const thumb = document.createElement('div');
      thumb.className = 'page-thumbnail';
      renderPageThumbnail(file.file, page.pageIdx, page.rotation, thumb);
      item.appendChild(thumb);

      const controls = document.createElement('div');
      controls.className = 'page-controls';
      controls.innerHTML = `
        <div class="page-number">Page ${i + 1}</div>
        <div class="page-buttons">
          <button class="btn-icon" title="Rotate 90°" onclick="rotatePage(${pageNum}, 90)">↻90°</button>
          <button class="btn-icon" title="Rotate 180°" onclick="rotatePage(${pageNum}, 180)">↻180°</button>
          <button class="btn-icon danger" title="Delete" onclick="deletePage(${pageNum})">✕</button>
        </div>
      `;
      item.appendChild(controls);

      grid.appendChild(item);
    }

    group.appendChild(grid);
    container.appendChild(group);
  }
}

async function renderPageThumbnail(file, pageIdx, rotation, container) {
  try {
    const buf = await file.arrayBuffer();
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(buf);
    const page = doc.getPage(pageIdx);
    const { width, height } = page.getSize();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 100 / width;
    canvas.width = width * scale;
    canvas.height = height * scale;

    await renderPageToCanvas(doc, pageIdx, canvas);
    
    if (rotation !== 0) {
      const rotCanvas = document.createElement('canvas');
      const rotCtx = rotCanvas.getContext('2d');
      
      if (rotation === 90 || rotation === 270) {
        rotCanvas.width = canvas.height;
        rotCanvas.height = canvas.width;
      } else {
        rotCanvas.width = canvas.width;
        rotCanvas.height = canvas.height;
      }
      
      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate((rotation * Math.PI) / 180);
      rotCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      canvas = rotCanvas;
    }

    container.innerHTML = '';
    container.appendChild(canvas);
  } catch (err) {
    console.error('Failed to render thumbnail:', err);
    container.innerHTML = 'Error';
  }
}

async function renderPageToCanvas(doc, pageIdx, canvas) {
  const page = doc.getPage(pageIdx);
  const { width, height } = page.getSize();
  const scale = canvas.width / width;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '12px Arial';
  ctx.fillStyle = '#999';
  ctx.textAlign = 'center';
  ctx.fillText('Page ' + (pageIdx + 1), canvas.width / 2, canvas.height / 2);
}

function rotatePage(pageIdx, degrees) {
  if (pages[pageIdx]) {
    pages[pageIdx].rotation = (pages[pageIdx].rotation + degrees) % 360;
    renderPages();
  }
}

function deletePage(pageIdx) {
  pages.splice(pageIdx, 1);
  renderPages();
}

function rotatePdfPages(fileId, degrees) {
  pages.forEach(p => {
    if (p.fileId === fileId) {
      p.rotation = (p.rotation + degrees) % 360;
    }
  });
  renderPages();
}

function deletePdfPages(fileId) {
  if (confirm(`Delete all pages from this PDF? This cannot be undone.`)) {
    pages = pages.filter(p => p.fileId !== fileId);
    renderPages();
  }
}

// ── Split PDF ────────────────────────────────────────────────
async function renderSplit() {
  const container = document.getElementById('split-container');
  const empty = document.getElementById('split-empty');

  const sourceFiles = pagesFilesMode ? pagesFiles : files;
  if (!sourceFiles.length) {
    container.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.classList.remove('hidden');

  container.innerHTML = sourceFiles.map((file, idx) => {
    const pageCount = pages.filter(p => p.fileId === file.id).length;
    return `
      <div class="split-file-card">
        <div class="split-file-header">${escHtml(file.file.name)} (${pageCount} pages)</div>
        <div class="split-options">
          <label class="split-option">
            <input type="radio" name="split-${idx}" value="all" checked onchange="updateSplitOptions(${idx})"/>
            <span>Split all pages</span>
          </label>
          <label class="split-option">
            <input type="radio" name="split-${idx}" value="range" onchange="updateSplitOptions(${idx})"/>
            <span>Split range</span>
          </label>
        </div>
        <div id="split-range-${idx}" class="split-range hidden">
          <span>Pages</span>
          <input type="number" id="split-from-${idx}" min="1" max="${pageCount}" value="1" placeholder="From"/>
          <span>to</span>
          <input type="number" id="split-to-${idx}" min="1" max="${pageCount}" value="${pageCount}" placeholder="To"/>
        </div>
        <div class="split-actions">
          <button class="btn-secondary" onclick="splitPdf(${idx})">Split PDF</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateSplitOptions(idx) {
  const rangeDiv = document.getElementById(`split-range-${idx}`);
  const isRange = document.querySelector(`input[name="split-${idx}"]:checked`).value === 'range';
  rangeDiv.classList.toggle('hidden', !isRange);
}

async function splitPdf(fileIdx) {
  const sourceFiles = pagesFilesMode ? pagesFiles : files;
  const file = sourceFiles[fileIdx];
  const pageCount = pages.filter(p => p.fileId === file.id).length;
  const isRange = document.querySelector(`input[name="split-${fileIdx}"]:checked`).value === 'range';
  let fromPage = 0, toPage = pageCount - 1;

  if (isRange) {
    fromPage = parseInt(document.getElementById(`split-from-${fileIdx}`).value) - 1;
    toPage = parseInt(document.getElementById(`split-to-${fileIdx}`).value) - 1;
    
    if (isNaN(fromPage) || isNaN(toPage) || fromPage < 0 || toPage >= pageCount || fromPage > toPage) {
      setStatus('Invalid page range', 'error');
      return;
    }
  }

  setStatus('Splitting PDF…', 'loading');

  try {
    const buf = await file.file.arrayBuffer();
    const { PDFDocument } = PDFLib;
    const sourceDoc = await PDFDocument.load(buf);
    const baseFileName = file.file.name.replace('.pdf', '');

    for (let i = fromPage; i <= toPage; i++) {
      const pdf = await PDFDocument.create();
      const pages = await pdf.copyPages(sourceDoc, [i]);
      pages.forEach(p => pdf.addPage(p));

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const outName = `${baseFileName}_page-${i + 1}.pdf`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);
    }

    const pageCount2 = toPage - fromPage + 1;
    setStatus(`✓ Split ${pageCount2} page${pageCount2 > 1 ? 's' : ''} into separate files`, 'success');
  } catch (err) {
    console.error(err);
    setStatus('Failed to split PDF: ' + err.message, 'error');
  }
}
async function mergePDFs() {
  const sourceFiles = pagesFilesMode ? pagesFiles : files;

  if (sourceFiles.length < 1 || pages.length === 0) {
    setStatus('Add at least 1 PDF file with pages to merge.', 'error');
    return;
  }

  const btn = document.getElementById('merge-btn');
  const label = document.getElementById('merge-label');
  btn.disabled = true;
  label.textContent = 'Merging…';
  setStatus('Merging your PDFs…', 'loading');

  try {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();

    // Map fileId to PDFDocument to reuse loaded docs
    const docCache = {};
    for (const item of sourceFiles) {
      if (!docCache[item.id]) {
        const buf = await item.file.arrayBuffer();
        docCache[item.id] = await PDFDocument.load(buf);
      }
    }

    // Add pages in order, respecting rotations and deletions
    for (const pageInfo of pages) {
      const sourceDoc = docCache[pageInfo.fileId];
      const sourcePages = await merged.copyPages(sourceDoc, [pageInfo.pageIdx]);
      const copiedPage = sourcePages[0];

      // Apply rotation
      if (pageInfo.rotation !== 0) {
        copiedPage.setRotation(copiedPage.getRotation() + pageInfo.rotation);
      }

      merged.addPage(copiedPage);
    }

    const pdfBytes = await merged.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    // Download
    const outName = (document.getElementById('output-name').value.trim() || 'merged') + '.pdf';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    a.click();
    URL.revokeObjectURL(url);

    // Save to IndexedDB
    const totalPages = merged.getPageCount();
    const base64 = await blobToBase64(blob);
    await dbSave({
      name: outName,
      size: pdfBytes.byteLength,
      pages: totalPages,
      sources: sourceFiles.map(f => f.file.name),
      data: base64,
      createdAt: Date.now(),
    });

    setStatus(`✓ Merged ${pages.length} pages into ${outName} (${totalPages} pages, ${formatSize(pdfBytes.byteLength)})`, 'success');
  } catch (err) {
    console.error(err);
    setStatus('Something went wrong: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Merge PDFs';
  }
}

// ── History ──────────────────────────────────────────────────
async function renderHistory() {
  const container = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  container.innerHTML = '';

  let records;
  try {
    records = await dbGetAll();
  } catch (e) {
    container.innerHTML = '<p class="empty-state">Could not load history.</p>';
    return;
  }

  records.sort((a, b) => b.createdAt - a.createdAt);

  if (!records.length) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.innerHTML = records.map(r => `
    <div class="history-card">
      <div class="history-icon">PDF</div>
      <div class="history-info">
        <div class="history-name">${escHtml(r.name)}</div>
        <div class="history-meta">
          ${r.pages} pages · ${formatSize(r.size)} · ${formatDate(r.createdAt)}<br/>
          <span style="color:#bbb">${r.sources.map(escHtml).join(', ')}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="btn-dl" onclick="downloadRecord(${r.id})">Download</button>
        <button class="btn-del" onclick="deleteRecord(${r.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function downloadRecord(id) {
  const records = await dbGetAll();
  const r = records.find(x => x.id === id);
  if (!r) return;
  const bytes = base64ToBytes(r.data);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = r.name;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteRecord(id) {
  await dbDelete(id);
  renderHistory();
}

// ── Helpers ──────────────────────────────────────────────────
function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  if (!msg) { el.classList.add('hidden'); return; }
  el.textContent = msg;
  el.className = 'status ' + type;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
