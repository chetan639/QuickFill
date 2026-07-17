// =====================================================================
// QuickFill Content Script - v3.0
// =====================================================================
// LinkedIn uses contenteditable divs where:
//  - The 'input' event fires from INNER child nodes (p, span, br),
//    not the contenteditable root — so e.target is wrong
//  - textContent includes invisible Unicode/ZWS chars from LinkedIn's
//    editor, so endsWith(';;') fails
//  - Some boxes (messaging) live inside same-origin iframes
//  - The dropdown must use position:fixed + viewport coords to escape
//    all CSS stacking contexts (z-index alone is not enough)
//
// FIX STRATEGY:
//  1. On 'input': walk up from e.target to find the contenteditable root
//  2. Read innerText (not textContent) — strips invisible chars
//  3. Dual detection: input event + keydown buffer as fallback
//  4. Dropdown always uses position:fixed with getBoundingClientRect()
//     viewport coords (no scrollY offset needed for fixed positioning)
//  5. MutationObserver + iframe attachment for messaging panels
//  6. Guard against attaching listeners to the same document twice
// =====================================================================

let activeInput = null;
let dropdown = null;
let snippets = [];
let selectedIndex = 0;
let keyBuffer = '';

// Track which documents we've already attached to (prevents double-attaching)
const attachedDocs = new WeakSet();

// Load snippets from storage
chrome.storage.local.get({ snippets: [] }, (data) => {
  snippets = data.snippets || [];
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.snippets) snippets = changes.snippets.newValue || [];
});

// =====================================================================
// HELPERS
// =====================================================================

// Walk up from el to find the nearest ancestor-or-self with an EXPLICIT
// contenteditable="true" attribute (not just inherited isContentEditable).
// isContentEditable is inherited by ALL children of a contenteditable div,
// so checking the attribute directly finds the real editor root.
function getContentEditableRoot(el) {
  if (!el) return null;
  // Use documentElement as the stop boundary — safe even when el IS body.
  const docEl = el.ownerDocument?.documentElement || document.documentElement;
  let node = el;

  // Pass 1: look for an element with an explicit contenteditable attribute
  while (node && node !== docEl) {
    if (node.getAttribute) {
      const ce = node.getAttribute('contenteditable');
      // 'true' is the standard value; '' matches <div contenteditable>
      if (ce === 'true' || ce === '') return node;
    }
    node = node.parentElement;
  }

  // Pass 2: fallback — accept inherited isContentEditable
  // (for editors that set the property programmatically without the attribute)
  node = el;
  while (node && node !== docEl) {
    if (node.isContentEditable) return node;
    node = node.parentElement;
  }

  return null;
}

// Get the visible text of an element (innerText strips invisible chars & <br>)
function getElementText(el) {
  if (!el) return '';
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    return el.value || '';
  }
  // innerText is layout-dependent but accurate for visible characters.
  // Falls back to textContent if innerText is not available.
  return (typeof el.innerText !== 'undefined' ? el.innerText : el.textContent) || '';
}

// Trigger the dropdown if the user just typed ';;'
function checkAndTrigger(el) {
  if (dropdown) return;
  if (!el) return;
  const text = getElementText(el);
  // Some editors append a trailing newline; trim only the right side
  if (text.trimEnd().endsWith(';;')) {
    selectedIndex = 0;
    setTimeout(() => showDropdown(), 10);
  }
}

// =====================================================================
// ATTACH LISTENERS TO A DOCUMENT
// =====================================================================
function attachListenersToDocument(doc) {
  if (attachedDocs.has(doc)) return; // already attached
  attachedDocs.add(doc);

  // --- FOCUS: track which input is active ---
  doc.addEventListener('focus', (e) => {
    const el = e.target;
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      activeInput = el;
      keyBuffer = '';
    } else {
      const root = getContentEditableRoot(el);
      if (root) {
        activeInput = root;
        keyBuffer = '';
      }
    }
  }, true);

  // --- INPUT EVENT: primary detection ---
  // LinkedIn fires 'input' from inner child nodes, not the contenteditable root.
  // We walk up to find the real root before reading text.
  doc.addEventListener('input', (e) => {
    const el = e.target;
    if (!el) return;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      activeInput = el;
      checkAndTrigger(el);
    } else {
      const root = getContentEditableRoot(el);
      if (root) {
        activeInput = root;
        checkAndTrigger(root);
      }
    }
  }, true);

  // --- KEYDOWN: secondary detection (keyBuffer) + dropdown navigation ---
  doc.addEventListener('keydown', (e) => {

    // --- Dropdown navigation ---
    if (dropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        const len = snippets?.length || 0;
        if (len) { selectedIndex = (selectedIndex + 1) % len; updateHighlight(); }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        const len = snippets?.length || 0;
        if (len) { selectedIndex = (selectedIndex - 1 + len) % len; updateHighlight(); }
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (snippets?.[selectedIndex]) insertText(snippets[selectedIndex].text);
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        closeDropdown();
      } else if (e.key === ' ' || e.key === 'Backspace') {
        closeDropdown();
        keyBuffer = '';
      }
      return;
    }

    // --- Fallback keydown buffer: catches editors where 'input' doesn't fire ---
    if (e.key === 'Backspace') {
      keyBuffer = keyBuffer.slice(0, -1);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      keyBuffer += e.key;
      if (keyBuffer.length > 5) keyBuffer = keyBuffer.slice(-5);
      if (keyBuffer.endsWith(';;')) {
        // Capture the active element right now.
        // doc.activeElement can be an outer wrapper div in LinkedIn's compose
        // overlay, so we walk up from e.target (the element that received the
        // keydown) which is more accurate than doc.activeElement.
        const focused = e.target || doc.activeElement;
        if (focused && focused !== doc.body && focused !== doc.documentElement) {
          const root = getContentEditableRoot(focused);
          if (root) {
            activeInput = root;
          } else if (!activeInput) {
            // Last resort: use focused element itself
            activeInput = focused;
          }
          // If activeInput was already set by a prior focus/input event, keep it
        }
        selectedIndex = 0;
        keyBuffer = '';
        setTimeout(() => showDropdown(), 10);
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      keyBuffer = '';
    }
  }, true);

  // --- CLICK: close dropdown when clicking outside ---
  doc.addEventListener('click', (e) => {
    if (dropdown && !dropdown.contains(e.target)) closeDropdown();
  }, true);
}

