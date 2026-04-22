// Data Management
const ADMIN_HASH = 'd2Vud2VuMTIz'; // Base64 encoded password: wenwen123
const GITHUB_REPO = 'zhuowenzhang288-web/Threshold';
const GITHUB_FILE = 'notes.json';
const GITHUB_PDFS_DIR = 'pdfs';

let notes = [];
let isAdmin = false;
let cachedSHA = null; // Cache GitHub file SHA to avoid extra requests

// Token management: read from localStorage
function getGitHubToken() {
  return localStorage.getItem('github_token') || '';
}

function setGitHubToken(token) {
  if (token) {
    localStorage.setItem('github_token', token);
  } else {
    localStorage.removeItem('github_token');
  }
}

function hasGitHubToken() {
  return !!getGitHubToken();
}

function saveGitHubToken() {
  const input = document.getElementById('githubTokenInput');
  const token = input.value.trim();
  if (!token) {
    showToast('Please enter a token');
    return;
  }
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    showToast('Invalid token format. Should start with ghp_');
    return;
  }
  setGitHubToken(token);
  showToast('GitHub Token saved!');
  showAdminPanel();
}

function clearGitHubToken() {
  setGitHubToken('');
  showToast('GitHub Token cleared');
  showAdminPanel();
}

// Verify password
function verifyPassword(input) {
  try {
    return btoa(input) === ADMIN_HASH;
  } catch {
    return false;
  }
}

// Verify password
function verifyPassword(input) {
  try {
    return btoa(input) === ADMIN_HASH;
  } catch {
    return false;
  }
}

