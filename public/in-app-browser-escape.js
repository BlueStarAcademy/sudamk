/**
 * React·번들보다 먼저 실행 — 카카오톡 등 인앱 브라우저에서 외부 브라우저로 열기.
 * utils/inAppBrowserEscape.ts 와 동일 정책(인라인 복제).
 */
(function () {
  var STORAGE_KEY = 'sudamr.inAppBrowserEscape.v1';
  var ua = navigator.userAgent || '';

  function isKakaoTalk() {
    return /KAKAOTALK/i.test(ua);
  }

  function isMessagingInApp() {
    if (isKakaoTalk()) return true;
    if (/Line\//i.test(ua)) return true;
    if (/Instagram/i.test(ua)) return true;
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return true;
    if (/NAVER\(inapp/i.test(ua)) return true;
    return false;
  }

  if (!isMessagingInApp()) return;

  window.__SUDAMR_IN_APP_BROWSER__ = true;

  try {
    if (sessionStorage.getItem(STORAGE_KEY) === 'redirected') return;
    sessionStorage.setItem(STORAGE_KEY, 'redirected');
  } catch (e) {}

  var url = location.href;

  if (isKakaoTalk()) {
    location.replace('kakaotalk://web/openExternal?url=' + encodeURIComponent(url));
    return;
  }

  if (/Android/i.test(ua)) {
    var stripped = url.replace(/^https?:\/\//i, '');
    location.replace(
      'intent://' +
        stripped +
        '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end',
    );
  }
})();
