// QuickTab - Content Script
// 渲染 AltTab 风格面板

(function () {
  'use strict';

  const PANEL_ID = 'tabsnap-panel';
  const OVERLAY_ID = 'tabsnap-overlay';
  const FALLBACK_FAVICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">%F0%9F%8C%90</text></svg>';

  let panelVisible = false;
  let altKeyDown = false;
  let stickyMode = false;

  // 加载 sticky mode 设置
  chrome.storage.local.get('stickyMode', (result) => {
    stickyMode = result.stickyMode || false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.stickyMode) {
      stickyMode = changes.stickyMode.newValue || false;
    }
  });

  // ========== 面板管理 ==========

  function showPanel() {
    // 如果面板已打开，循环选择下一个（支持连续按 Alt+Q 切换）
    if (panelVisible) {
      cycleSelection(1);
      return;
    }

    // 立即标记为可见，防止连续按键时重复调用
    panelVisible = true;

    // 获取标签列表
    chrome.runtime.sendMessage({ action: 'getTabList' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('QuickTab: Error getting tab list', chrome.runtime.lastError.message);
        panelVisible = false; // 出错时重置状态
        return;
      }

      const tabs = response?.tabs || [];
      renderPanel(tabs);
    });
  }

  // ========== 渲染 ==========

  function renderPanel(tabs) {
    // 移除已存在的面板
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();

    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'tabsnap-overlay';
    overlay.addEventListener('click', () => hidePanel(false));

    // 创建面板
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'tabsnap-panel';

    // 卡片容器
    const grid = document.createElement('div');
    grid.className = 'tabsnap-grid';

    if (tabs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tabsnap-empty';
      empty.textContent = 'No recent tabs yet. Switch between tabs to populate this list.';
      grid.appendChild(empty);
    } else {
      tabs.forEach((tab, index) => {
        const card = createTabCard(tab);
        if (index === 0) {
          card.classList.add('tabsnap-current');
        }
        grid.appendChild(card);
      });
    }

    panel.appendChild(grid);

    // 快捷键提示
    const hints = document.createElement('div');
    hints.className = 'tabsnap-hints';
    hints.innerHTML = stickyMode
      ? '<span><kbd>↑↓</kbd> Navigate</span><span><kbd>Enter</kbd> Switch</span><span><kbd>Esc</kbd> Close</span>'
      : '<span><kbd>↑↓</kbd> Navigate</span><span><kbd>Enter</kbd> Switch</span><span><kbd>Esc</kbd> Close</span><span><kbd>Alt↑</kbd> Confirm</span>';
    panel.appendChild(hints);

    // 添加到页面
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // 自动聚焦第二个卡片（上一个访问的标签）
    const cards = panel.querySelectorAll('.tabsnap-card');
    const focusTarget = cards[1] || cards[0]; // 优先第二个，否则第一个
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  function createTabCard(tab) {
    const card = document.createElement('div');
    card.className = 'tabsnap-card';
    card.tabIndex = 0;
    card.dataset.tabId = tab.id;

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'tabsnap-favicon';
    favicon.src = tab.favIconUrl || FALLBACK_FAVICON;
    favicon.alt = '';
    favicon.onerror = () => {
      favicon.src = FALLBACK_FAVICON;
    };
    card.appendChild(favicon);

    // 文本区域
    const textWrap = document.createElement('div');
    textWrap.className = 'tabsnap-card-text';

    const title = document.createElement('span');
    title.className = 'tabsnap-card-title';
    title.textContent = tab.title || 'Untitled';
    title.title = tab.title || 'Untitled';
    textWrap.appendChild(title);

    if (tab.url) {
      const url = document.createElement('span');
      url.className = 'tabsnap-card-url';
      try {
        const u = new URL(tab.url);
        url.textContent = u.host + u.pathname.replace(/\/$/, '');
      } catch {
        url.textContent = tab.url;
      }
      textWrap.appendChild(url);
    }

    card.appendChild(textWrap);

    // 点击事件
    card.addEventListener('click', () => switchToTab(tab.id));

    return card;
  }

  // ========== 交互 ==========

  function switchToTab(tabId) {
    hidePanel();

    chrome.runtime.sendMessage({ action: 'switchToTab', tabId }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        console.error('QuickTab: Failed to switch tab', chrome.runtime.lastError?.message || response?.error);
      }
    });
  }

  function activateFocusedTab() {
    const focusedCard = document.querySelector(`#${PANEL_ID} .tabsnap-card:focus`);
    const tabId = Number.parseInt(focusedCard?.dataset.tabId || '', 10);

    if (Number.isInteger(tabId) && tabId > 0) {
      switchToTab(tabId);
      return;
    }

    hidePanel();
  }

  // ========== 键盘交互 ==========

  // 按下键盘
  document.addEventListener('keydown', (e) => {
    if (!panelVisible) return;

    // 记录 Alt 键状态（非 sticky 模式）
    if (!stickyMode && e.key === 'Alt') {
      altKeyDown = true;
    }

    // ESC 关闭
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hidePanel();
      return;
    }

    // Enter 确认切换
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      activateFocusedTab();
      return;
    }

    // Tab 或方向键循环选择
    if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      cycleSelection(e.shiftKey ? -1 : 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      cycleSelection(-1);
    }
  }, true);

  // 松开键盘 - 松开 Alt 时自动切换（仅非 sticky 模式）
  document.addEventListener('keyup', (e) => {
    if (!panelVisible || stickyMode) return;

    if (e.key === 'Alt' && altKeyDown) {
      e.preventDefault();
      altKeyDown = false;
      activateFocusedTab();
    }
  }, true);

  // 循环选择
  function cycleSelection(direction) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const cards = Array.from(panel.querySelectorAll('.tabsnap-card'));
    if (cards.length === 0) return;

    const currentIndex = cards.findIndex(c => c === document.activeElement);
    const nextIndex = (currentIndex + direction + cards.length) % cards.length;
    cards[nextIndex]?.focus();
  }

  function hidePanel() {
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();

    panelVisible = false;
    altKeyDown = false;
  }

  // ========== 消息监听 ==========

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'togglePanel') {
      altKeyDown = !stickyMode; // 非 sticky 模式下认为 Alt 按下
      showPanel();
      sendResponse({ success: true });
    }
  });
})();
