// QuickTab - Background Service Worker
// 管理最近标签列表和消息通信，必要时补注入面板脚本

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
    const next = [toEntry(tab), ...tabList.filter((t) => t.id !== tabId)];
    // 掉出最近列表的标签不再保留缩略图
    next.slice(MAX_STORED_TABS).forEach((t) => deleteThumb(t.id));
    return next.slice(0, MAX_STORED_TABS);
  });
  scheduleCapture(tabId);
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

  // 当前标签加载完成或 SPA 跳转后重新截图
  if (tab.active && (changeInfo.status === 'complete' || 'title' in changeInfo || 'url' in changeInfo)) {
    scheduleCapture(tabId);
  }

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

  // 只记录用户正在看的标签，后台窗口里的标题变化不算访问
  if (shouldRecord) {
    try {
      const win = await chrome.windows.get(tab.windowId);
      if (win.focused) await recordTabActivation(tabId);
    } catch {
      // 窗口已关闭
    }
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
  deleteThumb(tabId);
  await removeTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await updateTabInfo(tabId, changeInfo, tab);
});

// 预渲染等场景下标签 ID 会被替换
chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
  deleteThumb(removedTabId);
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

// ========== 缩略图与图标 ==========
// captureVisibleTab 只能截取窗口当前可见的标签：标签停留片刻后截图缓存，切换时展示

const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 300;
const THUMB_PREFIX = 'thumb:';
// 停留这么久才截图，Alt+Q 或 Ctrl+Tab 连续切换时只截最终停下的标签
const THUMB_SETTLE_MS = 500;
// Chrome 限制每秒最多截图 2 次
const THUMB_MIN_INTERVAL_MS = 550;
const THUMB_FRESH_MS = 3000;
// 打开面板时最多等待当前标签截图这么久
const THUMB_OPEN_BUDGET_MS = 100;

