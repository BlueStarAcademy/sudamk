// Service Worker for PWA
// 캝시 버전을 빌드 타임스탬프로 업띰이트 (잝띙으로 변경띨)
const CACHE_NAME = 'sudam-v' + new Date().getTime();
const IMAGE_CACHE_NAME = 'sudam-images-v' + new Date().getTime();
const urlsToCache = [
  '/',
  '/index.html',
  '/index.css',
  '/images/Icon.png',
  '/manifest.json'
];

// 잝주 사용띘는 이미지 목록 (UI 아이콘, 등급 배경 등)
const priorityImages = [
  '/images/icon/Gold.png',
  '/images/icon/Zem.png',
  '/images/equipments/normalbgi.png',
  '/images/equipments/uncommonbgi.png',
  '/images/equipments/rarebgi.png',
  '/images/equipments/epicbgi.png',
  '/images/equipments/legendarybgi.png',
  '/images/equipments/mythicbgi.png',
  '/images/equipments/transcendentbgi.webp',
  '/images/equipments/Star1.png',
  '/images/equipments/Star2.png',
  '/images/equipments/Star3.png',
  '/images/equipments/Star4.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // 기본 리소스 캝싱
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('[Service Worker] Caching files');
          return cache.addAll(urlsToCache);
        })
        .catch((error) => {
          console.error('[Service Worker] Cache failed:', error);
        }),
      // 우선순위 이미지 캝싱 (백그라운드엝서)
      caches.open(IMAGE_CACHE_NAME)
        .then((cache) => {
          console.log('[Service Worker] Caching priority images');
          // 실패해띄 계솝 진행
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
          // 현재 캝시가 아니면 모둝 삭제
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 모든 흴라이언트엝 즉시 제어권 부여
      return self.clients.claim();
    })
  );
});

// Fetch event - Network First strategy for better updates
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Service Worker는 같은 origin의 요청만 처리
  // 외부 띄메인(백엔드 API 등)의 요청은 Service Worker를 거치지 않음
  if (url.origin !== self.location.origin) {
    // 외부 띄메인 요청은 Service Worker를 거치지 않고 네트워희로 짝접 전달
    return;
  }
  
  // POST, PUT, DELETE 등 비GET 요청은 네트워희로 짝접 전달 (캝시 불가)
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // http:// 똝는 https:// 스킴만 캝시 가능 (chrome-extension:, data: 등은 제외)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    event.respondWith(fetch(request));
    return;
  }
  
  // API 요청(/api, /ws)은 네트워희로 짝접 전달
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // HTML, JS, CSS 파일은 네트워희 우선 전략 사용 (항생 최신 버전)
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 네트워희엝서 성공하면 캝시엝 저장하고 반환 (GET 요청만, http/https만)
          if (response && response.status === 200 && request.method === 'GET' && 
              (url.protocol === 'http:' || url.protocol === 'https:')) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch((error) => {
                // 캝시 실패는 무시 (chrome-extension 등 지웝하지 않는 스킴)
                console.warn('[Service Worker] Cache put failed:', error);
              });
            });
          }
          return response;
        })
        .catch(() => {
          // 네트워희 실패 시엝만 캝시엝서 제공
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // HTML 요청이고 캝시엝띄 없으면 index.html 반환
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
        })
    );
  } else {
    // 이미지 등 정젝 리소스는 캝시 우선 전략 사용 (GET 요청만)
    event.respondWith(
      caches.match(request, { cacheName: IMAGE_CACHE_NAME })
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // IMAGE_CACHE엝 없으면 CACHE_NAME엝서띄 확인
          return caches.match(request, { cacheName: CACHE_NAME });
        })
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 캝시엝 없으면 네트워희엝서 가져오고 캝시엝 저장 (GET 요청만, http/https만)
          return fetch(request).then((response) => {
            if (response && response.status === 200 && request.method === 'GET' && 
                (url.protocol === 'http:' || url.protocol === 'https:')) {
              const responseToCache = response.clone();
              // 이미지는 IMAGE_CACHE엝 저장
              caches.open(IMAGE_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache).catch((error) => {
                  // 캝시 실패는 무시 (chrome-extension 등 지웝하지 않는 스킴)
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

