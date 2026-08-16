/* ============================================
   宅家激励 App — Service Worker
   PWA 离线缓存策略：Cache First（缓存优先）
   ============================================ */

// 缓存名称（更新版本号可强制刷新缓存）
const CACHE_NAME = 'zhajiaji-v1.1';

// 需要预缓存的关键文件
const PRE_CACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/tasks.js',
  './js/pet.js',
  './js/app.js',
  './manifest.json'
];

// ==================== 安装事件：预缓存 ====================
self.addEventListener('install', function (event) {
  console.log('[SW] 安装中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        console.log('[SW] 预缓存文件:', PRE_CACHE_URLS);
        return cache.addAll(PRE_CACHE_URLS);
      })
      .then(function () {
        console.log('[SW] 安装完成');
        return self.skipWaiting();
      })
      .catch(function (err) {
        console.error('[SW] 预缓存失败:', err);
      })
  );
});

// ==================== 激活事件：清理旧缓存 ====================
self.addEventListener('activate', function (event) {
  console.log('[SW] 激活中...');
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              console.log('[SW] 删除旧缓存:', key);
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        console.log('[SW] 激活完成');
        return self.clients.claim();
      })
  );
});

// ==================== 请求拦截：缓存优先 ====================
self.addEventListener('fetch', function (event) {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(function (cachedResponse) {
        if (cachedResponse) {
          // 缓存命中，直接返回
          return cachedResponse;
        }

        // 缓存未命中，发起网络请求并缓存
        return fetch(event.request)
          .then(function (response) {
            // 不缓存非成功的响应
            if (!response || response.status !== 200) {
              return response;
            }

            // 只缓存同源请求
            if (event.request.url.startsWith(self.location.origin)) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(function (cache) {
                  cache.put(event.request, responseToCache);
                });
            }

            return response;
          })
          .catch(function () {
            // 网络失败，返回离线页面（对于 HTML 请求返回 index.html）
            if (event.request.headers.get('accept') &&
                event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            // 其他资源直接失败
            return new Response('离线状态，此资源不可用', { status: 503 });
          });
      })
  );
});
