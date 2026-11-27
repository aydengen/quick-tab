# QuickTab 隐私政策 / Privacy Policy

最后更新 / Last updated: 2026-11-27

## 中文

QuickTab 是一个 Chrome 标签页切换扩展。它仅在你的设备上处理用户数据，不会向外传输、出售或共享这些数据。

**扩展在你的电脑上处理哪些数据**

- 你选择允许本地预览后，QuickTab 会记录最近使用的标签页标题、网址和网站图标，用来在切换面板中列出这些标签页。
- 在你浏览时，QuickTab 会自动截取当前可见网页并缩小为缩略图，仅用于切换面板预览。授权前不记录最近标签页，也不截图。
- 扩展设置（例如 Sticky 模式）。

没有本地预览授权提示的旧版本会在你浏览时开始记录最近标签页并生成缩略图。这些信息也仅保存在你的设备上。

**数据存在哪里**

- 标签页列表和缩略图保存在 `chrome.storage.session` 中，只在本机内存里，退出 Chrome 时自动清空。关闭标签页或其移出最近列表时，QuickTab 会移除对应缩略图。
- 设置保存在 `chrome.storage.local` 中，只在本机。
- 无痕窗口和普通窗口的标签页互不显示。

**数据不会离开你的电脑**

QuickTab 没有服务器，不使用分析或追踪工具，不加载远程代码，也不与任何第三方共享数据。切换面板运行在封闭的 Shadow DOM 中，网页脚本读不到你其他标签页的信息。

QuickTab 对通过 Google API 获取的信息的使用遵守 Chrome 网上应用店用户数据政策，包括「有限使用」要求。

**权限用途**

- `tabs`：读取标签页的标题、网址和图标，并切换到你选择的标签页。
- `storage`：在本地保存最近标签列表、缩略图和设置。
- `scripting`：在安装或更新前就已打开的页面上，按下快捷键时注入面板脚本。
- `favicon`：从 Chrome 的图标缓存读取网站图标。
- 访问所有网站（`<all_urls>`）：在网页上显示切换面板，并截取当前可见标签页作为缩略图。

**联系方式**

如有问题，请在 https://github.com/aydengen/quick-tab/issues 提交 issue。

## English

QuickTab is a tab switcher extension for Chrome. It handles user data only on your device and does not transmit, sell, or share it.

**What the extension handles on your computer**

- After you allow local previews, QuickTab remembers titles, URLs, and icons of recently used tabs to list them in the switcher.
- As you browse, QuickTab automatically captures visible web tabs and reduces the screenshots to thumbnails solely for switcher previews. It does not track recent tabs or take screenshots before you allow local previews.
- Your extension settings (for example, Sticky mode).

Older versions without the local previews prompt start tracking recent tabs and making thumbnails as you browse. They store the same information only on your device.

**Where it is stored**

- The recent-tab list and thumbnails are kept in `chrome.storage.session`, in memory on your computer only, and clear when you quit Chrome. QuickTab removes a thumbnail when its tab closes or drops off the recent list.
- Settings are kept in `chrome.storage.local`, on your computer only.
- Incognito and regular windows never show each other's tabs.

**Nothing leaves your computer**

QuickTab has no server, uses no analytics or tracking, loads no remote code, and shares no data with third parties. The switcher panel runs in a closed Shadow DOM, so web pages cannot read information about your other tabs.

QuickTab’s use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

**Why each permission is needed**

- `tabs`: read tab titles, URLs, and icons, and switch to the tab you choose.
- `storage`: keep the recent-tab list, thumbnails, and settings locally.
- `scripting`: inject the panel script when you press the shortcut on a page that was open before the extension was installed or updated.
- `favicon`: read site icons from Chrome's favicon cache.
- Access to all sites (`<all_urls>`): show the switcher panel on web pages and capture the visible tab as a thumbnail.

**Contact**

Questions? Open an issue at https://github.com/aydengen/quick-tab/issues.
