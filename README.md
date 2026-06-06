# QuickFill Snippets ⚡

A lightweight, privacy-focused Chrome Extension that lets you autofill saved text snippets using a quick `;;` shortcut. Built with Manifest V3, QuickFill keeps all your data strictly on your local machine and works across standard web forms and complex rich-text editors.

## ✨ Features

* **Instant Trigger:** Type `;;` in any text box to instantly open your snippet library.
* **Keyboard Navigation:** Keep your hands on the keyboard. Cycle through snippets with the `Up` and `Down` arrow keys, and press `Enter` to inject the text.
* **Smart UI:** Features a scrollable dropdown with snippet titles and a readable preview of the text, complete with custom scrollbars.
* **Universal Support:** Works on standard `<input>` and `<textarea>` fields, as well as `contenteditable` rich-text editors (like Gmail and ChatGPT). 
* **Canvas Engine Fallback:** Seamlessly supports complex canvas-based apps like Google Docs and Google Sheets via a smart clipboard copy-and-paste fallback system.
* **100% Private:** No cloud syncing, no accounts, and no analytics. All snippets are saved directly to your browser's local LevelDB storage using the `chrome.storage.local` API.

## 🚀 Installation (Developer Mode)

Since this extension is not yet on the Chrome Web Store, you can install it locally in a few seconds:

1. Clone this repository or download the ZIP file and extract it.
2. Open Google Chrome (or any Chromium-based browser like Brave or Edge) and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `QuickFill` folder containing the code.
6. The extension is now installed! Pin it to your toolbar for easy access.

## 💻 How to Use

1. **Add Snippets:** Click the QuickFill puzzle icon in your browser toolbar to open the management menu. Add a Title and the Text you want to save. You can also edit or delete existing snippets here.
2. **Trigger the Menu:** Go to any webpage, click inside a text box, and type `;;`.
3. **Select & Inject:** Use your arrow keys or mouse to highlight the snippet you want. Press `Enter` or click to inject it.
4. **Cancel:** If the menu opens but you just want to type normally, just hit `Space` or continue typing and the menu will instantly disappear.

## 🛠️ Tech Stack

* Vanilla JavaScript
* HTML5 / CSS3
* Chrome Extension API (Manifest V3)

## 🔒 Security

This extension utilizes basic HTML sanitization to prevent Cross-Site Scripting (XSS) when rendering user-generated snippet titles and text within the popup interface.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