// Fetch notes from GitHub
async function fetchNotesFromGitHub() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`https://cdn.jsdelivr.net/gh/${GITHUB_REPO}/notes.json?t=${Date.now()}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      notes = await response.json();
      console.log('[fetchNotesFromGitHub] Loaded', notes.length, 'notes');
      return true;
    }
  } catch (error) {
    console.error('[fetchNotesFromGitHub] Failed:', error);
  }
  return false;
}

// Initialize
async function init() {
  const loaded = await fetchNotesFromGitHub();
  if (!loaded || notes.length === 0) {
    // Use a default welcome note if nothing loaded
    notes = [{
      id: 'welcome',
      title: 'Welcome to Threshold',
      category: '随笔',
      tags: ['介绍'],
      type: 'markdown',
      content: 'Welcome to your personal learning notes site! Start by logging in and creating your first note.',
      summary: 'Welcome to your personal learning notes site!',
      createdAt: new Date().toISOString().split('T')[0]
    }];
  }
  showHome();
}

// Upload PDF to GitHub
async function uploadPDFToGitHub(file) {
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onerror = function() {
      showToast('File read error');
      console.error('FileReader error:', reader.error);
      resolve(null);
    };
    
    reader.onload = async function(e) {
      try {
        // Extract base64 from data URL (remove "data:application/pdf;base64," prefix)
        const dataUrl = e.target.result;
        const base64 = dataUrl.split(',')[1];
        
        if (!base64) {
          showToast('File encoding error');
          resolve(null);
          return;
        }
        
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        showToast('Uploading PDF to GitHub...');
        console.log('Uploading PDF:', filename, 'Size:', file.size);
        
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PDFS_DIR}/${filename}`;
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Upload PDF: ${file.name}`,
            content: base64
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Upload successful:', data.content.download_url);
          resolve(data.content.download_url);
        } else {
          const errorText = await response.text();
          console.error('GitHub API error:', response.status, errorText);
          showToast('Upload failed: ' + response.status);
          resolve(null);
        }
      } catch (error) {
        console.error('Upload exception:', error);
        showToast('Upload error: ' + error.message);
        resolve(null);
      }
    };
    
    reader.readAsDataURL(file);
  });
}

// UTF-8 safe base64 encode
function utf8ToBase64(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
}

// Save notes to GitHub (with SHA cache)
async function saveNotesToGitHub() {
  if (!isAdmin) return false;
  
  try {
    let sha = cachedSHA;
    
    // If no cached SHA, fetch it (only first time)
    if (!sha) {
      const shaResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (shaResponse.ok) {
        const fileData = await shaResponse.json();
        sha = fileData.sha;
      }
    }
    
    const content = utf8ToBase64(JSON.stringify(notes, null, 2));
    
    const updateResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update notes from Threshold',
        content: content,
        sha: sha
      })
    });
    
    if (updateResponse.ok) {
      const result = await updateResponse.json();
      cachedSHA = result.content.sha; // Update cached SHA
      return true;
    } else if (updateResponse.status === 409) {
      // SHA conflict, clear cache and retry once
      cachedSHA = null;
      return await saveNotesToGitHub();
    } else {
      let errorMsg = 'HTTP ' + updateResponse.status;
      try { const error = await updateResponse.json(); errorMsg = error.message || errorMsg; } catch (e) {}
      showToast('GitHub error: ' + errorMsg);
      return false;
    }
  } catch (error) {
    showToast('Save failed: ' + error.message);
    return false;
  }
}

// Show Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  toastMessage.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

// Toggle Mobile Menu
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('hidden');
}

// Get Stats
function getStats() {
  const tagsSet = new Set();
  notes.forEach(note => note.tags.forEach(tag => tagsSet.add(tag)));
  const categoriesSet = new Set();
  notes.forEach(note => categoriesSet.add(note.category));
  return {
    totalNotes: notes.length,
    totalTags: tagsSet.size,
    totalCategories: categoriesSet.size
  };
}

// Get Categories
function getCategories() {
  const count = {};
  notes.forEach(note => {
    count[note.category] = (count[note.category] || 0) + 1;
  });
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}

// Get Tags
function getTags() {
  const count = {};
  notes.forEach(note => {
    note.tags.forEach(tag => {
      count[tag] = (count[tag] || 0) + 1;
    });
  });
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}

// Render Markdown Content
function renderContent(content) {
  return content
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/- (.*)/g, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.*)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    });
}

// ========== SHOW HOME ==========
function showHome() {
  const stats = getStats();
  const categories = getCategories();
  const recentNotes = notes.slice(0, 5);
  
  let notesHtml = notes.map(note => {
    const isPDF = note.type === 'pdf';
    return `
    <div class="note-card backdrop-blur-md rounded-lg border border-white/40 p-6 mb-6 transition-all duration-300 cursor-pointer shadow-lg" style="background:rgba(255,255,255,0.88)" style="background:rgba(255,255,255,0.88)" onclick="showNote('${note.id}')">
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <i class="far fa-calendar"></i>
        <span>${note.createdAt}</span>
        <span class="text-gray-300">|</span>
        <span class="text-blue-600">${note.category}</span>
        ${isPDF ? '<span class="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs ml-2"><i class="fas fa-file-pdf mr-1"></i>PDF</span>' : ''}
      </div>
      <h3 class="text-lg font-semibold mb-2 hover:text-blue-600 transition">${note.title}</h3>
      <p class="text-sm text-gray-600 mb-4 line-clamp-3">${isPDF ? '📄 PDF Document - Click to view' : note.summary}</p>
      <div class="flex flex-wrap gap-2">
        ${note.tags.map(tag => `
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <i class="fas fa-tag mr-1 text-xs"></i>${tag}
          </span>
        `).join('')}
      </div>
    </div>
  `}).join('');

  document.getElementById('mainContent').innerHTML = `
    <!-- Hero Section -->
    <!-- Hero Section -->
    <div class="relative" style="height: 100vh; min-height: 500px; margin-top: -56px; padding-top: 56px;">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.08);z-index:0;"></div>
      <div class="relative flex flex-col items-center justify-center text-white" style="z-index:1;height:100%;">
        <i class="fas fa-book-open text-6xl md:text-7xl mb-6 opacity-90"></i>
        <h1 class="text-4xl md:text-6xl font-bold mb-4">Threshold</h1>
        <p class="text-xl md:text-2xl opacity-80">No map, no plan, no worries.</p>
      </div>
      <!-- Scroll Down Indicator -->
      <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce cursor-pointer" style="z-index:1;" onclick="document.querySelector('.content-section').scrollIntoView({behavior: 'smooth'})">
        <i class="fas fa-chevron-down text-2xl opacity-60"></i>
      </div>
    </div>

    <!-- Main Content -->
    <div class="content-section" style="position:relative;">
      <div class="container mx-auto px-4 py-8" style="position:relative;z-index:1;">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Notes List -->
        <div class="lg:col-span-2">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold">Latest Articles</h2>
            <span class="text-sm text-gray-500">${notes.length} articles in total</span>
          </div>
          ${notesHtml || '<p class="text-gray-500 text-center py-8">No notes yet.</p>'}
        </div>

        <!-- Sidebar -->
        <div class="lg:col-span-1">
          <div class="sidebar-sticky space-y-6">
            <!-- Profile -->
            <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
              <div class="flex flex-col items-center text-center">
                <div class="w-20 h-20 rounded-full overflow-hidden mb-4 shadow-md">
                  <img src="bg.jpg" alt="Avatar" class="w-full h-full object-cover">
                </div>
                <h3 class="font-semibold text-lg">Threshold</h3>
                <p class="text-sm text-gray-500 mt-1">No map, no plan, no worries.</p>
                <div class="flex gap-2 mt-4">
                  <a href="https://github.com/zhuowenzhang288-web" target="_blank" class="text-gray-400 hover:text-gray-600 transition"><i class="fab fa-github"></i></a>
                  <a href="https://twitter.com" target="_blank" class="text-gray-400 hover:text-gray-600 transition"><i class="fab fa-twitter"></i></a>
                  <a href="mailto:example@email.com" class="text-gray-400 hover:text-gray-600 transition"><i class="fas fa-envelope"></i></a>
                </div>
              </div>
            </div>

            <!-- Stats -->
            <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
              <h4 class="text-sm font-medium mb-4">Statistics</h4>
              <div class="grid grid-cols-3 gap-4 text-center">
                <a href="#" onclick="showArchives()" class="group">
                  <div class="text-2xl font-bold group-hover:text-blue-600 transition">${stats.totalNotes}</div>
                  <div class="text-xs text-gray-500">Articles</div>
                </a>
                <a href="#" onclick="showTags()" class="group">
                  <div class="text-2xl font-bold group-hover:text-blue-600 transition">${stats.totalTags}</div>
                  <div class="text-xs text-gray-500">Tags</div>
                </a>
                <a href="#" onclick="showCategories()" class="group">
                  <div class="text-2xl font-bold group-hover:text-blue-600 transition">${stats.totalCategories}</div>
                  <div class="text-xs text-gray-500">Categories</div>
                </a>
              </div>
            </div>

            <!-- Recent Posts -->
            <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
              <h4 class="text-sm font-medium mb-4">Recent Posts</h4>
              <div class="space-y-3">
                ${recentNotes.map(note => `
                  <a href="#" onclick="showNote('${note.id}')" class="block group">
                    <div class="text-sm font-medium group-hover:text-blue-600 transition line-clamp-1">${note.title}</div>
                    <div class="text-xs text-gray-500">${note.createdAt}</div>
                  </a>
                `).join('')}
              </div>
            </div>

            <!-- Categories -->
            <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
              <h4 class="text-sm font-medium mb-4">Categories</h4>
              <div class="space-y-2">
                ${categories.map(([name, count]) => `
                  <a href="#" onclick="showCategoryNotes('${name}')" class="flex items-center justify-between group">
                    <div class="flex items-center gap-2">
                      <i class="far fa-folder-open text-gray-400"></i>
                      <span class="text-sm group-hover:text-blue-600 transition">${name}</span>
                    </div>
                    <span class="text-xs text-gray-500">${count}</span>
                  </a>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========== SHOW NOTE DETAIL ==========
function showNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  const isPDF = note.type === 'pdf';

  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-4xl mx-auto">
        <a href="#" onclick="showHome()" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Home
        </a>

        <article>
          <header class="mb-8">
            <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <i class="far fa-calendar"></i>
              <span>${note.createdAt}</span>
              <span class="text-gray-300">|</span>
              <span class="text-blue-600">${note.category}</span>
              ${isPDF ? '<span class="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs ml-2"><i class="fas fa-file-pdf mr-1"></i>PDF</span>' : ''}
            </div>
            <h1 class="text-3xl md:text-4xl font-bold mb-4">${note.title}</h1>
            <div class="flex flex-wrap gap-2">
              ${note.tags.map(tag => `
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                  <i class="fas fa-tag mr-1"></i>${tag}
                </span>
              `).join('')}
            </div>
          </header>

          ${isPDF ? `
            <!-- PDF Preview -->
            <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg mb-8 overflow-hidden" style="background:rgba(255,255,255,0.88)">
              <div class="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700"><i class="fas fa-file-pdf text-red-500 mr-2"></i>PDF Preview</span>
                <div class="flex gap-3">
                  <a href="${note.fileUrl}" target="_blank" class="text-sm text-blue-600 hover:text-blue-700"><i class="fas fa-external-link-alt mr-1"></i>Open</a>
                  <a href="${note.fileUrl}" target="_blank" download class="text-sm text-blue-600 hover:text-blue-700"><i class="fas fa-download mr-1"></i>Download</a>
                </div>
              </div>
              <div class="w-full" style="min-height: 500px; background: #f5f5f5;">
                <embed src="${note.fileUrl}" type="application/pdf" width="100%" height="800px" style="border:none;display:block;" />
              </div>
              <div class="p-4 bg-gray-50 border-t border-gray-200">
                <a href="${note.fileUrl}" target="_blank" class="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                  <i class="fas fa-eye"></i> View Full PDF
                </a>
                <p class="text-xs text-gray-400 text-center mt-2">Tap above if preview is not visible</p>
              </div>
            </div>
          ` : `
            <!-- Markdown Content -->
            <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6 mb-8" style="background:rgba(255,255,255,0.88)">
              <div class="markdown-content text-gray-700">
                ${renderContent(note.content)}
              </div>
            </div>
          `}

          ${isAdmin ? `
            <div class="flex gap-4">
              <button onclick="showEditNote('${note.id}')" class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition">
                <i class="fas fa-edit mr-2"></i>Edit
              </button>
              <button onclick="deleteNote('${note.id}')" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition">
                <i class="fas fa-trash mr-2"></i>Delete
              </button>
            </div>
          ` : ''}
        </article>
      </div>
    </div>
  `;
}

// ========== PDF NAVIGATION HELPERS ==========
function pdfPrevPage(noteId) {
  var fn = window['pdfPrevPage_' + noteId];
  if (fn) fn();
}
function pdfNextPage(noteId) {
  var fn = window['pdfNextPage_' + noteId];
  if (fn) fn();
}

// ========== ADMIN PANEL WITH PDF SUPPORT ==========
let currentTags = [];
let uploadedPDFUrl = null;
let noteType = 'markdown';

function showAdminPanel() {
  uploadedPDFUrl = null;
  noteType = 'markdown';
  currentTags = [];
  const hasToken = hasGitHubToken();
  const tokenStatus = hasToken ? '<span class="text-green-600 text-sm"><i class="fas fa-check-circle mr-1"></i>Token configured</span>' : '<span class="text-yellow-600 text-sm"><i class="fas fa-exclamation-triangle mr-1"></i>Token required for upload</span>';

  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showHome()" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Home
        </a>

        <!-- GitHub Token Configuration -->
        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6 mb-6" style="background:rgba(255,255,255,0.88)">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold"><i class="fab fa-github mr-2"></i>GitHub Token</h3>
            ${tokenStatus}
          </div>
          <p class="text-sm text-gray-500 mb-3">
            To upload PDFs, you need a GitHub Personal Access Token with <code>repo</code> scope.
            <a href="https://github.com/settings/tokens/new?description=Threshold+Notes&scopes=repo" target="_blank" class="text-blue-600 underline">Create one here</a>
          </p>
          <div class="flex gap-2">
            <input type="password" id="githubTokenInput" placeholder="ghp_xxxxxxxxxxxxxxxx" value="${hasToken ? '••••••••••••••••' : ''}"
              class="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono">
            <button onclick="saveGitHubToken()" class="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition text-sm">
              <i class="fas fa-save mr-1"></i>Save
            </button>
            ${hasToken ? `<button onclick="clearGitHubToken()" class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition text-sm"><i class="fas fa-trash mr-1"></i>Clear</button>` : ''}
          </div>
        </div>

        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
          <h2 class="text-xl font-semibold mb-6">New Note</h2>
          
          <!-- Note Type Selector -->
          <div class="mb-6">
            <label class="block text-sm font-medium mb-2">Note Type</label>
            <div class="flex gap-2">
              <button onclick="setNoteType('markdown')" id="btn-markdown" class="flex-1 px-4 py-2 rounded-md border-2 border-blue-500 bg-blue-50 text-blue-700 font-medium transition">
                <i class="fas fa-file-alt mr-2"></i>Markdown
              </button>
              <button onclick="setNoteType('pdf')" id="btn-pdf" class="flex-1 px-4 py-2 rounded-md border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition">
                <i class="fas fa-file-pdf mr-2"></i>PDF Upload
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium mb-2">Title</label>
              <input type="text" id="noteTitle" placeholder="Enter note title" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <!-- Category -->
            <div>
              <label class="block text-sm font-medium mb-2">Category</label>
              <input type="text" id="noteCategory" placeholder="Enter category" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-sm font-medium mb-2">Tags</label>
              <div class="flex gap-2 mb-2">
                <input type="text" id="tagInput" placeholder="Add a tag" 
                  class="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onkeypress="if(event.key==='Enter') addTag()">
                <button onclick="addTag()" class="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 transition">Add</button>
              </div>
              <div id="tagList" class="flex flex-wrap gap-2"></div>
            </div>

            <!-- Markdown Content (shown by default) -->
            <div id="markdown-section">
              <label class="block text-sm font-medium mb-2">Content</label>
              <textarea id="noteContent" placeholder="Write your note here..." rows="12"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"></textarea>
            </div>

            <!-- PDF Upload (hidden by default) -->
            <div id="pdf-section" style="display: none;">
              <label class="block text-sm font-medium mb-2">Upload PDF</label>
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition" 
                onclick="document.getElementById('pdfFile').click()"
                ondrop="handlePDFDrop(event)" 
                ondragover="event.preventDefault()">
                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                <p class="text-gray-600 mb-2">Click or drag PDF here</p>
                <p class="text-sm text-gray-500">Max 50MB</p>
                <input type="file" id="pdfFile" accept=".pdf" class="hidden" onchange="handlePDFSelect(event)">
              </div>
              <div id="pdf-upload-status" class="mt-3 hidden">
                <div class="flex items-center gap-2 text-sm">
                  <i class="fas fa-spinner fa-spin text-blue-600"></i>
                  <span id="pdf-status-text">Uploading...</span>
                </div>
              </div>
              <div id="pdf-preview-name" class="mt-3 hidden">
                <div class="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-md text-sm">
                  <i class="fas fa-check-circle"></i>
                  <span id="pdf-filename"></span>
                </div>
              </div>
            </div>

            <!-- Summary -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium">Summary</label>
                <button onclick="generateSummary()" class="text-sm text-blue-600 hover:text-blue-700">Auto Generate</button>
              </div>
              <textarea id="noteSummary" placeholder="Brief summary of the note" rows="3"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>

            <!-- Actions -->
            <div class="flex gap-4">
              <button onclick="saveNote()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                <i class="fas fa-save mr-2"></i>Publish
              </button>
              <button onclick="showHome()" class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function setNoteType(type) {
  noteType = type;
  const markdownBtn = document.getElementById('btn-markdown');
  const pdfBtn = document.getElementById('btn-pdf');
  const markdownSection = document.getElementById('markdown-section');
  const pdfSection = document.getElementById('pdf-section');
  
  if (type === 'markdown') {
    markdownBtn.className = 'flex-1 px-4 py-2 rounded-md border-2 border-blue-500 bg-blue-50 text-blue-700 font-medium transition';
    pdfBtn.className = 'flex-1 px-4 py-2 rounded-md border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition';
    markdownSection.style.display = 'block';
    pdfSection.style.display = 'none';
  } else {
    pdfBtn.className = 'flex-1 px-4 py-2 rounded-md border-2 border-red-500 bg-red-50 text-red-700 font-medium transition';
    markdownBtn.className = 'flex-1 px-4 py-2 rounded-md border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition';
    markdownSection.style.display = 'none';
    pdfSection.style.display = 'block';
  }
}

function handlePDFSelect(event) {
  const file = event.target.files[0];
  if (file) uploadPDF(file);
}

function handlePDFDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    uploadPDF(file);
  } else {
    showToast('Please upload a PDF file');
  }
}

