# SUDAM-API 배포 장애 진단 보고서

## 증상 요약

- **서버**: 프로세스는 실행 중 (Keep-alive 정상)
- **문제**: DB 연결/쿼리가 반복적으로 타임아웃
- **로그 패턴**:
  - `getAllActiveGames timeout after 5000ms. Skipping for 120s` (약 2분마다)
  - `updateGameStates timeout (5000ms) for 20 games, using original state`

## 원인 분석

### 1. DB 쿼리 지연
- `getAllActiveGames`: Prisma가 `LiveGame`에서 최대 20개를 `data`(JSON) 포함 조회
- 5초 내 미완료 시 타임아웃 → 빈 배열 반환
- Railway Postgres가 느리거나 연결 불안정일 가능성

### 2. MainLoop 흐름
```
getAllActiveGames 타임아웃 
  → 120초 백오프 (DB 호출 스킵)
  → 그동안 캐시에서 20게임 사용
  → updateGameStates(20게임) 호출
  → processGame마다 getCachedUser(DB), saveGame(DB) 등 수행
  → 5초 내 완료 못해 타임아웃
```

### 3. DB 의존 구조
- `updateGameStates` → `processGame` → `getCachedUser` (캐시 미스 시 DB)
- `processGame` → `db.saveGame` (게임 상태 저장)
- `summaryService.endGame` (게임 종료 시 DB 다수 호출)

## 조치 권장 사항

### 즉시 확인 (Railway 대시보드)

1. **Postgres 서비스**
   - CPU, 메모리, 디스크 사용량
   - 연결 수 (최대 연결 제한)
   - 일시중지 여부

2. **DATABASE_URL**
   - 내부 네트워크 사용 여부:  
     `postgres.railway.internal:5432` (권장)  
     vs `xxx.up.railway.app:xxxx` (공개 URL, 느릴 수 있음)
   - Railway 프로젝트 내에서 API와 DB가 같은 프로젝트인지 확인

3. **서비스 재시작**
   - Postgres, API 서비스 둘 다 재시작 권장

### 코드/설정 개선 (적용됨)

- [x] Railway 환경에서 DB 타임아웃 완화 (5초 → 10초)
- [x] 백오프 중에도 캐시된 게임으로 updateGameStates 수행 (게임 진행 유지)
- [x] 연결 풀 설정 검토 (connection_limit 등)

## "Failed to fetch" / 로그인 연결 실패 시

프론트(https://sudam.up.railway.app) → 백엔드(https://sudam-api-production.up.railway.app) 요청이 실패할 때:

1. **Railway SUDAM-API Variables** 에 다음 추가/확인:
   - `FRONTEND_URL=https://sudam.up.railway.app`

2. **브라우저 개발자도구 → Network** 에서:
   - 로그인 시도 시 `login` 또는 `auth/login` 요청 확인
   - Status가 `(failed)` 또는 CORS 관련 에러 메시지인지 확인
   - OPTIONS(preflight) 요청이 200인지 확인

3. **SUDAM-API 서비스 재배포** 후 재시도


배포 후 다음을 확인하세요:

- [ ] `getAllActiveGames timeout` 로그 감소 또는 사라짐
- [ ] `updateGameStates timeout` 로그 감소 또는 사라짐
- [ ] 클라이언트 WebSocket 연결 안정성
- [ ] 게임 진행/저장 정상 동작
