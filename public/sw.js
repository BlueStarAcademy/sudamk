// Service Worker for PWA
// 캐시 버전을 빌드 타임스탬프로 업데이트 (자동으로 변경됨)
const CACHE_NAME = 'sudam-v' + new Date().getTime();
const IMAGE_CACHE_NAME = 'sudam-images-v' + new Date().getTime();
const urlsToCache = [
  '/',
  '/index.html',
  '/index.css',
  '/images/Icon.png',
  '/manifest.json'
];

// 자주 사용되는 이미지 목록 (UI 아이콘, 등급 배경 등)
const priorityImages = [
  '/images/icon/Gold.png',
  '/images/icon/Zem.png',
  '/images/equipments/normalbgi.png',
  '/images/equipments/uncommonbgi.png',
  '/images/equipments/rarebgi.png',
  '/images/equipments/epicbgi.png',
  '/images/equipments/legendarybgi.png',
  '/images/equipments/mythicbgi.png',
  '/images/equipments/Star1.png',
  '/images/equipments/Star2.png',
  '/images/equipments/Star3.png',
  '/images/equipments/Star4.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // 기본 리소스 캐싱
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('[Service Worker] Caching files');
          return cache.addAll(urlsToCache);
        })
        .catch((error) => {
          console.error('[Service Worker] Cache failed:', error);
        }),
      // 우선순위 이미지 캐싱 (백그라운드에서)
      caches.open(IMAGE_CACHE_NAME)
        .then((cache) => {
          console.log('[Service Worker] Caching priority images');
          // 실패해도 계속 진행
          return Promise.allSettled(
            priorityImages.map(url => 
              fetch(url).then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              }).catch(() => {})
            )
          );
        })
    ])
  );
  self.skipWaiting();
});

// skipWaiting 메시지 수신 시 즉시 활성화
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 현재 캐시가 아니면 모두 삭제
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 모든 클라이언트에 즉시 제어권 부여
      return self.clients.claim();
    })
  );
});

// Fetch event - Network First strategy for better updates
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Service Worker는 같은 origin의 요청만 처리
  // 외부 도메인(백엔드 API 등)의 요청은 Service Worker를 거치지 않음
  if (url.origin !== self.location.origin) {
    // 외부 도메인 요청은 Service Worker를 거치지 않고 네트워크로 직접 전달
    return;
  }
  
  // POST, PUT, DELETE 등 비GET 요청은 네트워크로 직접 전달 (캐시 불가)
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // http:// 또는 https:// 스킴만 캐시 가능 (chrome-extension:, data: 등은 제외)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    event.respondWith(fetch(request));
    return;
  }
  
  // API 요청(/api, /ws)은 네트워크로 직접 전달
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // HTML, JS, CSS 파일은 네트워크 우선 전략 사용 (항상 최신 버전)
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 네트워크에서 성공하면 캐시에 저장하고 반환 (GET 요청만, http/https만)
          if (response && response.status === 200 && request.method === 'GET' && 
              (url.protocol === 'http:' || url.protocol === 'https:')) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch((error) => {
                // 캐시 실패는 무시 (chrome-extension 등 지원하지 않는 스킴)
                console.warn('[Service Worker] Cache put failed:', error);
              });
            });
          }
          return response;
        })
        .catch(() => {
          // 네트워크 실패 시에만 캐시에서 제공
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // HTML 요청이고 캐시에도 없으면 index.html 반환
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
        })
    );
  } else {
    // 이미지 등 정적 리소스는 캐시 우선 전략 사용 (GET 요청만)
    event.respondWith(
      caches.match(request, { cacheName: IMAGE_CACHE_NAME })
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // IMAGE_CACHE에 없으면 CACHE_NAME에서도 확인
          return caches.match(request, { cacheName: CACHE_NAME });
        })
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 캐시에 없으면 네트워크에서 가져오고 캐시에 저장 (GET 요청만, http/https만)
          return fetch(request).then((response) => {
            if (response && response.status === 200 && request.method === 'GET' && 
                (url.protocol === 'http:' || url.protocol === 'https:')) {
              const responseToCache = response.clone();
              // 이미지는 IMAGE_CACHE에 저장
              caches.open(IMAGE_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache).catch((error) => {
                  // 캐시 실패는 무시 (chrome-extension 등 지원하지 않는 스킴)
                  console.warn('[Service Worker] Cache put failed:', error);
                });
              });
            }
            return response;
          });
        })
        .catch(() => {
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        })
    );
  }
});

