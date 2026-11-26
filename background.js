// QuickTab - Background Service Worker
// 管理最近标签列表、按需注入面板、处理消息通信

const MAX_TABS = 10;
const MAX_STORED_TABS = 20;
const STORAGE_KEY = 'lastTabs';

const NON_INJECTABLE_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'chrome-search://',
  'chrome-untrusted://',
  'devtools://',
  'edge://',
  'about:',
  'view-source:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com'
];

// ========== 工具函数 ==========

// 检查 URL 是否可注入 content script
function isInjectableUrl(url) {
  if (!url) return false;
  return !NON_INJECTABLE_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function toEntry(tab) {
  return {
    id: tab.id,
    windowId: tab.windowId,
    incognito: Boolean(tab.incognito),
    title: tab.title || 'Untitled',
    url: tab.url || tab.pendingUrl || '',
    favIconUrl: tab.favIconUrl || ''
  };
}

// ========== 存储 ==========

// 内存缓存 + 串行队列：避免读-改-写竞争，且不变时不写存储
let tabListCache = null;
let storageQueue = Promise.resolve();

async function readTabList() {
  if (tabListCache) return tabListCache;

  const result = await chrome.storage.session.get(STORAGE_KEY);
  if (Array.isArray(result[STORAGE_KEY])) {
    tabListCache = result[STORAGE_KEY];
    return tabListCache;
  }

  // 首次启动：按最后访问时间初始化
  const allTabs = await chrome.tabs.query({});
  allTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  tabListCache = allTabs.filter((tab) => tab.url).slice(0, MAX_STORED_TABS).map(toEntry);
  await chrome.storage.session.set({ [STORAGE_KEY]: tabListCache });
  return tabListCache;
}

// fn 返回新数组则写入，返回 undefined 表示无变化
function withTabList(fn) {
  storageQueue = storageQueue
    .then(async () => {
      const tabList = await readTabList();
      const newList = await fn(tabList.slice());
      if (newList !== undefined) {
        tabListCache = newList;
        await chrome.storage.session.set({ [STORAGE_KEY]: newList });
      }
    })
    .catch((error) => {
      console.error('QuickTab: Storage operation error', error);
    });
  return storageQueue;
}

async function getTabList() {
  await storageQueue;
  return readTabList();
}

// ========== 标签列表管理 ==========

async function recordTabActivation(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  if (!tab) return;

  await withTabList((tabList) => {
    const rest = tabList.filter((t) => t.id !== tabId);
    return [toEntry(tab), ...rest].slice(0, MAX_STORED_TABS);
  });
}

async function removeTab(tabId) {
  await withTabList((tabList) => {
    const next = tabList.filter((t) => t.id !== tabId);
    return next.length === tabList.length ? undefined : next;
  });
}

// 标题、URL、图标任一变化都同步（SPA 改标题、图标晚到）
async function updateTabInfo(tabId, changeInfo, tab) {
  const relevant = 'title' in changeInfo || 'url' in changeInfo ||
    'favIconUrl' in changeInfo || changeInfo.status === 'complete';
  if (!relevant) return;

  let shouldRecord = false;

  await withTabList((tabList) => {
    const index = tabList.findIndex((t) => t.id === tabId);
    if (index === -1) {
      shouldRecord = Boolean(tab.active && tab.url);
      return undefined;
    }

    const old = tabList[index];
    const next = {
      ...old,
      windowId: tab.windowId,
      title: tab.title || old.title,
      url: tab.url || old.url,
      // 跳转到新页面时清掉旧站点的图标
      favIconUrl: tab.favIconUrl || (changeInfo.url ? '' : old.favIconUrl)
    };

    const unchanged = next.title === old.title && next.url === old.url &&
      next.favIconUrl === old.favIconUrl && next.windowId === old.windowId;
    if (unchanged) return undefined;

    tabList[index] = next;
    return tabList;
  });

  if (shouldRecord) {
    await recordTabActivation(tabId);
  }
}

// ========== 事件监听 ==========

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await recordTabActivation(activeInfo.tabId);
});

// 切换窗口时 onActivated 不会触发，需单独记录
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) await recordTabActivation(tab.id);
  } catch {
    // 窗口已关闭
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await updateTabInfo(tabId, changeInfo, tab);
});

// 预渲染等场景下标签 ID 会被替换
chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
  let tab;
  try {
    tab = await chrome.tabs.get(addedTabId);
  } catch {
    return;
  }
  await withTabList((tabList) => {
    const index = tabList.findIndex((t) => t.id === removedTabId);
    if (index === -1) return undefined;
    tabList[index] = toEntry(tab);
    return tabList;
  });
});

// ========== 面板注入 ==========

let panelCssPromise = null;
function getPanelCss() {
  panelCssPromise ??= fetch(chrome.runtime.getURL('content.css'))
    .then((response) => response.text())
    .catch((error) => {
      panelCssPromise = null;
      throw error;
    });
  return panelCssPromise;
}

// 已注入则直接发消息；否则借助快捷键授予的 activeTab 权限按需注入
async function openPanel(tab) {
  if (!isInjectableUrl(tab.url)) return false;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    return true;
  } catch {
    // 尚未注入
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    return true;
  } catch {
    // PDF、本地文件等无法注入的页面
    return false;
  }
}

async function activateTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

// 面板无法显示时，直接切回上一个标签
async function switchToPreviousTab(currentTab) {
  const tabs = await getTabList();
  for (const entry of tabs) {
    if (entry.id === currentTab.id || entry.incognito !== Boolean(currentTab.incognito)) continue;
    try {
      await activateTab(entry.id);
      return;
    } catch {
      await removeTab(entry.id);
    }
  }
}

// ========== 快捷键与消息 ==========

chrome.commands.onCommand.addListener(async (command, commandTab) => {
  if (command !== 'toggle-panel') return;

  try {
    const tab = commandTab ||
      (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    if (!tab) return;

    if (!(await openPanel(tab))) {
      await switchToPreviousTab(tab);
    }
  } catch (error) {
    console.error('QuickTab: Command error', error);
  }
});

async function buildPanelData(senderTab, includeCss) {
  const [tabs, settings, css] = await Promise.all([
    getTabList(),
    chrome.storage.local.get('showNonInjectableTabs'),
    includeCss ? getPanelCss() : null
  ]);
  const showAll = Boolean(settings.showNonInjectableTabs);
  const incognito = Boolean(senderTab?.incognito);

  // 当前标签固定放第一位；不跨普通/无痕窗口泄露标签
  const list = senderTab ? [{ ...toEntry(senderTab), current: true }] : [];
  for (const entry of tabs) {
    if (list.length >= MAX_TABS) break;
    if (entry.id === senderTab?.id) continue;
    if (Boolean(entry.incognito) !== incognito) continue;
    if (!showAll && !isInjectableUrl(entry.url)) continue;
    list.push(entry);
  }

  return { tabs: list, css };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTabList') {
    buildPanelData(sender.tab, Boolean(message.includeCss))
      .then(sendResponse)
      .catch((error) => sendResponse({ tabs: [], error: error.message }));
    return true; // 异步响应
  }

  if (message.action === 'switchToTab') {
    activateTab(message.tabId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