// =====================================================================
// IFRAME SUPPORT
// =====================================================================
function tryAttachToIframe(iframe) {
  try {
    const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iDoc) return;
    if (iDoc.readyState === 'loading') {
      iDoc.addEventListener('DOMContentLoaded', () => attachListenersToDocument(iDoc));
    } else {
      attachListenersToDocument(iDoc);
    }
  } catch (err) {
    // Cross-origin iframe — cannot access, skip silently
  }
}

function observeForIframes(targetNode) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IFRAME') {
          node.addEventListener('load', () => tryAttachToIframe(node));
          tryAttachToIframe(node);
        }
        node.querySelectorAll?.('iframe')?.forEach((iframe) => {
          iframe.addEventListener('load', () => tryAttachToIframe(iframe));
          tryAttachToIframe(iframe);
        });
      }
    }
  });
  observer.observe(targetNode, { childList: true, subtree: true });
}

// =====================================================================
// BOOTSTRAP
// =====================================================================
attachListenersToDocument(document);
observeForIframes(document.body || document.documentElement);
document.querySelectorAll('iframe').forEach((iframe) => {
  iframe.addEventListener('load', () => tryAttachToIframe(iframe));
  tryAttachToIframe(iframe);
});

// =====================================================================
// DROPDOWN UI — uses position:fixed so it escapes ALL stacking contexts
// =====================================================================
function showDropdown() {
  closeDropdown();
  if (!snippets?.length) return;
  if (!activeInput) return;

  dropdown = document.createElement('div');
  dropdown.className = 'quickfill-dropdown';

  // Use viewport coordinates (getBoundingClientRect) with position:fixed.
  // This is the ONLY reliable way to appear above LinkedIn's layered UI.
  const rect = activeInput.getBoundingClientRect();

  // Account for activeInput being inside an iframe
  let iframeOffsetX = 0;
  let iframeOffsetY = 0;
  try {
    const ownerDoc = activeInput.ownerDocument;
    if (ownerDoc !== document) {
      document.querySelectorAll('iframe').forEach((iframe) => {
        try {
          if (iframe.contentDocument === ownerDoc || iframe.contentWindow?.document === ownerDoc) {
            const ir = iframe.getBoundingClientRect();
            iframeOffsetX = ir.left;
            iframeOffsetY = ir.top;
          }
        } catch (_) {}
      });
    }
  } catch (_) {}

  const top = rect.bottom + iframeOffsetY + 5;
  const left = rect.left + iframeOffsetX;

  // Keep dropdown within viewport horizontally
  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;

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

    item.addEventListener('mouseenter', () => { selectedIndex = index; updateHighlight(); });
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      insertText(snip.text);
    });

    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
}

function updateHighlight() {
  if (!dropdown) return;
  dropdown.querySelectorAll('.quickfill-item').forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// =====================================================================
// TEXT INSERTION
// =====================================================================
async function insertText(textToInsert) {
  if (!activeInput) { closeDropdown(); return; }

  const isStandardInput = activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA';
  const isRichText = activeInput.isContentEditable;
  const ownerDoc = activeInput.ownerDocument || document;

  if (isStandardInput) {
    activeInput.focus();
    const currentVal = activeInput.value;
    const replacePos = currentVal.lastIndexOf(';;');
    if (replacePos !== -1) {
      activeInput.value = currentVal.slice(0, replacePos) + textToInsert + currentVal.slice(replacePos + 2);
    } else {
      activeInput.value += textToInsert;
    }
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));

  } else if (isRichText) {
    activeInput.focus();

    const selection = ownerDoc.getSelection();
    if (selection) {
      selection.collapseToEnd();
      selection.modify('extend', 'backward', 'character');
      selection.modify('extend', 'backward', 'character');
    }

    let success = ownerDoc.execCommand('insertText', false, textToInsert);

    if (!success) {
      try {
        await navigator.clipboard.writeText(textToInsert);
        ownerDoc.execCommand('paste');
      } catch (err) {
        console.warn('QuickFill: paste fallback failed', err);
      }
    }

    activeInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

  } else {
    try {
      await navigator.clipboard.writeText(textToInsert);
      showToast('Copied! Delete the ";;" and press Ctrl+V to paste.');
    } catch (err) {
      console.error('QuickFill: clipboard write failed', err);
    }
  }

  closeDropdown();

  if (activeInput && typeof activeInput.focus === 'function') {
    activeInput.focus();
    ownerDoc.getSelection?.()?.collapseToEnd?.();
  }
}

// =====================================================================
// TOAST
// =====================================================================
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

// =====================================================================
// CLOSE DROPDOWN
// =====================================================================
function closeDropdown() {
  if (dropdown) { dropdown.remove(); dropdown = null; }
}