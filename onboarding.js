const practicePage = document.body.hasAttribute('data-practice');
const errorNotice = document.getElementById('error');

async function request(action) {
  errorNotice.hidden = true;
  const response = await chrome.runtime.sendMessage({ action }).catch(() => null);
  if (!response || response.error) {
    errorNotice.hidden = false;
    return null;
  }
  return response;
}

async function refreshControls() {
  const response = await request('getOnboardingControls');
  if (!response) return;
  const { shortcut, releaseAlt } = response.data;

  document.querySelectorAll('[data-shortcut]').forEach((label) => {
    label.textContent = shortcut || 'Not set';
  });
  document.querySelectorAll('[data-unbound]').forEach((notice) => {
    notice.hidden = Boolean(shortcut);
  });

  if (practicePage) {
    document.getElementById('practice-keys').hidden = !shortcut;
    document.getElementById('release-alt').hidden = !releaseAlt;
    document.getElementById('confirm-enter').hidden = releaseAlt;
  } else {
    document.getElementById('start').disabled = !shortcut;
    document.getElementById('resume-practice').disabled = !shortcut;
  }
}

document.querySelectorAll('[data-settings]').forEach((button) => {
  button.addEventListener('click', () => request('openShortcutSettings'));
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshControls();
});
if (practicePage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.stickyMode) refreshControls();
  });
}
refreshControls();

if (!practicePage) {
  const steps = ['welcome', 'resume', 'done'];
  const tab = chrome.tabs.getCurrent();

  function showStep(step) {
    steps.forEach((id) => {
      document.getElementById(id).hidden = id !== step;
    });
    document.getElementById('step').textContent = `${steps.indexOf(step) + 1} / 3`;
    document.getElementById(`${step}-title`).focus();
  }

  async function startPractice(event) {
    const button = event.currentTarget;
    button.disabled = true;
    if (await request('startPractice')) showStep('resume');
    button.disabled = false;
  }

  function finish(practiced) {
    document.getElementById('done-message').textContent = practiced
      ? 'Nice switch! Use the same shortcut on any regular web page to see your recent tabs.'
      : 'Use your QuickTab shortcut on any regular web page to see your recent tabs.';
    showStep('done');
  }

  document.getElementById('start').addEventListener('click', startPractice);
  document.getElementById('resume-practice').addEventListener('click', startPractice);
  document.getElementById('close').addEventListener('click', () => request('closeOnboarding'));
  document.querySelectorAll('[data-skip]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (await request('skipPractice')) finish(false);
    });
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'onboardingComplete') {
      tab.then((current) => {
        if (current?.id === message.tabId) finish(true);
      });
    }
  });
}