async function uploadPDF(file) {
  if (file.size > 50 * 1024 * 1024) {
    showToast('File too large. Max 50MB');
    return;
  }

  console.log('Starting PDF upload:', file.name, 'Size:', file.size);
  showToast('Starting PDF upload...');

  const statusEl = document.getElementById('pdf-upload-status');
  const previewEl = document.getElementById('pdf-preview-name');
  
  if (statusEl) statusEl.classList.remove('hidden');
  if (previewEl) previewEl.classList.add('hidden');
  
  const url = await uploadPDFToGitHub(file);
  
  if (statusEl) statusEl.classList.add('hidden');
  
  if (url) {
    uploadedPDFUrl = url;
    console.log('PDF uploaded successfully:', url);
    document.getElementById('pdf-preview-name').classList.remove('hidden');
    document.getElementById('pdf-filename').textContent = file.name;
    showToast('PDF uploaded!');
  }
}

async function saveNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const category = document.getElementById('noteCategory').value.trim() || 'Uncategorized';
  const summary = document.getElementById('noteSummary').value.trim();

  if (!title) {
    showToast('Please enter a title');
    return;
  }

  let noteData = {
    id: Date.now().toString(),
    title,
    category,
    tags: currentTags,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  };

  if (noteType === 'pdf') {
    if (!uploadedPDFUrl) {
      showToast('Please upload a PDF first');
      return;
    }
    noteData.type = 'pdf';
    noteData.fileUrl = uploadedPDFUrl;
    noteData.summary = summary || '📄 PDF Document';
  } else {
    const content = document.getElementById('noteContent').value.trim();
    if (!content) {
      showToast('Please write some content');
      return;
    }
    noteData.type = 'markdown';
    noteData.content = content;
    noteData.summary = summary || content.slice(0, 150) + '...';
  }

  notes.unshift(noteData);
  showHome();
  currentTags = [];
  uploadedPDFUrl = null;
  showToast('Note published!');
  // Sync to GitHub in background (non-blocking)
  saveNotesToGitHub().then(saved => {
    if (saved) console.log('Synced to GitHub');
  });
}

