// QuickTab - Popup Settings

const SETTING_KEY = 'showNonInjectableTabs';

const checkbox = document.getElementById('showNonInjectable');

// Load saved setting
chrome.storage.local.get(SETTING_KEY, (result) => {
  checkbox.checked = result[SETTING_KEY] || false;
});

// Save on change
checkbox.addEventListener('change', () => {
  chrome.storage.local.set({ [SETTING_KEY]: checkbox.checked });
});
