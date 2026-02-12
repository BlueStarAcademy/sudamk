# 배포된 사이트에서 "백엔드 서버에 연결할 수 없습니다" / 로그인 실패

## 원인 정리

이 메시지는 **프론트엔드가 `/api/auth/login`을 호출했을 때** 다음 중 하나일 때 나옵니다.

1. **응답이 HTML인 경우**  
   (백엔드가 꺼져 있거나, 잘못된 URL로 요청해 404/502 HTML 페이지가 온 경우)
2. **네트워크 오류**  
   (CORS, 타임아웃, DNS 실패, 백엔드 서비스 다운)

---

## 체크리스트

### 1. 백엔드 서비스가 떠 있는지 확인

- **Railway Dashboard** → 프로젝트 → **SUDAM** / **SUDAM-API**
- 상태가 **Online**인지 확인
- **Crashed** / **Initializing** 이면 로그인 요청이 실패할 수 있음 → 해당 서비스 **Redeploy** 또는 로그 확인

### 2. 배포 구조에 따른 설정

#### A) 서비스 1개 (SUDAM 하나에서 프론트+백엔드 모두 서빙)

- 같은 도메인에서 API도 제공하므로 **VITE_API_URL 설정 불필요**
- 이 서비스가 **Online**이어야 하고, **Postgres 연결**이 되어 있어야 로그인 가능
- Postgres 연결이 끊기면 `/api/auth/login`이 500을 반환할 수 있음 (이때는 JSON으로 에러가 오면 "백엔드 연결 불가"가 아닌 다른 메시지가 나올 수 있음)

#### B) 서비스 2개 (프론트 전용 + 백엔드 전용)

- **프론트엔드 서비스** Railway Variables에 **빌드 시점**에 다음이 들어가야 함:
  ```env
  VITE_API_URL=https://<백엔드-서비스-도메인>
  VITE_WS_URL=wss://<백엔드-서비스-도메인>
  ```
  예: 백엔드가 `sudam-api-production.up.railway.app` 이면
  ```env
  VITE_API_URL=https://sudam-api-production.up.railway.app
  VITE_WS_URL=wss://sudam-api-production.up.railway.app
  ```
- **VITE_*** 변수는 빌드 시점에 코드에 박히므로**, 값을 바꾼 뒤 **반드시 재배포(재빌드)** 해야 적용됨
- 백엔드 서비스가 **Crashed**면 같은 증상이 남 → 백엔드 로그/상태 확인

### 3. 백엔드 Variables

- **백엔드 서비스**에서:
  - `DATABASE_URL` 이 **내부 주소**로 설정되어 있는지  
    (`postgres.railway.internal:5432` 권장)
  - Postgres 서비스와 **Connected** 되어 있는지

### 4. 브라우저에서 실제 요청 확인

1. 배포된 사이트 로그인 화면에서 **F12 → Network**
2. 로그인 버튼 클릭
3. **login** 또는 **auth/login** 요청 선택
   - **Request URL**: 어디로 요청이 가는지 확인  
     - 같은 도메인인지, 별도 백엔드 도메인인지
   - **Status**: 0 (실패), 404, 502, 503 이면 백엔드 미동작/잘못된 URL
   - **Response**: HTML이면 "백엔드 서버에 연결할 수 없습니다"가 나오는 경우

---

## 요약

| 상황 | 조치 |
|------|------|
| 백엔드 서비스 Crashed | 해당 서비스 Redeploy, 로그 확인 |
| 프론트/백 분리인데 VITE_API_URL 없음 | 프론트 서비스에 VITE_API_URL, VITE_WS_URL 설정 후 **재빌드·재배포** |
| DB 연결 끊김 | Postgres 연결 복구, DATABASE_URL(내부 주소) 확인 |
| 요청 URL이 잘못됨 | 위 변수와 실제 백엔드 도메인 일치 여부 확인 |

로그인 API는 `components/Login.tsx`에서 `getApiUrl('/api/auth/login')`를 사용하며,  
실제 베이스 URL은 `utils/apiConfig.ts`의 `VITE_API_URL` / `VITE_BACKEND_URL` (프로덕션) 또는 같은 도메인(빈 문자열)입니다.
