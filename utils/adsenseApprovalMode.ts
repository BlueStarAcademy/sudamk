/**
 * AdSense 승인 심사 모드.
 *
 * `.env`/Railway에 `VITE_ADSENSE_APPROVAL_MODE=true` 설정 시 게임 앱에서 광고 코드를 0바이트로 만든다:
 * - AdProvider: adsbygoogle 스크립트 동적 주입·H5 adBreak 부트스트랩(preloadAdBreaks) 미실행
 * - useAds: 전면 광고 차단, 보상형은 광고 없이 즉시 보상 지급 (isAdFree 경로 재사용)
 * - AdBanner: 전 위치 렌더 안 함 (context isAdFree 경로 재사용)
 *
 * 근거: "게시자 콘텐츠가 없는 화면에 Google 게재 광고" 정책 — 광고 슬롯 숨김만으로는 부족하며
 * 광고 **코드** 자체가 콘텐츠 없는 화면(로그인·로비·대국)에 로드되면 위반으로 판정된다.
 * 승인 후 env 값을 제거/false로 바꾸고 재배포하면 기존 whitelist 광고가 복구된다.
 */
export const IS_ADSENSE_APPROVAL_MODE =
    (import.meta.env.VITE_ADSENSE_APPROVAL_MODE as string | undefined) === 'true';
