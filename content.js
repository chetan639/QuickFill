let activeInput = null;
let dropdown = null;
let snippets = [];
let selectedIndex = 0;
let keyBuffer = ''; 

chrome.storage.local.get({ snippets: [] }, (data) => snippets = data.snippets);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.snippets) snippets = changes.snippets.newValue;
});

document.addEventListener('keydown', (e) => {
  if (dropdown) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectedIndex = (selectedIndex + 1) % snippets.length;
      updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectedIndex = (selectedIndex - 1 + snippets.length) % snippets.length;
      updateHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (snippets[selectedIndex]) insertText(snippets[selectedIndex].text);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeDropdown();
    } else if (e.key === ' ' || e.key.length === 1 || e.key === 'Backspace') {
      closeDropdown();
      keyBuffer = ''; 
    }
    return; 
  }

  if (e.key === 'Backspace') {
    keyBuffer = keyBuffer.slice(0, -1);
  } else if (e.key.length === 1) { 
    keyBuffer += e.key;
    if (keyBuffer.length > 5) keyBuffer = keyBuffer.slice(-5);
  }

  // UPDATED: Now triggers on double semicolon
  if (keyBuffer.endsWith(';;')) {
    activeInput = document.activeElement;
    selectedIndex = 0;
    
    setTimeout(() => showDropdown(), 10);
    keyBuffer = ''; 
  }
}, true); 

function showDropdown() {
  closeDropdown();
  if (snippets.length === 0) return;

  dropdown = document.createElement('div');
  dropdown.className = 'quickfill-dropdown';

  if (activeInput && activeInput.tagName !== 'BODY' && activeInput.tagName !== 'HTML') {
    const rect = activeInput.getBoundingClientRect();
    dropdown.style.top = `${window.scrollY + rect.bottom + 5}px`;
    dropdown.style.left = `${window.scrollX + rect.left}px`;
  } else {
    dropdown.style.position = 'fixed';
    dropdown.style.top = '50%';
    dropdown.style.left = '50%';
    dropdown.style.transform = 'translate(-50%, -50%)';
  }

  snippets.forEach((snip, index) => {
    const item = document.createElement('div');
    item.className = 'quickfill-item';
    if (index === selectedIndex) item.classList.add('selected');
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'quickfill-item-title';
    titleDiv.textContent = snip.title;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'quickfill-item-text';
    textDiv.textContent = snip.text;

    item.appendChild(titleDiv);
    item.appendChild(textDiv);

    item.addEventListener('mouseenter', () => {
      selectedIndex = index;
      updateHighlight();
    });

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      insertText(snip.text);
    });

    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
}

function updateHighlight() {
  if (!dropdown) return;
  const items = dropdown.querySelectorAll('.quickfill-item');
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' }); 
    } else {
      item.classList.remove('selected');
    }
  });
}

async function insertText(textToInsert) {
  const isStandardInput = activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA');
  const isRichText = activeInput && activeInput.isContentEditable;

  if (isStandardInput) {
    const currentVal = activeInput.value;
    // UPDATED: Looks for double semicolon to replace
    const replacePos = currentVal.lastIndexOf(';;');
    if (replacePos !== -1) {
      activeInput.value = currentVal.slice(0, replacePos) + textToInsert + currentVal.slice(replacePos + 2);
    } else {
      activeInput.value += textToInsert;
    }
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    
  } else if (isRichText) {
    activeInput.focus();

    // Safely delete the ';;' trigger (2 backspaces)
    document.execCommand('delete', false);
    document.execCommand('delete', false);

    let success = document.execCommand('insertText', false, textToInsert);

    if (!success) {
      try {
        await navigator.clipboard.writeText(textToInsert);
        document.execCommand('paste');
      } catch (err) {
        console.warn("Paste fallback failed");
      }
    }

    activeInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    activeInput.dispatchEvent(new Event('blur', { bubbles: true })); 
    
    activeInput.focus();

  } else {
    try {
      await navigator.clipboard.writeText(textToInsert);
      // UPDATED: Notification text matches the new shortcut
      showToast('Copied! Delete the ";;" and press Paste (Ctrl+V).');
    } catch (err) {
      console.error('Failed to copy snippet: ', err);
    }
  }

  closeDropdown();
  if (activeInput && typeof activeInput.focus === 'function') activeInput.focus();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'quickfill-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function closeDropdown() {
  if (dropdown) {
    dropdown.remove();
    dropdown = null;
  }
}

document.addEventListener('click', (e) => {
  if (dropdown && !dropdown.contains(e.target)) closeDropdown();
});