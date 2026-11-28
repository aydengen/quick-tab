// QuickTab - Popup Settings

const showNonInjectableCheckbox = document.getElementById('showNonInjectable');
const stickyModeCheckbox = document.getElementById('stickyMode');
const tabCountSelect = document.getElementById('tabCount');
const enablePreviewsHint = document.getElementById('enable-previews-hint');

// Load saved settings
chrome.storage.local.get(['showNonInjectableTabs', 'stickyMode', 'tabCount', 'tabPreviewConsent'], (result) => {
  showNonInjectableCheckbox.checked = result.showNonInjectableTabs || false;
  stickyModeCheckbox.checked = result.stickyMode || false;
  if ([...tabCountSelect.options].some((option) => Number(option.value) === result.tabCount)) {
    tabCountSelect.value = String(result.tabCount);
  }
  enablePreviewsHint.hidden = result.tabPreviewConsent === true;
});

// Save on change
showNonInjectableCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ showNonInjectableTabs: showNonInjectableCheckbox.checked });
});

stickyModeCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ stickyMode: stickyModeCheckbox.checked });
});

tabCountSelect.addEventListener('change', () => {
  chrome.storage.local.set({ tabCount: Number(tabCountSelect.value) });
});
