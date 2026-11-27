# Website typography

Apple's [San Francisco family](https://developer.apple.com/fonts/) is the reference. The website uses the platform system font on Apple devices through `-apple-system` / `BlinkMacSystemFont`; it does not bundle or request Apple's proprietary webfont files.

On other platforms, [Inter](https://rsms.me/inter/) provides a neutral, readable Latin fallback with variable weight and optical sizing. Chinese characters use `system-ui` / the browser's sans-serif fallback; no Chinese font is downloaded or explicitly selected.

## Bundled font

- `InterVariable.woff2`: the unmodified normal-style variable Inter 4.1 font. Its CSS face is restricted to the Latin/punctuation ranges declared in `styles.css`.
- Upstream: <https://raw.githubusercontent.com/rsms/inter/v4.1/docs/font-files/InterVariable.woff2>
- License: SIL Open Font License 1.1, included unchanged in `OFL.txt`. The font remains under this license, not the repository's MIT license.
- The font is served from this website, uses `font-display: swap`, and is not preloaded: Apple devices can use the native font without downloading Inter.

The committed font needs no build or font tooling to serve.
