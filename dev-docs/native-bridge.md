# Native bridge (Android / iOS apps)

The apps (ශබ්දකෝෂය, `lk.pitaka.dictionary`) load the web app build `web/dist-app` (`npm run build:web:app`: relative
paths, hash routing) from local files and run the Go engine (`server/mobile`, gomobile) next to `dict.db`. One
asynchronous call (as tipitaka.app):

```
JS → native   Android: window.AruthaNative.query(id, request)              (@JavascriptInterface)
              iOS:     window.webkit.messageHandlers.arutha.postMessage({ id, request })
native → JS   window.__aruthaResolve(id, response)                         (on the UI thread)

request  = JSON {"op": "<operation>", ...string params}       e.g. {"op":"search","q":"buddhassa"}
response = engine.QueryJSON(request): {"ok": <result>} or {"error": "<code>", "message": "..."}
```
Operations and results are the same as `GET /api/<op>` (`server/engine/call.go`, types in `web/src/data/types.ts`).
`web/src/data/api.ts` picks the bridge when `AruthaNative` / `messageHandlers.arutha` exists.

Optional: Android `AruthaNative.share(text)` (the share sheet; iOS uses `navigator.share`) and
`AruthaNative.setChromeColors(top, bottom)` / iOS `messageHandlers.chrome`: an injected script reports the header and
page colours whenever the theme class of `<html>` changes, the status and navigation bars follow.

* **Android** (`/Volumes/2TB/Android/Dictionary-v3`, README there): `dict.db` in the install-time asset pack
  `dict_data`, copied to `getDatabasePath` on the first run and when the versionCode changes (`DbInstaller`; the debug
  build uses the fixture db). App Links: `https://arutha.lk/*` → `index.html#/<path>`, `pitaka.lk/dict*` → `#/dict/pali`.
* **iOS** (`apple/`, XcodeGen): `dict.db` in the bundle, opened read-only in place; the web build at `app://arutha/`
  (`BundleSchemeHandler`); Universal Links `applinks:arutha.lk` (`web/public/.well-known/apple-app-site-association`).
  Debug builds take `-start <route> -theme <light|sepia|dark>` (`xcrun simctl launch booted lk.pitaka.dictionary -start /love`).
* In the apps the web app hides the store links (`html.native .web-only`) and opens files of the site (pdf, privacy
  policy) on https://arutha.lk in the browser.
* `e2e/android.spec.ts` runs the app build with a simulated bridge.
