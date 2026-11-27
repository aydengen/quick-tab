// QuickTab - Content Script
// 在封闭 Shadow DOM 中渲染 AltTab 风格面板

(function () {
  'use strict';

  // background 可能为已打开的旧页面补注入，先清理旧实例
  globalThis.__quicktabCleanup?.();

  const QUICK_TAP_WINDOW_MS = 1000;
  // 面板到窗口边缘的最小距离
  const PANEL_MARGIN = 16;
  const MIN_PANEL_SCALE = 0.85;

  let host = null;
  let root = null;
  let panelCss = null;
  let panelVisible = false;
  let altKeyDown = false;
  // 面板渲染前就松开了 Alt：数据返回后直接切换
  let confirmPending = false;
  let panelOpenReported = false;
  let stickyMode = false;
  let altShortcutOpen = true;
  let panelRequestId = 0;
  let pendingShortcutOffset = 0;
  // 页面实际观察到的 Alt 状态：true / false / null（未知，如刚注入或失焦后）
  let altHeld = null;
  let lastAltUpAt = 0;

  // 首次打开面板时再读取设置，避免每个页面加载都访问存储
  let settingsReady = null;
  function loadSettings() {
    settingsReady ??= chrome.storage.local.get('stickyMode')
      .then((result) => {
        stickyMode = Boolean(result.stickyMode);
      })
      .catch(() => {});
    return settingsReady;
  }

  function onStorageChanged(changes, area) {
    if (area === 'local' && changes.stickyMode) {
      stickyMode = Boolean(changes.stickyMode.newValue);
    }
  }

  // ========== 面板管理 ==========

  function showPanel(altShortcut) {
    // 如果面板已打开，循环选择下一个（支持连续按 Alt+Q 切换）
    if (panelVisible) {
      cycleShortcutSelection(1);
      return;
    }

    // 立即标记为可见，防止连续按键时重复调用
    panelVisible = true;
    pendingShortcutOffset = 0;
    // 快捷键不含 Alt 时没有“松开确认”，面板保持打开
    altShortcutOpen = altShortcut;
    altKeyDown = altShortcut;
    // 快捷键消息到达前 Alt 刚刚松开（快速轻按）
    confirmPending = altShortcut && altHeld === false &&
      performance.now() - lastAltUpAt < QUICK_TAP_WINDOW_MS;
    const requestId = ++panelRequestId;
    panelOpenReported = true;

    Promise.all([
      // 快速轻按不会显示面板，不必等当前标签截图
      chrome.runtime.sendMessage({
        action: 'getTabList',
        includeCss: panelCss === null,
        capture: !confirmPending
      }),
      loadSettings()
    ])
      .then(([response]) => {
        if (requestId !== panelRequestId || !panelVisible) return;

        if (response?.css) panelCss = response.css;
        const tabs = response?.tabs || [];

        if (stickyMode || !altShortcut) {
          altKeyDown = false;
          confirmPending = false;
        }

        if (confirmPending) {
          const target = tabs.length > 1 ? tabs[initialSelectionIndex(tabs.length)] : null;
          hidePanel();
          if (target) switchToTab(target.id);
          return;
        }

        renderPanel(tabs);
      })
      .catch((error) => {
        console.error('QuickTab: Error getting tab list', error);
        hidePanel();
      });
  }

  function ensureHost() {
    if (host) return;

    // 用 div 而非自定义元素：页面可抢先注册同名自定义元素并通过 ElementInternals 读取 closed shadow root
    host = document.createElement('div');
    // 防止宿主页面 CSS 影响面板容器
    const hostStyles = {
      all: 'initial',
      position: 'fixed',
      inset: '0',
      display: 'block',
      'z-index': '2147483647'
    };
    for (const [property, value] of Object.entries(hostStyles)) {
      host.style.setProperty(property, value, 'important');
    }

    // closed 模式：页面脚本无法读取面板中的标签标题和 URL
    root = host.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(panelCss || '');
    root.adoptedStyleSheets = [sheet];
  }

  // ========== 渲染 ==========

  // 图片都由 background 转成 data URL，这里解码后画进 canvas：不经过 <img> 加载，不受页面 CSP 限制
  function decodeImage(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const type = /^data:([^;]+)/.exec(header)?.[1] || 'image/png';
    const binary = atob(base64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return createImageBitmap(new Blob([bytes], { type }));
  }

  function createImage(dataUrl, className) {
    const canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    decodeImage(dataUrl)
      .then((bitmap) => {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        canvas.classList.toggle('quicktab-icon-dark', isDarkIcon(ctx, canvas.width, canvas.height));
        canvas.classList.add('quicktab-loaded');
      })
      .catch(() => canvas.remove());
    return canvas;
  }

  // 黑色图标（如 GitHub）在深色面板上看不清，深色模式下给它垫一层浅色底
  function isDarkIcon(ctx, width, height) {
    if (width * height > 256 * 256) return false;
    const { data } = ctx.getImageData(0, 0, width, height);
    let opaque = 0;
    let luminance = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      opaque += 1;
      luminance += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return opaque > 0 && luminance / opaque < 70;
  }

  function createGlobe(className) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 0c1.7 1.6 2.6 3.9 2.6 6.5S9.7 12.9 8 14.5M8 1.5C6.3 3.1 5.4 5.4 5.4 8s.9 4.9 2.6 6.5M1.8 6h12.4M1.8 10h12.4');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.1');
    svg.appendChild(path);
    return svg;
  }

  function createIcon(tab, className) {
    return tab.favicon ? createImage(tab.favicon, className) : createGlobe(className);
  }

  function displayUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.protocol.startsWith('http') ? url.host.replace(/^www\./, '') : rawUrl.replace(/\/$/, '');
    } catch {
      return rawUrl;
    }
  }

  function renderPanel(tabs) {
    ensureHost();

    const overlay = document.createElement('div');
    overlay.className = 'quicktab-overlay';
    overlay.addEventListener('click', () => hidePanel());

    const panel = document.createElement('div');
    panel.className = 'quicktab-panel';

    const grid = document.createElement('div');
    grid.className = 'quicktab-grid';
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', 'Recent tabs');

    if (tabs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'quicktab-empty';
      empty.textContent = 'No recent tabs yet';
      grid.appendChild(empty);
    } else {
      tabs.forEach((tab) => grid.appendChild(createTabCard(tab)));
    }

    panel.appendChild(grid);

    root.replaceChildren(overlay, panel);
    document.documentElement.appendChild(host);
    layoutPanel();

    // 默认选中上一个访问的标签
    const cards = getCards();
    if (cards.length) focusCard(cards[initialSelectionIndex(cards.length)]);
  }

  function layoutPanel() {
    const panel = root?.querySelector('.quicktab-panel');
    const grid = panel?.querySelector('.quicktab-grid');
    if (!grid) return;
    grid.style.setProperty('--quicktab-columns', String(getCards().length || 1));
    const availableWidth = window.innerWidth - 2 * PANEL_MARGIN;
    const availableHeight = window.innerHeight - 2 * PANEL_MARGIN;
    const naturalWidth = grid.scrollWidth + panel.offsetWidth - grid.offsetWidth;
    const naturalHeight = grid.scrollHeight + panel.offsetHeight - grid.clientHeight;
    const scale = Math.max(MIN_PANEL_SCALE, Math.min(
      1,
      availableWidth / naturalWidth,
      availableHeight / naturalHeight
    ));
    panel.style.setProperty('--qt-scale', String(scale));
    panel.style.maxWidth = `${availableWidth / scale}px`;
    panel.style.maxHeight = `${availableHeight / scale}px`;
    const focusedCard = root.activeElement;
    if (focusedCard?.parentElement === grid) revealCard(focusedCard);
  }

  function createTabCard(tab) {
    const title = tab.title || 'Untitled';
    const url = tab.url ? displayUrl(tab.url) : '';

    const card = document.createElement('div');
    card.className = 'quicktab-card';
    card.tabIndex = -1;
    card.dataset.tabId = tab.id;
    card.title = tab.url ? `${title}\n${tab.url}` : title;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', 'false');
    card.setAttribute('aria-label', url ? `${title}, ${url}` : title);
    if (tab.current) card.classList.add('quicktab-current');

    const preview = document.createElement('div');
    preview.className = 'quicktab-preview';
    if (tab.thumbnail) {
      preview.appendChild(createImage(tab.thumbnail, 'quicktab-shot'));
    } else {
      // 还没截过图的标签（受限页面、扩展启动后未打开过）显示大图标
      const tile = document.createElement('div');
      tile.className = 'quicktab-tile';
      tile.appendChild(createIcon(tab, 'quicktab-tile-icon'));
      preview.appendChild(tile);
    }
    if (tab.current) {
      const badge = document.createElement('span');
      badge.className = 'quicktab-badge';
      badge.textContent = 'Current';
      preview.appendChild(badge);
    }
    card.appendChild(preview);

    const meta = document.createElement('div');
    meta.className = 'quicktab-meta';
    meta.appendChild(createIcon(tab, 'quicktab-favicon'));

    const text = document.createElement('div');
    text.className = 'quicktab-text';
    const titleEl = document.createElement('div');
    titleEl.className = 'quicktab-title';
    titleEl.textContent = title;
    text.appendChild(titleEl);
    if (url) {
      const urlEl = document.createElement('div');
      urlEl.className = 'quicktab-url';
      urlEl.textContent = url;
      text.appendChild(urlEl);
    }
    meta.appendChild(text);
    card.appendChild(meta);

    card.addEventListener('click', () => switchToTab(tab.id));
    // 只响应真实的鼠标移动：面板弹出时光标恰好停在某张卡片上不改变选中项
    card.addEventListener('mousemove', () => {
      if (root.activeElement !== card) card.focus({ preventScroll: true });
    });
    card.addEventListener('focus', () => card.setAttribute('aria-selected', 'true'));
    card.addEventListener('blur', () => card.setAttribute('aria-selected', 'false'));

    return card;
  }

  // ========== 交互 ==========

  function getCards() {
    return root ? Array.from(root.querySelectorAll('.quicktab-card')) : [];
  }

  function switchToTab(tabId) {
    hidePanel();

    chrome.runtime.sendMessage({ action: 'switchToTab', tabId })
      .then((response) => {
        if (!response?.success) {
          console.error('QuickTab: Failed to switch tab', response?.error);
        }
      })
      .catch((error) => console.error('QuickTab: Failed to switch tab', error));
  }

  function activateFocusedTab() {
    const focusedCard = root?.activeElement;
    const tabId = Number.parseInt(focusedCard?.dataset?.tabId || '', 10);

    if (Number.isInteger(tabId) && tabId > 0) {
      switchToTab(tabId);
      return;
    }

    hidePanel();
  }

  function wrapSelectionIndex(index, count) {
    return ((index % count) + count) % count;
  }

  function initialSelectionIndex(count) {
    return wrapSelectionIndex(1 + pendingShortcutOffset, count);
  }

  function cycleShortcutSelection(direction) {
    if (root?.childElementCount) cycleSelection(direction);
    else pendingShortcutOffset += direction;
  }

  function revealCard(card) {
    const grid = card.parentElement;
    const viewport = grid.getBoundingClientRect();
    const bounds = card.getBoundingClientRect();
    const scale = viewport.width / grid.offsetWidth;
    if (bounds.left < viewport.left) grid.scrollLeft -= Math.ceil((viewport.left - bounds.left) / scale);
    else if (bounds.right > viewport.right) grid.scrollLeft += Math.ceil((bounds.right - viewport.right) / scale);
  }

  function focusCard(card) {
    card.focus({ preventScroll: true });
    revealCard(card);
  }

  function cycleSelection(direction) {
    const cards = getCards();
    if (cards.length === 0) return;

    const currentIndex = cards.indexOf(root.activeElement);
    const nextIndex = wrapSelectionIndex(currentIndex + direction, cards.length);
    focusCard(cards[nextIndex]);
  }

  function hidePanel() {
    panelRequestId += 1;
    // 快速轻按时面板没渲染过，也要通知 background 恢复截图
    if (panelOpenReported) {
      panelOpenReported = false;
      chrome.runtime.sendMessage({ action: 'panelClosed' }).catch(() => {});
    }
    root?.replaceChildren();
    host?.remove();

    panelVisible = false;
    altKeyDown = false;
    confirmPending = false;
  }

  // ========== 键盘交互 ==========

  function trackAlt(e) {
    altHeld = e.key === 'Alt' ? e.type === 'keydown' : e.altKey;
    if (e.key === 'Alt' && e.type === 'keyup') lastAltUpAt = performance.now();
  }

  function onKeyDown(e) {
    trackAlt(e);
    if (!panelVisible) return;
    // 面板打开期间不让按键漏到页面快捷键
    e.stopImmediatePropagation();

    const key = e.key.toLowerCase();

    if (!stickyMode && altShortcutOpen && e.key === 'Alt') {
      altKeyDown = true;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      hidePanel();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      activateFocusedTab();
      return;
    }

    const isQ = /^[a-z]$/i.test(e.key) ? key === 'q' : e.code === 'KeyQ';
    if (isQ && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      cycleShortcutSelection(-1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      cycleSelection(e.shiftKey ? -1 : 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || key === 'j') {
      e.preventDefault();
      cycleSelection(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || key === 'k') {
      e.preventDefault();
      cycleSelection(-1);
    }
  }

  // 松开 Alt 时自动切换（仅非 sticky 模式）
  function onKeyUp(e) {
    trackAlt(e);
    if (!panelVisible) return;
    e.stopImmediatePropagation();
    if (stickyMode || e.key !== 'Alt' || !altKeyDown) return;

    e.preventDefault();
    altKeyDown = false;
    if (root?.childElementCount) {
      activateFocusedTab();
    } else {
      confirmPending = true;
    }
  }

  // 焦点离开页面（地址栏、其他窗口）时收不到 Alt 松开事件，直接关闭
  function onBlur() {
    altHeld = null;
    if (panelVisible) hidePanel();
  }

  function onVisibilityChange() {
    if (!document.hidden) return;
    altHeld = null;
    if (panelVisible) hidePanel();
  }

  // ========== 消息监听 ==========

  const practiceTab = location.href.startsWith(chrome.runtime.getURL('practice.html') + '?guide=')
    ? chrome.tabs.getCurrent()
    : null;

  function onMessage(message, _sender, sendResponse) {
    if (message.action === 'togglePanel') {
      showPanel(message.altShortcut !== false);
      sendResponse({ success: true });
    }
    if (message.action === 'togglePracticePanel' && practiceTab) {
      practiceTab.then((tab) => {
        if (tab?.id !== message.tabId) return;
        showPanel(message.altShortcut !== false);
        sendResponse({ success: true });
      });
      return true;
    }
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', () => {
    if (panelVisible) layoutPanel();
  });
  document.addEventListener('visibilitychange', onVisibilityChange);
  chrome.storage.onChanged.addListener(onStorageChanged);
  chrome.runtime.onMessage.addListener(onMessage);

  globalThis.__quicktabCleanup = () => {
    hidePanel();
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.runtime.onMessage.removeListener(onMessage);
    } catch {
      // 旧实例的扩展上下文已失效
    }
  };
})();
