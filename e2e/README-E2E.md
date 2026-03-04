# E2E 테스트

## 개요

- **smoke.spec.ts**: 앱 로드 여부
- **pvp-two-clients.spec.ts**: 두 클라이언트 동시 로드
- **ai-and-pve-games.spec.ts**: 로그인 후 싱글플레이, 도전의 탑, 전략바둑 AI 대결, 놀이바둑 AI 대결 진입 및 게임 시작

## 실행 조건

1. **서버·클라이언트 실행**  
   `npm run test:e2e` 시 Playwright가 `npm run start`로 기동하거나, 이미 `http://localhost:5173`에서 서비스 중이어야 합니다.

2. **테스트 유저**  
   `ai-and-pve-games.spec.ts`는 로그인이 필요합니다.  
   - 기본: 아이디 `푸른별`, 비밀번호 `1217` (seed 데이터와 동일)  
   - 변경: 환경 변수 `E2E_USERNAME`, `E2E_PASSWORD` 설정

```bash
# 기본 유저로 실행
npm run test:e2e

# 다른 유저로 실행
E2E_USERNAME=myuser E2E_PASSWORD=mypass npm run test:e2e
```

## 검증 내용 (ai-and-pve-games)

- **전략바둑 AI**: 대기실(전략) → "AI와 대결하기" → 모달에서 "시작" → `#/game/:id` 진입, 게임 영역 노출
- **놀이바둑 AI**: 대기실(놀이) → 동일 흐름으로 AI 대국 시작 및 게임 화면 노출
- **싱글플레이**: 싱글플레이 로비 → 첫 스테이지(1) 클릭 → 게임 진입 또는 로비 유지
- **도전의 탑**: 탑 로비 → 1층 "도전" 클릭 → 게임 진입 또는 탑 로비 유지

바둑 규칙·아이템·계가 등은 서버/클라이언트 통합 테스트(`server/__tests__/integration/pvpStrategic.test.ts`)에서 검증합니다.
