let editingIndex = -1; // -1 means we are creating a new snippet, not editing

document.addEventListener('DOMContentLoaded', loadSnippets);

// Handle Save / Update
document.getElementById('save').addEventListener('click', () => {
  const title = document.getElementById('title').value.trim();
  const text = document.getElementById('text').value.trim();
  
  if (!title || !text) return;

  chrome.storage.local.get({ snippets: [] }, (data) => {
    const snippets = data.snippets;
    
    if (editingIndex > -1) {
      // Update existing snippet
      snippets[editingIndex] = { title, text };
    } else {
      // Add new snippet
      snippets.push({ title, text });
    }
    
    chrome.storage.local.set({ snippets }, () => {
      resetForm();
      loadSnippets();
    });
  });
});

// Handle Cancel Edit
document.getElementById('cancel').addEventListener('click', resetForm);

// Handle Edit and Delete clicks (using Event Delegation)
document.getElementById('list').addEventListener('click', (e) => {
  const index = parseInt(e.target.getAttribute('data-index'));

  if (e.target.classList.contains('btn-delete')) {
    deleteSnippet(index);
  } else if (e.target.classList.contains('btn-edit')) {
    editSnippet(index);
  }
});

function deleteSnippet(index) {
  if (!confirm('Are you sure you want to delete this snippet?')) return;
  
  chrome.storage.local.get({ snippets: [] }, (data) => {
    const snippets = data.snippets;
    snippets.splice(index, 1); // Remove the item
    
    chrome.storage.local.set({ snippets }, () => {
      // If the user deletes the snippet they are currently editing, reset the form
      if (editingIndex === index) resetForm();
      loadSnippets();
    });
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );
}

function editSnippet(index) {
  chrome.storage.local.get({ snippets: [] }, (data) => {
    const snip = data.snippets[index];
    
    // Populate form with existing data
    document.getElementById('title').value = snip.title;
    document.getElementById('text').value = snip.text;
    
    // Update UI state to "Editing"
    editingIndex = index;
    document.getElementById('form-title').textContent = 'Edit Snippet';
    document.getElementById('save').textContent = 'Update Snippet';
    document.getElementById('cancel').style.display = 'block';
  });
}

function resetForm() {
  editingIndex = -1;
  document.getElementById('title').value = '';
  document.getElementById('text').value = '';
  document.getElementById('form-title').textContent = 'Add New Snippet';
  document.getElementById('save').textContent = 'Save Snippet';
  document.getElementById('cancel').style.display = 'none';
}

function loadSnippets() {
  chrome.storage.local.get({ snippets: [] }, (data) => {
    const list = document.getElementById('list');
    list.innerHTML = '';
    
    if (data.snippets.length === 0) {
      list.innerHTML = '<div style="font-size: 13px; color: #888; text-align: center; margin-top: 20px;">No snippets saved yet.</div>';
      return;
    }

    data.snippets.forEach((snip, index) => {
      const div = document.createElement('div');
      div.className = 'snippet';
      div.innerHTML = `
        <div class="snippet-title">${escapeHTML(snip.title)}</div>
        <div class="snippet-text">${escapeHTML(snip.text)}</div>
        <div class="snippet-actions">
          <button class="btn-small btn-edit" data-index="${index}">Edit</button>
          <button class="btn-small btn-delete" data-index="${index}">Delete</button>
        </div>
      `;
      list.appendChild(div);
    });
  });
}