const thumbCache = new Map();
const thumbTimers = new Map();
// 面板打开中的标签不截图，避免把面板截进去
const panelOpenTabs = new Set();
let captureChain = Promise.resolve(false);
let lastCaptureAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withoutHash(url) {
  return (url || '').split('#')[0];
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type};base64,${bytesToBase64(bytes)}`;
}

// 裁成 16:10 并保留页面顶部，缩小后存为 WebP（约 20–40 KB）
async function toThumbnail(capturedUrl) {
  const bitmap = await createImageBitmap(await (await fetch(capturedUrl)).blob());
  const ratio = THUMB_WIDTH / THUMB_HEIGHT;
  const sourceWidth = Math.min(bitmap.width, bitmap.height * ratio);
  const sourceHeight = sourceWidth / ratio;
  const canvas = new OffscreenCanvas(THUMB_WIDTH, THUMB_HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - sourceWidth) / 2, 0, sourceWidth, sourceHeight,
    0, 0, THUMB_WIDTH, THUMB_HEIGHT);
  bitmap.close();
  return blobToDataUrl(await canvas.convertToBlob({ type: 'image/webp', quality: 0.75 }));
}

async function loadThumbs(tabIds) {
  const missing = tabIds.filter((id) => !thumbCache.has(id));
  if (missing.length) {
    const result = await chrome.storage.session.get(missing.map((id) => THUMB_PREFIX + id));
    for (const id of missing) thumbCache.set(id, result[THUMB_PREFIX + id] || null);
  }
  return tabIds.map((id) => thumbCache.get(id));
}

function deleteThumb(tabId) {
  clearTimeout(thumbTimers.get(tabId));
  thumbTimers.delete(tabId);
  thumbCache.delete(tabId);
  panelOpenTabs.delete(tabId);
  chrome.storage.session.remove(THUMB_PREFIX + tabId).catch(() => {});
}

async function captureThumb(tabId, { forPanel = false } = {}) {
  const wait = lastCaptureAt + THUMB_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  if (!forPanel && panelOpenTabs.has(tabId)) return false;

  const tab = await chrome.tabs.get(tabId);
  if (!tab.active || tab.status !== 'complete' || !isInjectableUrl(tab.url)) return false;
  const win = await chrome.windows.get(tab.windowId);
  if (!win.focused || win.state === 'minimized') return false;

  lastCaptureAt = Date.now();
  const captured = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 });
  // 截图期间用户可能已经切走
  const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (active?.id !== tabId || withoutHash(active.url) !== withoutHash(tab.url)) return false;

  const thumb = { url: tab.url, dataUrl: await toThumbnail(captured), at: Date.now() };
  thumbCache.set(tabId, thumb);
  await chrome.storage.session.set({ [THUMB_PREFIX + tabId]: thumb });
  return true;
}

function queueCapture(tabId, options) {
  const run = captureChain
    .then(() => captureThumb(tabId, options))
    .catch(() => false); // 受限页面、窗口已关闭等
  captureChain = run;
  return run;
}

function scheduleCapture(tabId) {
  clearTimeout(thumbTimers.get(tabId));
  thumbTimers.set(tabId, setTimeout(() => {
    thumbTimers.delete(tabId);
    queueCapture(tabId);
  }, THUMB_SETTLE_MS));
}

// 用 Chrome 自带的图标缓存（_favicon），后台转成 data URL：不受页面 CSP 影响，chrome:// 页面也有图标
const faviconCache = new Map();
function getFavicon(pageUrl) {
  if (!pageUrl) return Promise.resolve('');
  let key;
  try {
    const url = new URL(pageUrl);
    key = url.protocol.startsWith('http') ? url.origin : withoutHash(pageUrl);
  } catch {
    return Promise.resolve('');
  }
  if (!faviconCache.has(key)) {
    const iconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
    iconUrl.searchParams.set('pageUrl', pageUrl);
    iconUrl.searchParams.set('size', '32');
    faviconCache.set(key, fetch(iconUrl)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => (blob ? blobToDataUrl(blob) : ''))
      .catch(() => {
        faviconCache.delete(key);
        return '';
      }));
  }
  return faviconCache.get(key);
}

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

// 用户可在 chrome://extensions/shortcuts 改成不含 Alt 的快捷键，此时没有“松开 Alt 确认”
async function shortcutUsesAlt() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === 'toggle-panel')?.shortcut || '';
  // 按键名会本地化（如祖鲁语 I-Alt）；要求 alt 位于键名末尾，避免匹配德语 Shift 的 Umschalttaste
  return shortcut.includes('⌥') ||
    shortcut.split('+').some((key) => /(^|[^a-z])alt$/i.test(key.trim()));
}

// content.js 通过 manifest 注入；安装/更新前已打开的页面没有它，
// 借助快捷键授予的 activeTab 权限补注入
async function openPanel(tab) {
  if (!isInjectableUrl(tab.url)) return false;

  const message = { action: 'togglePanel', altShortcut: await shortcutUsesAlt() };
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {
    // 尚未注入
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, message);
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

// 打开面板前先截一张当前标签：它就是下次切换时的“上一个标签”
async function refreshCurrentThumb(tab) {
  const [thumb] = await loadThumbs([tab.id]);
  const fresh = thumb && withoutHash(thumb.url) === withoutHash(tab.url) &&
    Date.now() - thumb.at < THUMB_FRESH_MS;
  if (fresh || tab.status !== 'complete') return;
  clearTimeout(thumbTimers.get(tab.id));
  await Promise.race([queueCapture(tab.id, { forPanel: true }), sleep(THUMB_OPEN_BUDGET_MS)]);
}

async function withPreviews(entries) {
  const thumbs = await loadThumbs(entries.map((entry) => entry.id));
  const favicons = await Promise.all(entries.map((entry) => getFavicon(entry.url)));
  return entries.map((entry, i) => {
    const thumb = thumbs[i];
    const valid = thumb && withoutHash(thumb.url) === withoutHash(entry.url);
    return { ...entry, thumbnail: valid ? thumb.dataUrl : '', favicon: favicons[i] };
  });
}

async function buildPanelData(senderTab, includeCss, capture) {
  if (senderTab && capture) await refreshCurrentThumb(senderTab).catch(() => {});
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

  if (senderTab) panelOpenTabs.add(senderTab.id);
  return { tabs: await withPreviews(list), css };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTabList') {
    buildPanelData(sender.tab, Boolean(message.includeCss), message.capture !== false)
      .then(sendResponse)
      .catch((error) => sendResponse({ tabs: [], error: error.message }));
    return true; // 异步响应
  }

  if (message.action === 'panelClosed') {
    if (sender.tab) panelOpenTabs.delete(sender.tab.id);
    return;
  }

  if (message.action === 'switchToTab') {
    activateTab(message.tabId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
