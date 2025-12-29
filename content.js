// QuickTab - Content Script
// 渲染 AltTab 风格面板

(function () {
  'use strict';

  const PANEL_ID = 'tabsnap-panel';
  const OVERLAY_ID = 'tabsnap-overlay';

  let panelVisible = false;

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
        console.log('QuickTab: Error getting tab list', chrome.runtime.lastError.message);
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

    // 面板头部
    const header = document.createElement('div');
    header.className = 'tabsnap-header';
    header.innerHTML = `
      <span class="tabsnap-title">Recent Tabs</span>
      <span class="tabsnap-hint">Press ESC to close</span>
    `;
    panel.appendChild(header);

    // 卡片容器
    const grid = document.createElement('div');
    grid.className = 'tabsnap-grid';

    if (tabs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tabsnap-empty';
      empty.textContent = 'No recent tabs yet. Switch between tabs to populate this list.';
      grid.appendChild(empty);
    } else {
      // 显示所有标签（当前标签在第一位）
      tabs.forEach((tab, index) => {
        const card = createTabCard(tab, index);
        // 标记当前标签
        if (index === 0) {
          card.classList.add('tabsnap-current');
        }
        grid.appendChild(card);
      });
    }

    panel.appendChild(grid);

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

  function createTabCard(tab, index) {
    const card = document.createElement('div');
    card.className = 'tabsnap-card';
    card.tabIndex = 0;
    card.dataset.tabId = tab.id;

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'tabsnap-favicon';
    favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌐</text></svg>';
    favicon.alt = '';
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌐</text></svg>';
    };
    card.appendChild(favicon);

    // 标题
    const title = document.createElement('span');
    title.className = 'tabsnap-card-title';
    title.textContent = tab.title || 'Untitled';
    title.title = tab.title || 'Untitled';
    card.appendChild(title);

    // 点击事件
    card.addEventListener('click', () => switchToTab(tab.id));

    return card;
  }

  // ========== 交互 ==========

  function switchToTab(tabId) {
    chrome.runtime.sendMessage({ action: 'switchToTab', tabId }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        console.log('QuickTab: Failed to switch tab', chrome.runtime.lastError?.message || response?.error);
      }
      hidePanel();
    });
  }

  // ========== 键盘交互 ==========

  let altKeyDown = false;

  // 按下键盘
  document.addEventListener('keydown', (e) => {
    if (!panelVisible) return;

    // 记录 Alt 键状态
    if (e.key === 'Alt') {
      altKeyDown = true;
    }

    // ESC 关闭
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hidePanel(false); // 不切换
      return;
    }

    // Enter 确认切换
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      hidePanel(true); // 切换到选中项
      return;
    }

    // Tab 或方向键循环选择
    if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      cycleSelection(e.shiftKey ? -1 : 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      cycleSelection(-1);
    }
  }, true);

  // 松开键盘 - 松开 Alt 时自动切换
  document.addEventListener('keyup', (e) => {
    if (!panelVisible) return;

    if (e.key === 'Alt' && altKeyDown) {
      e.preventDefault();
      altKeyDown = false;
      hidePanel(true); // 松开 Alt 时切换到选中项
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

  // 修改 hidePanel 支持切换
  function hidePanel(shouldSwitch = false) {
    const overlay = document.getElementById(OVERLAY_ID);
    const panel = document.getElementById(PANEL_ID);

    // 切换到选中的标签
    if (shouldSwitch) {
      const focusedCard = panel?.querySelector('.tabsnap-card:focus');
      const tabId = parseInt(focusedCard?.dataset.tabId);
      if (tabId) {
        switchToTab(tabId);
      }
    }

    if (overlay) {
      overlay.classList.add('tabsnap-fade-out');
      setTimeout(() => overlay.remove(), 150);
    }
    if (panel) {
      panel.classList.add('tabsnap-fade-out');
      setTimeout(() => panel.remove(), 150);
    }

    panelVisible = false;
    altKeyDown = false;
  }

  // ========== 消息监听 ==========

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'togglePanel') {
      altKeyDown = true; // 来自快捷键，认为 Alt 按下
      showPanel();
      sendResponse({ success: true });
    }
    return true;
  });

  console.log('QuickTab: Content script loaded');
})();