// ========== EDIT NOTE ==========
function showEditNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  currentTags = [...note.tags];
  noteType = note.type || 'markdown';
  uploadedPDFUrl = note.fileUrl || null;

  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showNote('${id}')" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Note
        </a>

        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
          <h2 class="text-xl font-semibold mb-6">Edit Note</h2>
          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium mb-2">Title</label>
              <input type="text" id="noteTitle" value="${note.title}" placeholder="Enter note title" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Category</label>
              <input type="text" id="noteCategory" value="${note.category}" placeholder="Enter category" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Tags</label>
              <div class="flex gap-2 mb-2">
                <input type="text" id="tagInput" placeholder="Add a tag" 
                  class="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onkeypress="if(event.key==='Enter') addTag()">
                <button onclick="addTag()" class="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 transition">Add</button>
              </div>
              <div id="tagList" class="flex flex-wrap gap-2">${renderEditTags()}</div>
            </div>

            ${note.type === 'pdf' ? `
              <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p class="text-sm text-yellow-800">
                  <i class="fas fa-info-circle mr-2"></i>
                  This is a PDF note. PDF file cannot be changed, but you can edit title, category and tags.
                </p>
                <div class="mt-2 flex items-center gap-2 text-sm">
                  <i class="fas fa-file-pdf text-red-500"></i>
                  <a href="${note.fileUrl}" target="_blank" class="text-blue-600 hover:underline">${note.fileUrl.split('/').pop()}</a>
                </div>
              </div>
            ` : `
              <div>
                <label class="block text-sm font-medium mb-2">Content</label>
                <textarea id="noteContent" placeholder="Write your note here..." rows="12"
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm">${note.content}</textarea>
              </div>
            `}

            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium">Summary</label>
                <button onclick="generateSummary()" class="text-sm text-blue-600 hover:text-blue-700">Auto Generate</button>
              </div>
              <textarea id="noteSummary" placeholder="Brief summary of the note" rows="3"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">${note.summary}</textarea>
            </div>

            <div class="flex gap-4">
              <button onclick="updateNote('${id}')" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                <i class="fas fa-save mr-2"></i>Update
              </button>
              <button onclick="showNote('${id}')" class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========== UPDATE NOTE ==========
