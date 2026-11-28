// QuickTab - Popup Settings

const showNonInjectableCheckbox = document.getElementById('showNonInjectable');
const stickyModeCheckbox = document.getElementById('stickyMode');
const tabCountOptions = document.querySelectorAll('input[name="tabCount"]');
const enablePreviewsHint = document.getElementById('enable-previews-hint');

// Load saved settings
chrome.storage.local.get(['showNonInjectableTabs', 'stickyMode', 'tabCount', 'tabPreviewConsent'], (result) => {
  showNonInjectableCheckbox.checked = result.showNonInjectableTabs || false;
  stickyModeCheckbox.checked = result.stickyMode || false;
  const savedTabCount = [...tabCountOptions].find((option) => Number(option.value) === result.tabCount);
  if (savedTabCount) savedTabCount.checked = true;
  enablePreviewsHint.hidden = result.tabPreviewConsent === true;
});

// Save on change
showNonInjectableCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ showNonInjectableTabs: showNonInjectableCheckbox.checked });
});

stickyModeCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ stickyMode: stickyModeCheckbox.checked });
});

for (const option of tabCountOptions) {
  option.addEventListener('change', () => {
    chrome.storage.local.set({ tabCount: Number(option.value) });
  });
}
