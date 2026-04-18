const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// GitHub Config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'zhuowenzhang288-web/Threshold';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== API Routes ==========

// Get notes
app.get('/api/notes', async (req, res) => {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/notes.json?t=${Date.now()}`);
    if (response.ok) {
      const notes = await response.json();
      res.json(notes);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Get notes error:', error);
    res.json([]);
  }
});

// Save notes
app.post('/api/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    
    // Get current SHA
    const shaResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/notes.json`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    let sha = null;
    if (shaResponse.ok) {
      const fileData = await shaResponse.json();
      sha = fileData.sha;
    }
    
    // Update file
    const content = Buffer.from(JSON.stringify(notes, null, 2)).toString('base64');
    
    const updateResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/notes.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update notes via Threshold API',
        content: content,
        sha: sha
      })
    });
    
    if (updateResponse.ok) {
      res.json({ success: true });
    } else {
      const error = await updateResponse.json();
      res.status(500).json({ success: false, error: error.message });
    }
  } catch (error) {
    console.error('Save notes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload PDF
app.post('/api/upload-pdf', async (req, res) => {
  try {
    const { filename, content } = req.body;
    
    if (!filename || !content) {
      return res.status(400).json({ success: false, error: 'Missing filename or content' });
    }
    
    console.log('Uploading PDF:', filename, 'Size:', content.length);
    
    // Upload to GitHub
    const uploadResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/pdfs/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload PDF: ${filename}`,
        content: content
      })
    });
    
    if (uploadResponse.ok) {
      const data = await uploadResponse.json();
      res.json({ 
        success: true, 
        url: data.content.download_url 
      });
    } else {
      const error = await uploadResponse.json();
      console.error('GitHub upload error:', uploadResponse.status, error);
      res.status(500).json({ success: false, error: error.message || 'Upload failed' });
    }
  } catch (error) {
    console.error('Upload PDF error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Threshold backend running on port ${PORT}`);
});