async function updateNote(id) {
  const title = document.getElementById('noteTitle').value.trim();
  const category = document.getElementById('noteCategory').value.trim() || 'Uncategorized';
  const summary = document.getElementById('noteSummary').value.trim();

  if (!title) {
    showToast('Please enter a title');
    return;
  }

  const index = notes.findIndex(n => n.id === id);
  if (index !== -1) {
    const note = notes[index];
    
    notes[index] = {
      ...note,
      title,
      category,
      tags: currentTags,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    if (note.type !== 'pdf') {
      const content = document.getElementById('noteContent').value.trim();
      if (!content) {
        showToast('Please write some content');
        return;
      }
      notes[index].content = content;
      notes[index].summary = summary || content.slice(0, 150) + '...';
    } else {
      notes[index].summary = summary || '📄 PDF Document';
    }

    showHome();
    showToast('Note updated!');
    // Sync to GitHub in background (non-blocking)
    saveNotesToGitHub().then(saved => {
      if (saved) console.log('Update synced to GitHub');
    });
  }
}

// ========== DELETE NOTE ==========
async function deleteNote(id) {
  if (confirm('Are you sure you want to delete this note?')) {
    notes = notes.filter(n => n.id !== id);
    showHome();
    showToast('Note deleted!');
    // Sync to GitHub in background (non-blocking)
    saveNotesToGitHub().then(saved => {
      if (saved) console.log('Delete synced to GitHub');
    });
  }
}

// ========== OTHER FUNCTIONS ==========
function addTag() {
  const input = document.getElementById('tagInput');
  const tag = input.value.trim();
  if (tag && !currentTags.includes(tag)) {
    currentTags.push(tag);
    renderTags();
    input.value = '';
  }
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTags();
}

function renderTags() {
  const el = document.getElementById('tagList');
  if (el) {
    el.innerHTML = currentTags.map(tag => `
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 cursor-pointer hover:bg-red-100 hover:text-red-700 transition"
        onclick="removeTag('${tag}')">
        ${tag} <i class="fas fa-times ml-1"></i>
      </span>
    `).join('');
  }
}

function renderEditTags() {
  return currentTags.map(tag => `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 cursor-pointer hover:bg-red-100 hover:text-red-700 transition"
      onclick="removeTag('${tag}')">
      ${tag} <i class="fas fa-times ml-1"></i>
    </span>
  `).join('');
}

function generateSummary() {
  const content = document.getElementById('noteContent');
  if (content && content.value.trim()) {
    document.getElementById('noteSummary').value = content.value.trim().slice(0, 150) + (content.value.length > 150 ? '...' : '');
  }
}

// ========== ARCHIVES, TAGS, CATEGORIES ==========
function showArchives() {
  const grouped = {};
  notes.forEach(note => {
    const month = note.createdAt.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(note);
  });

  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-8">
          <i class="fas fa-file-alt text-2xl"></i>
          <h1 class="text-2xl font-bold">Archives</h1>
          <span class="text-gray-500">(${notes.length} articles)</span>
        </div>
        <div class="space-y-6">
          ${sortedMonths.map(month => {
            const [year, mon] = month.split('-');
            return `
              <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg" style="background:rgba(255,255,255,0.88)" style="background:rgba(255,255,255,0.88)">
                <div class="p-4 border-b border-gray-100">
                  <h2 class="text-lg font-semibold flex items-center gap-2">
                    <i class="far fa-calendar"></i>
                    ${monthNames[parseInt(mon) - 1]} ${year}
                    <span class="text-sm font-normal text-gray-500">(${grouped[month].length} articles)</span>
                  </h2>
                </div>
                <div class="p-4">
                  <div class="space-y-3">
                    ${grouped[month].map(note => `
                      <div class="flex items-start gap-4">
                        <span class="text-sm text-gray-500 w-16 shrink-0">${note.createdAt.slice(5)}</span>
                        <a href="#" onclick="showNote('${note.id}')" class="text-sm hover:text-blue-600 transition">${note.title}</a>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function showTags() {
  const tags = getTags();
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-8">
          <i class="fas fa-tags text-2xl"></i>
          <h1 class="text-2xl font-bold">Tags</h1>
          <span class="text-gray-500">(${tags.length} tags)</span>
        </div>
        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
          <div class="flex flex-wrap gap-2">
            ${tags.map(([tag, count]) => `
              <a href="#" onclick="showTagNotes('${tag}')" class="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                ${tag} <span class="ml-1 text-gray-500">(${count})</span>
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function showCategories() {
  const categories = getCategories();
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center gap-3 mb-8">
          <i class="far fa-folder-open text-2xl"></i>
          <h1 class="text-2xl font-bold">Categories</h1>
          <span class="text-gray-500">(${categories.length} categories)</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${categories.map(([name, count]) => `
            <a href="#" onclick="showCategoryNotes('${name}')" class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-4" style="background:rgba(255,255,255,0.88)" style="background:rgba(255,255,255,0.88)" hover:shadow-md transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <i class="far fa-folder-open text-gray-400"></i>
                  <span class="font-medium">${name}</span>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">${count}</span>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function showAbout() {
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold mb-8">About</h1>
        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6 mb-6" style="background:rgba(255,255,255,0.88)">
          <div class="flex flex-col items-center text-center mb-6">
            <div class="w-24 h-24 rounded-full overflow-hidden mb-4">
              <img src="bg.jpg" alt="Avatar" class="w-full h-full object-cover">
            </div>
            <h2 class="text-xl font-semibold">Threshold</h2>
            <p class="text-gray-500 mt-1">No map, no plan, no worries.</p>
          </div>
          <div class="flex justify-center gap-4 mb-6">
            <a href="https://github.com/zhuowenzhang288-web" target="_blank" class="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition">
              <i class="fab fa-github text-lg"></i>
            </a>
            <a href="https://twitter.com" target="_blank" class="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition">
              <i class="fab fa-twitter text-lg"></i>
            </a>
            <a href="mailto:example@email.com" class="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition">
              <i class="fas fa-envelope text-lg"></i>
            </a>
          </div>
        </div>
        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6 mb-6" style="background:rgba(255,255,255,0.88)">
          <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <i class="fas fa-book-open"></i>About This Blog
          </h3>
          <p class="text-gray-600 leading-relaxed mb-4">
            这是我的个人学习笔记网站，专注于记录人工智能、基础数学与个人成长的学习心得。
          </p>
          <p class="text-gray-600 leading-relaxed">
            在这里，你可以找到关于基础数学、AI、个人感悟的文章。我希望通过写作来梳理知识体系，同时也希望能与志同道合的朋友一起进步。
          </p>
        </div>
        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6" style="background:rgba(255,255,255,0.88)">
          <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <i class="fas fa-code"></i>Focus Areas
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-blue-500"></div><span class="text-sm">人工智能 / AI</span></div>
            <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-purple-500"></div><span class="text-sm">基础数学</span></div>
            <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-green-500"></div><span class="text-sm">个人成长</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function showAdmin() {
  if (isAdmin) {
    showAdminPanel();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-md mx-auto">
        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-8" style="background:rgba(255,255,255,0.88)">
          <div class="text-center mb-6">
            <div class="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <i class="fas fa-lock text-blue-600 text-xl"></i>
            </div>
            <h2 class="text-xl font-semibold">Admin Login</h2>
          </div>
          <div class="space-y-4">
            <input type="password" id="passwordInput" placeholder="Enter password" 
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onkeypress="if(event.key==='Enter') doLogin()">
            <p id="loginError" class="text-sm text-red-600 hidden">Incorrect password</p>
            <button onclick="doLogin()" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">Login</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function doLogin() {
  const password = document.getElementById('passwordInput').value;
  if (verifyPassword(password)) {
    isAdmin = true;
    showAdminPanel();
    showToast('Login successful!');
  } else {
    document.getElementById('loginError').classList.remove('hidden');
  }
}

function showTagNotes(tag) {
  const filtered = notes.filter(n => n.tags.includes(tag));
  showFilteredNotes(filtered, `Tag: ${tag}`);
}

function showCategoryNotes(category) {
  const filtered = notes.filter(n => n.category === category);
  showFilteredNotes(filtered, `Category: ${category}`);
}

function showFilteredNotes(filtered, title) {
  const notesHtml = filtered.map(note => `
    <div class="note-card backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6 mb-4 transition-all duration-300 cursor-pointer" style="background:rgba(255,255,255,0.88)" onclick="showNote('${note.id}')">
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <i class="far fa-calendar"></i>
        <span>${note.createdAt}</span>
        <span class="text-gray-300">|</span>
        <span class="text-blue-600">${note.category}</span>
        ${note.type === 'pdf' ? '<span class="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs ml-2"><i class="fas fa-file-pdf mr-1"></i>PDF</span>' : ''}
      </div>
      <h3 class="text-lg font-semibold mb-2 hover:text-blue-600 transition">${note.title}</h3>
      <p class="text-sm text-gray-600 mb-3 line-clamp-2">${note.type === 'pdf' ? '📄 PDF Document' : note.summary}</p>
      <div class="flex flex-wrap gap-2">
        ${note.tags.map(tag => `
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <i class="fas fa-tag mr-1 text-xs"></i>${tag}
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');

  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showHome()" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Home
        </a>
        <div class="flex items-center gap-3 mb-6">
          <h1 class="text-2xl font-bold">${title}</h1>
          <span class="text-gray-500">(${filtered.length} articles)</span>
        </div>
        ${notesHtml || '<p class="text-gray-500 text-center py-8">No notes found.</p>'}
      </div>
    </div>
  `;
}

// Search
function showSearch() {
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showHome()" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Home
        </a>
        <div class="backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6 mb-6" style="background:rgba(255,255,255,0.88)">
          <h1 class="text-2xl font-bold mb-4"><i class="fas fa-search mr-2"></i>Search</h1>
          <div class="relative">
            <input type="text" id="searchInput" placeholder="Search articles, tags, categories..." 
              class="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              oninput="performSearch(this.value)"
              onkeypress="if(event.key==='Enter') performSearch(this.value)">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          </div>
        </div>
        <div id="searchResults"></div>
      </div>
    </div>
  `;
  setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
}

function performSearch(query) {
  const resultsContainer = document.getElementById('searchResults');
  if (!query.trim()) { resultsContainer.innerHTML = ''; return; }
  
  const searchTerm = query.toLowerCase().trim();
  const results = notes.filter(note => {
    return note.title.toLowerCase().includes(searchTerm) ||
           (note.summary && note.summary.toLowerCase().includes(searchTerm)) ||
           note.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
           note.category.toLowerCase().includes(searchTerm);
  });
  
  if (results.length === 0) {
    resultsContainer.innerHTML = `<div class="text-center py-8"><i class="fas fa-search text-4xl text-gray-300 mb-4"></i><p class="text-gray-500">No results found for "${query}"</p></div>`;
    return;
  }
  
  resultsContainer.innerHTML = `
    <div class="mb-4 text-sm text-gray-500">Found ${results.length} result${results.length > 1 ? 's' : ''} for "${query}"</div>
    ${results.map(note => `
      <div class="note-card backdrop-blur-md rounded-lg border border-white/40 shadow-lg p-6 mb-4 cursor-pointer" style="background:rgba(255,255,255,0.88)" onclick="showNote('${note.id}')">
        <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <i class="far fa-calendar"></i><span>${note.createdAt}</span>
          <span class="text-gray-300">|</span><span class="text-blue-600">${note.category}</span>
        </div>
        <h3 class="text-lg font-semibold mb-2">${highlightText(note.title, searchTerm)}</h3>
        <p class="text-sm text-gray-600 line-clamp-2">${note.type === 'pdf' ? '📄 PDF Document' : highlightText(note.summary, searchTerm)}</p>
      </div>
    `).join('')}
  `;
}

function highlightText(text, searchTerm) {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  init();
});

// Parallax scroll effect
window.addEventListener('scroll', () => {
  const parallaxBg = document.getElementById('parallaxBg');
  if (parallaxBg) {
    parallaxBg.classList.toggle('blurred', window.scrollY > window.innerHeight * 0.18);
  }
});
