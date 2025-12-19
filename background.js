// QuickTab - Background Service Worker
// 管理最近标签列表、截图缓存、消息通信

const MAX_TABS = 10;
const STORAGE_KEY = 'lastTabs';

// 初始化：设置 storage.session 访问级别
chrome.storage.session.setAccessLevel({
  accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
});

// ========== 工具函数 ==========

// 获取标签列表
async function getTabList() {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

// 保存标签列表
async function saveTabList(tabs) {
  await chrome.storage.session.set({ [STORAGE_KEY]: tabs });
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
async function recordTabActivation(tabId, windowId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) return;

    const tabList = await getTabList();
    
    // 查找是否已存在
    const existingIndex = tabList.findIndex(t => t.id === tabId);
    
    // 如果存在，先移除
    if (existingIndex !== -1) {
      tabList.splice(existingIndex, 1);
    }
    
    // 添加到最前面
    tabList.unshift({
      id: tab.id,
      title: tab.title || 'Untitled',
      url: tab.url,
      favIconUrl: tab.favIconUrl || '',
      lastActive: Date.now()
    });
    
    // 保持最多 MAX_TABS 条
    if (tabList.length > MAX_TABS) {
      tabList.pop();
    }
    
    await saveTabList(tabList);
  } catch (e) {
    console.log('QuickTab: Error recording tab', e.message);
  }
}

// 移除关闭的标签
async function removeTab(tabId) {
  const tabList = await getTabList();
  const newList = tabList.filter(t => t.id !== tabId);
  await saveTabList(newList);
}

// 更新标签信息（URL 变化等）
async function updateTabInfo(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  
  const tabList = await getTabList();
  const tabInfo = tabList.find(t => t.id === tabId);
  
  if (tabInfo) {
    tabInfo.title = tab.title || tabInfo.title;
    tabInfo.url = tab.url || tabInfo.url;
    tabInfo.favIconUrl = tab.favIconUrl || tabInfo.favIconUrl;
    // URL 变化时清除旧截图
    if (changeInfo.url) {
      tabInfo.thumbnail = null;
    }
    await saveTabList(tabList);
  }
}

// ========== 事件监听 ==========

// 记录上一个活动标签，用于切换时截图
let lastActiveTabId = null;
let lastActiveWindowId = null;

// 标签激活
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await recordTabActivation(activeInfo.tabId, activeInfo.windowId);
  lastActiveTabId = activeInfo.tabId;
  lastActiveWindowId = activeInfo.windowId;
});

// 标签关闭
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTab(tabId);
  if (lastActiveTabId === tabId) {
    lastActiveTabId = null;
  }
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
    } catch (e) {
      console.log('QuickTab: Cannot send message to tab', e.message);
    }
  }
});

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTabList') {
    getTabList().then(tabs => sendResponse({ tabs }));
    return true; // 异步响应
  }
  
  if (message.action === 'switchToTab') {
    chrome.tabs.update(message.tabId, { active: true }).then(() => {
      chrome.windows.update(message.windowId || chrome.windows.WINDOW_ID_CURRENT, { focused: true });
      sendResponse({ success: true });
    }).catch(e => {
      sendResponse({ success: false, error: e.message });
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
          url: tab.url,
          favIconUrl: tab.favIconUrl || '',
          lastActive: tab.lastAccessed || Date.now()
        });
      }
    }
    
    await saveTabList(tabList);
    
    // 记录当前活动标签
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      lastActiveTabId = activeTab.id;
      lastActiveWindowId = activeTab.windowId;
    }
    
    console.log('QuickTab: Initialized with', tabList.length, 'tabs');
  } catch (e) {
    console.log('QuickTab: Init error', e.message);
  }
}

initAllTabs();

console.log('QuickTab: Background service worker started');
