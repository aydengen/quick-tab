# QuickTab 隐私政策 / Privacy Policy

最后更新 / Last updated: 2026-11-26

## 中文

QuickTab 是一个 Chrome 标签页切换扩展。它不收集、不出售、不传输任何用户数据。

**扩展在你的电脑上处理哪些数据**

- 最近使用的标签页的标题、网址和网站图标：用来在切换面板中列出这些标签页。
- 当前可见标签页的缩略图：通过 `chrome.tabs.captureVisibleTab` 截取，显示在切换面板的卡片上。
- 扩展设置（例如 Sticky 模式）。

**数据存在哪里**

- 标签页列表和缩略图保存在 `chrome.storage.session` 中，只在本机内存里，关闭浏览器后自动清空。
- 设置保存在 `chrome.storage.local` 中，只在本机。
- 无痕窗口和普通窗口的标签页互不显示。

**数据不会离开你的电脑**

QuickTab 没有服务器，不使用分析或追踪工具，不加载远程代码，也不与任何第三方共享数据。切换面板运行在封闭的 Shadow DOM 中，网页脚本读不到你其他标签页的信息。

**权限用途**

- `tabs`：读取标签页的标题、网址和图标，并切换到你选择的标签页。
- `storage`：在本地保存最近标签列表、缩略图和设置。
- `activeTab`、`scripting`：在安装或更新前就已打开的页面上，按下快捷键时注入面板脚本。
- `favicon`：从 Chrome 的图标缓存读取网站图标。
- 访问所有网站（`<all_urls>`）：在网页上显示切换面板，并截取当前可见标签页作为缩略图。

**联系方式**

如有问题，请在 https://github.com/aydengen/quick-tab/issues 提交 issue。

## English

QuickTab is a tab switcher extension for Chrome. It does not collect, sell, or transmit any user data.

**What the extension handles on your computer**

- Titles, URLs, and icons of recently used tabs, to list them in the switcher.
- A thumbnail of the visible tab, captured with `chrome.tabs.captureVisibleTab`, to show on the switcher cards.
- Your extension settings (for example, Sticky mode).

**Where it is stored**

- The recent-tab list and thumbnails are kept in `chrome.storage.session`, in memory on your computer only, and are cleared when you close the browser.
- Settings are kept in `chrome.storage.local`, on your computer only.
- Incognito and regular windows never show each other's tabs.

**Nothing leaves your computer**

QuickTab has no server, uses no analytics or tracking, loads no remote code, and shares no data with third parties. The switcher panel runs in a closed Shadow DOM, so web pages cannot read information about your other tabs.

**Why each permission is needed**

- `tabs`: read tab titles, URLs, and icons, and switch to the tab you choose.
- `storage`: keep the recent-tab list, thumbnails, and settings locally.
- `activeTab`, `scripting`: inject the panel script when you press the shortcut on a page that was open before the extension was installed or updated.
- `favicon`: read site icons from Chrome's favicon cache.
- Access to all sites (`<all_urls>`): show the switcher panel on web pages and capture the visible tab as a thumbnail.

**Contact**

Questions? Open an issue at https://github.com/aydengen/quick-tab/issues.
