# Chrome Web Store dashboard copy / 商店后台填写文案

## English

**Single purpose:** QuickTab lets users switch to a recently used Chrome tab with a keyboard shortcut. The switcher shows local thumbnails and tab details so users can recognize the tab they want.

**Permission justifications**

| Permission | Text to paste |
| --- | --- |
| `tabs` | Read titles, URLs, and favicon information across open tabs to label the recent-tab list. QuickTab keeps this list in Chrome’s session storage and uses it only for the tab switcher. |
| `storage` | Store the recent-tab list and thumbnails in Chrome’s on-device session storage, which clears when Chrome quits. Store preferences and the user’s local preview consent in on-device local storage. |
| `scripting` | Inject the bundled panel script on demand when the shortcut is used on a page that was already open before installation or an update and does not yet have the content script. No code is fetched remotely. |
| `favicon` | Retrieve tab icons from Chrome’s favicon cache for the switcher without sending tab URLs to an external favicon service. |
| `<all_urls>` (host permission and content-script matches) | Show the switcher on ordinary web pages regardless of origin, including on tabs open before installation when on-demand injection is needed. After the user opts in, capture the visible web tab automatically so a recent tab already has a thumbnail when it is no longer active. A temporary shortcut grant alone cannot populate previews as users browse. Chrome-restricted pages are excluded from capture. |

**Remote code:** No. JavaScript is bundled in the extension. The privacy policy and GitHub links are opened only when the user clicks them.

**Data usage:** Disclose **Web history** (recent tab URLs and associated titles/icons) and **Website content** (visible-page thumbnails). QuickTab displays these only in the switcher, processes them on-device after consent, and does not upload them. It does not separately collect the other listed categories, log keystrokes, or track interaction for analytics. Certify all three statements: no selling or transferring data outside approved use cases; no use or transfer for purposes unrelated to the single purpose; no use or transfer for creditworthiness or lending.

**Privacy policy URL:** https://aydengen.github.io/quick-tab/en/privacy.html

**Listing disclosure:** When you allow local tab previews, QuickTab remembers recent tab titles, URLs, and icons and automatically captures visible web tabs to show thumbnails in the switcher. The list and thumbnails stay in Chrome’s session storage on this device and clear when you quit Chrome. Nothing is sent or shared.

## 简体中文

**单一用途：** QuickTab 让用户通过快捷键切换到最近使用的 Chrome 标签页。切换面板显示本地缩略图和标签页信息，便于识别要切换的页面。

**权限说明**

| 权限 | 填写文案 |
| --- | --- |
| `tabs` | 读取已打开标签页的标题、网址和网站图标信息，以标识最近使用的标签页。列表仅保存在 Chrome 会话存储中，仅用于标签页切换。 |
| `storage` | 最近标签页列表和缩略图保存在本机的 Chrome 会话存储中，退出 Chrome 后清除。偏好设置和本地预览授权保存在本机的扩展存储中。 |
| `scripting` | 在安装或更新前已经打开、尚未注入内容脚本的页面上，按下快捷键时按需注入随扩展打包的面板脚本。不从远程获取代码。 |
| `favicon` | 使用 Chrome 图标缓存为切换面板提供网站图标，不向外部图标服务发送标签页网址。 |
| `<all_urls>`（主机权限及内容脚本匹配范围） | 在不同网站的普通网页上显示切换面板，包括按需注入到安装前就已打开的页面。用户授权后，在浏览时自动对当前可见网页截图，以便标签页切到后台后仍有缩略图可用。仅靠快捷键授予的临时权限无法在浏览时生成这些预览。不截取 Chrome 限制访问的页面。 |

**远程代码：** 否。JavaScript 随扩展打包。隐私政策和 GitHub 链接仅在用户点击时打开。

**数据使用：** 勾选 **网络记录（Web history）**和**网站内容（Website content）**，分别对应最近标签页网址及相关标题、图标，以及可见网页的缩略图。获授权后仅在本机处理，仅用于切换面板，不上传。不单独收集其他类别的数据，不记录按键或跟踪用户操作做分析。勾选三项声明：不在获准用途之外出售或转移数据；不将数据用于或转移以供与单一用途无关的目的；不将数据用于或转移以供衡量信用或贷款。

**隐私政策网址：** https://aydengen.github.io/quick-tab/privacy.html

**商店详情页披露：** 如果你允许本地预览，QuickTab 会记录最近使用的标签页标题、网址及图标，并自动截取当前可见网页，在切换面板中显示缩略图。列表和缩略图仅存于本机的 Chrome 会话存储，退出 Chrome 后清除，不会向外发送或共享。
