// Service worker
//
// 上一版的問題：預先快取清單寫死 '/assets/index.js'，但 Vite 產出的是帶 hash 的檔名，
// 那個路徑永遠 404，cache.addAll() 整組 reject，install 失敗，所以 SW 從來沒有真的裝上去過。
//
// 這一版的原則：
// 1. 只預先快取一定存在的東西（index.html、manifest），不碰任何帶 hash 的檔名
// 2. 導覽請求走「網路優先」，避免部署新版之後使用者拿到舊的 HTML 卻配上已刪除的 assets（白屏）
// 3. 帶 hash 的靜態資源走「快取優先」，因為內容變了檔名一定會變，不會拿到過期的東西
// 4. 換版時清掉所有舊快取，並立刻接管頁面

const VERSION = 'v2-2026-08-17';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // 逐一加入而不是 addAll：任何一項失敗都不該讓整個安裝掛掉
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => {
            /* 這一項拿不到就算了，不影響其他項 */
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL && k !== ASSETS)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 導覽請求：網路優先，斷線才回快取的 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((r) => r || Response.error())
        )
    );
    return;
  }

  // 靜態資源：快取優先，沒有再抓網路並存起來
  if (url.pathname.startsWith('/assets/') || /\.(css|js|woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
