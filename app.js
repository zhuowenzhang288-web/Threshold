// Data Management
const ADMIN_HASH = 'd2Vud2VuMTIz'; // Base64 encoded password: wenwen123
const GITHUB_TOKEN_HASH = 'Z2hwX2xVMnJpWG1DeXc4cE81WFZONzdyY216N2tpSlpyUTFGMXdvTQ=='; // GitHub Token
const GITHUB_REPO = 'zhuowenzhang288-web/Threshold';
const GITHUB_FILE = 'notes.json';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Decode GitHub Token
function getGitHubToken() {
  try {
    return atob(GITHUB_TOKEN_HASH);
  } catch {
    return null;
  }
}

let notes = [];
let isAdmin = false;

// Verify password
function verifyPassword(input) {
  try {
    return btoa(input) === ADMIN_HASH;
  } catch {
    return false;
  }
}

// Fetch notes from GitHub (via raw.githubusercontent - no CORS)
async function fetchNotesFromGitHub() {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/${GITHUB_FILE}?t=${Date.now()}`);
    if (response.ok) {
      notes = await response.json();
      return true;
    }
  } catch (error) {
    console.error('Failed to fetch notes:', error);
  }
  return false;
}

// Initialize
async function init() {
  const loaded = await fetchNotesFromGitHub();
  if (!loaded) {
    notes = [];
  }
  showHome();
}

// Save notes to GitHub (admin only) - using no-cors mode
async function saveNotesToGitHub() {
  if (!isAdmin) {
    showToast('Please login first');
    return false;
  }
  
  const token = getGitHubToken();
  if (!token) {
    showToast('Token error');
    return false;
  }
  
  try {
    // Step 1: Get current file SHA
    const shaResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!shaResponse.ok) {
      const error = await shaResponse.json();
      showToast('Failed to get file info: ' + (error.message || 'Unknown error'));
      return false;
    }
    
    const fileData = await shaResponse.json();
    const sha = fileData.sha;
    
    // Step 2: Update file
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(notes, null, 2))));
    
    const updateResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
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
      showToast('Saved successfully!');
      // Wait a moment for GitHub to update raw content
      await new Promise(r => setTimeout(r, 2000));
      await fetchNotesFromGitHub();
      return true;
    } else {
      const error = await updateResponse.json();
      console.error('GitHub API error:', error);
      showToast('Save failed: ' + (error.message || 'HTTP ' + updateResponse.status));
      return false;
    }
  } catch (error) {
    console.error('Network error:', error);
    showToast('Save failed: ' + error.message);
    return false;
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  toastMessage.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('hidden');
}

// Get stats
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

// Get categories with count
function getCategories() {
  const count = {};
  notes.forEach(note => {
    count[note.category] = (count[note.category] || 0) + 1;
  });
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}

// Get all tags with count
function getTags() {
  const count = {};
  notes.forEach(note => {
    note.tags.forEach(tag => {
      count[tag] = (count[tag] || 0) + 1;
    });
  });
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}

// Render markdown-like content
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

// Show Home
function showHome() {
  const stats = getStats();
  const categories = getCategories();
  const recentNotes = notes.slice(0, 5);
  
  let notesHtml = notes.map(note => `
    <div class="note-card bg-white rounded-lg border border-gray-200 p-6 mb-6 transition-all duration-300 cursor-pointer" onclick="showNote('${note.id}')">
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <i class="far fa-calendar"></i>
        <span>${note.createdAt}</span>
        <span class="text-gray-300">|</span>
        <a href="#" onclick="event.stopPropagation(); showCategoryNotes('${note.category}')" class="hover:text-blue-600 transition">${note.category}</a>
      </div>
      <h3 class="text-lg font-semibold mb-2 hover:text-blue-600 transition">${note.title}</h3>
      <p class="text-sm text-gray-600 mb-4 line-clamp-3">${note.summary}</p>
      <div class="flex flex-wrap gap-2">
        ${note.tags.map(tag => `
          <a href="#" onclick="event.stopPropagation(); showTagNotes('${tag}')" class="tag-badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <i class="fas fa-tag mr-1 text-xs"></i>${tag}
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');

  document.getElementById('mainContent').innerHTML = `
    <!-- Hero Section -->
    <div class="hero-bg relative h-64 md:h-96">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-white">
        <i class="fas fa-book-open text-5xl mb-4 opacity-90"></i>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">Threshold</h1>
        <p class="text-lg opacity-80">No map, no plan, no worries.</p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
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
            <div class="bg-white rounded-lg border border-gray-200 p-6">
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
            <div class="bg-white rounded-lg border border-gray-200 p-6">
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
            <div class="bg-white rounded-lg border border-gray-200 p-6">
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
            <div class="bg-white rounded-lg border border-gray-200 p-6">
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

// Show Note Detail
function showNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showHome()" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Home
        </a>

        <article>
          <header class="mb-8">
            <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <i class="far fa-calendar"></i>
              <span>${note.createdAt}</span>
              <span class="text-gray-300">|</span>
              <i class="far fa-folder-open"></i>
              <a href="#" onclick="showCategoryNotes('${note.category}')" class="hover:text-blue-600 transition">${note.category}</a>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold mb-4">${note.title}</h1>
            <div class="flex flex-wrap gap-2">
              ${note.tags.map(tag => `
                <a href="#" onclick="showTagNotes('${tag}')" class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                  <i class="fas fa-tag mr-1"></i>${tag}
                </a>
              `).join('')}
            </div>
          </header>

          <div class="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div class="markdown-content text-gray-700">
              ${renderContent(note.content)}
            </div>
          </div>

          ${isAdmin ? `
            <div class="flex gap-4">
              <a href="#" onclick="showEditNote('${note.id}'); return false;" class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition">
                <i class="fas fa-edit mr-2"></i>Edit
              </a>
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

// Show Archives
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
              <div class="bg-white rounded-lg border border-gray-200">
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

// Show Tags
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

        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <div class="flex flex-wrap gap-2">
            ${tags.map(([tag, count]) => `
              <a href="#" onclick="showTagNotes('${tag}')" class="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                ${tag}
                <span class="ml-1 text-gray-500">(${count})</span>
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Show Categories
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
            <a href="#" onclick="showCategoryNotes('${name}')" class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition">
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

// Show About
function showAbout() {
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold mb-8">About</h1>

        <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
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

        <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
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

        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <i class="fas fa-code"></i>Focus Areas
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-blue-500"></div>
              <span class="text-sm">人工智能 / AI</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-purple-500"></div>
              <span class="text-sm">基础数学</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              <span class="text-sm">个人成长</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Show Admin
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
        <div class="bg-white rounded-lg border border-gray-200 p-8">
          <div class="text-center mb-6">
            <div class="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <i class="fas fa-lock text-blue-600 text-xl"></i>
            </div>
            <h2 class="text-xl font-semibold">Admin Login</h2>
          </div>
          <div class="space-y-4">
            <div class="relative">
              <input type="password" id="passwordInput" placeholder="Enter password" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onkeypress="if(event.key==='Enter') doLogin()">
            </div>
            <p id="loginError" class="text-sm text-red-600 hidden">Incorrect password</p>
            <button onclick="doLogin()" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
              Login
            </button>
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

function showAdminPanel() {
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showHome()" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Home
        </a>

        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h2 class="text-xl font-semibold mb-6">New Note</h2>
          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium mb-2">Title</label>
              <input type="text" id="noteTitle" placeholder="Enter note title" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Category</label>
              <input type="text" id="noteCategory" placeholder="Enter category" 
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
              <div id="tagList" class="flex flex-wrap gap-2"></div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Content</label>
              <textarea id="noteContent" placeholder="Write your note here..." rows="12"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"></textarea>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium">Summary</label>
                <button onclick="generateSummary()" class="text-sm text-blue-600 hover:text-blue-700">Auto Generate</button>
              </div>
              <textarea id="noteSummary" placeholder="Brief summary of the note" rows="3"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>

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

let currentTags = [];

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
  document.getElementById('tagList').innerHTML = currentTags.map(tag => `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 cursor-pointer hover:bg-red-100 hover:text-red-700 transition"
      onclick="removeTag('${tag}')">
      ${tag} <i class="fas fa-times ml-1"></i>
    </span>
  `).join('');
}

function generateSummary() {
  const content = document.getElementById('noteContent').value;
  if (content.trim()) {
    document.getElementById('noteSummary').value = content.trim().slice(0, 150) + (content.length > 150 ? '...' : '');
  }
}

async function saveNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  const category = document.getElementById('noteCategory').value.trim() || 'Uncategorized';
  const summary = document.getElementById('noteSummary').value.trim() || content.slice(0, 150) + '...';

  if (!title || !content) {
    showToast('Please fill in title and content');
    return;
  }

  const newNote = {
    id: Date.now().toString(),
    title,
    content,
    summary,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    tags: currentTags,
    category
  };

  notes.unshift(newNote);
  const saved = await saveNotesToGitHub();
  if (saved) {
    currentTags = [];
    showToast('Note published successfully!');
    showHome();
  }
}

async function deleteNote(id) {
  if (confirm('Are you sure you want to delete this note?')) {
    notes = notes.filter(n => n.id !== id);
    const saved = await saveNotesToGitHub();
    if (saved) {
      showToast('Note deleted successfully!');
      showHome();
    }
  }
}

function showEditNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  currentTags = [...note.tags];
  
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showNote('${id}'); return false;" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Note
        </a>

        <div class="bg-white rounded-lg border border-gray-200 p-6">
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

            <div>
              <label class="block text-sm font-medium mb-2">Content</label>
              <textarea id="noteContent" placeholder="Write your note here..." rows="12"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm">${note.content}</textarea>
            </div>

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

function renderEditTags() {
  return currentTags.map(tag => `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 cursor-pointer hover:bg-red-100 hover:text-red-700 transition"
      onclick="removeTag('${tag}')">
      ${tag} <i class="fas fa-times ml-1"></i>
    </span>
  `).join('');
}

async function updateNote(id) {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  const category = document.getElementById('noteCategory').value.trim() || 'Uncategorized';
  const summary = document.getElementById('noteSummary').value.trim() || content.slice(0, 150) + '...';

  if (!title || !content) {
    showToast('Please fill in title and content');
    return;
  }

  const index = notes.findIndex(n => n.id === id);
  if (index !== -1) {
    notes[index] = {
      ...notes[index],
      title,
      content,
      summary,
      category,
      tags: currentTags,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    const saved = await saveNotesToGitHub();
    if (saved) {
      currentTags = [];
      showToast('Note updated successfully!');
      showNote(id);
    }
  }
}

// Show notes by tag
function showTagNotes(tag) {
  const filtered = notes.filter(n => n.tags.includes(tag));
  showFilteredNotes(filtered, `Tag: ${tag}`);
}

// Show notes by category
function showCategoryNotes(category) {
  const filtered = notes.filter(n => n.category === category);
  showFilteredNotes(filtered, `Category: ${category}`);
}

function showFilteredNotes(filtered, title) {
  const notesHtml = filtered.map(note => `
    <div class="note-card bg-white rounded-lg border border-gray-200 p-6 mb-4 transition-all duration-300 cursor-pointer" onclick="showNote('${note.id}')">
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <i class="far fa-calendar"></i>
        <span>${note.createdAt}</span>
        <span class="text-gray-300">|</span>
        <span class="text-blue-600">${note.category}</span>
      </div>
      <h3 class="text-lg font-semibold mb-2 hover:text-blue-600 transition">${note.title}</h3>
      <p class="text-sm text-gray-600 mb-3 line-clamp-2">${note.summary}</p>
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

// Search functionality
function showSearch() {
  document.getElementById('mainContent').innerHTML = `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <a href="#" onclick="showHome()" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <i class="fas fa-arrow-left mr-2"></i>Back to Home
        </a>

        <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h1 class="text-2xl font-bold mb-4 flex items-center gap-2">
            <i class="fas fa-search"></i>Search
          </h1>
          <div class="relative">
            <input type="text" id="searchInput" placeholder="Search articles, tags, categories..." 
              class="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              oninput="performSearch(this.value)"
              onkeypress="if(event.key==='Enter') performSearch(this.value)">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          </div>
          <p class="text-sm text-gray-500 mt-2">Press Enter to search</p>
        </div>

        <div id="searchResults"></div>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const input = document.getElementById('searchInput');
    if (input) input.focus();
  }, 100);
}

function performSearch(query) {
  const resultsContainer = document.getElementById('searchResults');
  
  if (!query.trim()) {
    resultsContainer.innerHTML = '';
    return;
  }
  
  const searchTerm = query.toLowerCase().trim();
  
  const results = notes.filter(note => {
    return note.title.toLowerCase().includes(searchTerm) ||
           note.content.toLowerCase().includes(searchTerm) ||
           note.summary.toLowerCase().includes(searchTerm) ||
           note.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
           note.category.toLowerCase().includes(searchTerm);
  });
  
  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
        <p class="text-gray-500">No results found for "${query}"</p>
      </div>
    `;
    return;
  }
  
  const resultsHtml = results.map(note => `
    <div class="note-card bg-white rounded-lg border border-gray-200 p-6 mb-4 transition-all duration-300 cursor-pointer" onclick="showNote('${note.id}')">
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <i class="far fa-calendar"></i>
        <span>${note.createdAt}</span>
        <span class="text-gray-300">|</span>
        <span class="text-blue-600">${note.category}</span>
      </div>
      <h3 class="text-lg font-semibold mb-2 hover:text-blue-600 transition">${highlightText(note.title, searchTerm)}</h3>
      <p class="text-sm text-gray-600 mb-3 line-clamp-2">${highlightText(note.summary, searchTerm)}</p>
      <div class="flex flex-wrap gap-2">
        ${note.tags.map(tag => `
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <i class="fas fa-tag mr-1 text-xs"></i>${highlightText(tag, searchTerm)}
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');
  
  resultsContainer.innerHTML = `
    <div class="mb-4 text-sm text-gray-500">
      Found ${results.length} result${results.length > 1 ? 's' : ''} for "${query}"
    </div>
    ${resultsHtml}
  `;
}

function highlightText(text, searchTerm) {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  init();
});

// Parallax background blur effect on scroll
window.addEventListener('scroll', () => {
  const parallaxBg = document.getElementById('parallaxBg');
  if (parallaxBg) {
    const scrollY = window.scrollY;
    const heroHeight = window.innerHeight * 0.6;
    if (scrollY > heroHeight * 0.3) {
      parallaxBg.classList.add('blurred');
    } else {
      parallaxBg.classList.remove('blurred');
    }
  }
});
