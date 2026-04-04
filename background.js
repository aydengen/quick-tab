// QuickTab - Background Service Worker
// 管理最近标签列表和消息通信

const MAX_TABS = 10;
const STORAGE_KEY = 'lastTabs';

// ========== 工具函数 ==========

// Serial queue to prevent read-modify-write race conditions on storage
let storageQueue = Promise.resolve();
function withTabList(fn) {
  storageQueue = storageQueue
    .then(async () => {
      const result = await chrome.storage.session.get(STORAGE_KEY);
      const tabList = result[STORAGE_KEY] || [];
      const newList = await fn(tabList);
      if (newList !== undefined) {
        await chrome.storage.session.set({ [STORAGE_KEY]: newList });
      }
    })
    .catch((error) => {
      console.error('QuickTab: Storage operation error', error);
    });
  return storageQueue;
}

// 获取标签列表（只读，不需要串行）
async function getTabList() {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

// 检查 URL 是否可注入 content script
function isInjectableUrl(url) {
  if (!url) return false;
  return !url.startsWith('chrome://') &&
         !url.startsWith('chrome-extension://') &&
         !url.startsWith('edge://') &&
         !url.startsWith('about:') &&
         !url.startsWith('https://chrome.google.com/webstore');
}

// ========== 标签列表管理 ==========

// 记录标签激活
async function recordTabActivation(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  if (!tab || !tab.url) return;

  await withTabList((tabList) => {
    // 查找是否已存在
    const existingIndex = tabList.findIndex(t => t.id === tabId);
    if (existingIndex !== -1) {
      tabList.splice(existingIndex, 1);
    }

    tabList.unshift({
      id: tab.id,
      title: tab.title || 'Untitled',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || ''
    });

    if (tabList.length > MAX_TABS) {
      tabList.pop();
    }
    return tabList;
  });
}

// 移除关闭的标签
async function removeTab(tabId) {
  await withTabList((tabList) => {
    return tabList.filter(t => t.id !== tabId);
  });
}

// 更新标签信息（URL 变化等）
async function updateTabInfo(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;

  let shouldRecord = false;

  await withTabList((tabList) => {
    const tabInfo = tabList.find((t) => t.id === tabId);
    if (tabInfo) {
      tabInfo.title = tab.title || tabInfo.title;
      tabInfo.url = tab.url || tabInfo.url;
      tabInfo.favIconUrl = tab.favIconUrl || tabInfo.favIconUrl;
      return tabList;
    }
    shouldRecord = Boolean(tab.url && tab.active);
    return undefined;
  });

  if (shouldRecord) {
    await recordTabActivation(tabId);
  }
}

// ========== 事件监听 ==========

// 标签激活
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await recordTabActivation(activeInfo.tabId);
});

// 标签关闭
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTab(tabId);
});

// 标签更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await updateTabInfo(tabId, changeInfo, tab);
});

// ========== 快捷键与消息 ==========

// 快捷键触发
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-panel') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && isInjectableUrl(tab.url)) {
        await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
      }
    } catch (error) {
      console.error('QuickTab: Cannot send message to tab', error);
    }
  }
});

// 消息处理
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getTabList') {
    (async () => {
      const tabs = await getTabList();
      const settings = await chrome.storage.local.get('showNonInjectableTabs');
      const showAll = settings.showNonInjectableTabs || false;
      const filtered = showAll ? tabs : tabs.filter(t => isInjectableUrl(t.url));
      sendResponse({ tabs: filtered });
    })();
    return true; // 异步响应
  }

  if (message.action === 'switchToTab') {
    (async () => {
      const tab = await chrome.tabs.get(message.tabId);
      await chrome.tabs.update(message.tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      sendResponse({ success: true });
    })().catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// 初始化：记录所有标签页
async function initAllTabs() {
  try {
    const allTabs = await chrome.tabs.query({});
    const tabList = [];

    // 按最后访问时间排序（如果有的话）
    allTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

    for (const tab of allTabs) {
      if (tab.url && tabList.length < MAX_TABS) {
        tabList.push({
          id: tab.id,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          favIconUrl: tab.favIconUrl || ''
        });
      }
    }

    await chrome.storage.session.set({ [STORAGE_KEY]: tabList });
  } catch (error) {
    console.error('QuickTab: Init error', error);
  }
}

initAllTabs();
