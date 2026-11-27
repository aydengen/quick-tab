// QuickTab - Popup Settings

const showNonInjectableCheckbox = document.getElementById('showNonInjectable');
const stickyModeCheckbox = document.getElementById('stickyMode');
const enablePreviewsHint = document.getElementById('enable-previews-hint');

// Load saved settings
chrome.storage.local.get(['showNonInjectableTabs', 'stickyMode', 'tabPreviewConsent'], (result) => {
  showNonInjectableCheckbox.checked = result.showNonInjectableTabs || false;
  stickyModeCheckbox.checked = result.stickyMode || false;
  enablePreviewsHint.hidden = result.tabPreviewConsent === true;
});

// Save on change
showNonInjectableCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ showNonInjectableTabs: showNonInjectableCheckbox.checked });
});

stickyModeCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ stickyMode: stickyModeCheckbox.checked });
});
