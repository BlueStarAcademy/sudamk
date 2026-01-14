# 프론트엔드-백엔드 연결 문제 해결

## 문제 증상
- 로그인 시도 시 "백엔드 서버에 연결할 수 없습니다" 메시지
- 브라우저 콘솔에 네트워크 에러 또는 CORS 에러

## 원인
프론트엔드가 백엔드 API URL을 찾지 못함
- `VITE_API_URL` 환경 변수가 설정되지 않음
- 또는 잘못된 URL이 설정됨

## 해결 방법

### 1. 백엔드 서비스 URL 확인

Railway 대시보드에서:
1. **Backend 서비스** 클릭
2. **Settings** → **Networking** 탭
3. **Public Domain** 확인
   - 예: `https://sudam-backend-production.up.railway.app`
   - 또는: `https://sudam.up.railway.app` (백엔드가 메인 도메인인 경우)

### 2. 프론트엔드 서비스 환경 변수 설정

Railway 대시보드에서:
1. **Frontend 서비스** 클릭
2. **Variables** 탭 클릭
3. 다음 환경 변수 추가/수정:

```
VITE_API_URL=https://your-backend-url.railway.app
```

**중요:**
- `https://`로 시작해야 함
- 마지막에 `/` 없이 설정
- 백엔드 서비스의 실제 Public Domain 사용

예시:
```
VITE_API_URL=https://sudam-backend-production.up.railway.app
```

### 3. 프론트엔드 재배포

환경 변수를 추가/수정한 후:
1. **Deployments** 탭으로 이동
2. **Redeploy** 버튼 클릭
   - 또는 새 커밋을 푸시하면 자동 재배포됨

### 4. 브라우저에서 확인

배포 완료 후:
1. 브라우저 개발자 도구 열기 (F12)
2. **Console** 탭 확인
3. 페이지 새로고침
4. 다음 로그가 보여야 함:
   ```
   [API Config] Environment check:
   [API Config] - VITE_API_URL: https://your-backend-url.railway.app
   ```

### 5. 테스트

1. 로그인 페이지 접속
2. 브라우저 개발자 도구 → **Network** 탭 열기
3. 로그인 시도
4. `/api/auth/login` 요청 확인:
   - **Request URL**이 백엔드 URL을 가리키는지 확인
   - 예: `https://sudam-backend-production.up.railway.app/api/auth/login`

## 문제 해결 체크리스트

- [ ] 백엔드 서비스가 실행 중인지 확인 (Railway 대시보드)
- [ ] 백엔드 Public Domain 확인
- [ ] 프론트엔드 서비스에 `VITE_API_URL` 환경 변수 설정
- [ ] 환경 변수 값이 올바른지 확인 (https://로 시작, / 없음)
- [ ] 프론트엔드 재배포 완료
- [ ] 브라우저 캐시 삭제 후 다시 시도
- [ ] 브라우저 콘솔에서 API URL 로그 확인

## 추가 디버깅

브라우저 콘솔에서 확인:
```javascript
// API 설정 확인
console.log('API_BASE_URL:', import.meta.env.VITE_API_URL);
console.log('Current URL:', window.location.href);
```

Network 탭에서:
- 요청이 어디로 가는지 확인
- 응답 상태 코드 확인
- CORS 에러가 있는지 확인

## CORS 에러가 발생하는 경우

백엔드 서버의 CORS 설정 확인:
- `server/server.ts`에서 `corsOptions` 확인
- 프론트엔드 도메인이 허용 목록에 있는지 확인

