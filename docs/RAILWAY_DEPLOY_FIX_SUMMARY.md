# Railway 배포 오류 수정 요약

## 🔧 수정한 내용

### 1. Frontend 빌드 오류 해결

**문제:**
```
Type error: Property 'user' does not exist on type ...
```

**원인:**
- 프론트엔드에서 백엔드 타입(`@sudam/api/src/trpc/router`)을 import하려고 하는데
- Dockerfile.web에서 백엔드 소스 코드를 복사하지 않아서 타입을 찾을 수 없음

**해결 방법:**

#### 1-1. Dockerfile.web 수정
백엔드 소스 코드를 빌드 단계에 복사하도록 추가:
```dockerfile
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
```

#### 1-2. apps/web/tsconfig.json 수정
타입 경로 매핑 추가:
```json
"paths": {
  "@/*": ["./src/*"],
  "@sudam/api/*": ["../../apps/api/src/*"]
}
```

**수정된 파일:**
- `Dockerfile.web`
- `apps/web/tsconfig.json`

## 📋 백엔드 및 KataGo 오류 확인

백엔드와 KataGo의 구체적인 오류 로그를 확인해야 합니다. 일반적으로 다음 사항들을 확인하세요:

### Backend 오류 확인 사항

1. **환경 변수 확인**
   - `DATABASE_URL` - PostgreSQL 연결 문자열
   - `JWT_SECRET` - 최소 32자 이상의 랜덤 문자열
   - `NODE_ENV=production`

2. **빌드 확인**
   - Prisma 클라이언트 생성 여부
   - TypeScript 컴파일 성공 여부
   - `dist/index.js` 파일 생성 여부

3. **시작 명령 확인**
   - Railway Start Command: `cd apps/api && node dist/index.js`
   - 포트: Railway가 자동 할당하는 `PORT` 환경 변수 사용

### KataGo 오류 확인 사항

1. **Dockerfile 확인**
   - `Dockerfile.katago` 설정 확인
   - KataGo 바이너리 다운로드 성공 여부
   - 모델 파일 다운로드 성공 여부

2. **빌드 시간**
   - KataGo 모델 다운로드로 인해 빌드 시간이 길 수 있음
   - 네트워크 타임아웃 발생 가능

## 🚀 다음 단계

### 1. 변경사항 커밋 및 푸시

```bash
git add Dockerfile.web apps/web/tsconfig.json
git commit -m "[Fix] Frontend 빌드 오류 수정 - 백엔드 소스 코드 복사 및 타입 경로 추가"
git push origin develop
```

### 2. Railway 재배포

1. Railway 대시보드 접속
2. Frontend 서비스 선택
3. "Deployments" 탭 → "Redeploy" 클릭
4. 빌드 로그 확인

### 3. 백엔드 및 KataGo 오류 확인

백엔드와 KataGo의 Railway 로그를 확인하고, 구체적인 에러 메시지를 공유해주시면 추가로 해결하겠습니다.

## 📝 확인된 문제점

### Frontend ✅ 해결됨
- [x] 타입 에러 - 백엔드 소스 코드 복사 추가
- [x] 타입 경로 매핑 - tsconfig.json에 경로 추가

### Backend ❓ 확인 필요
- [ ] Railway 로그 확인 필요
- [ ] 환경 변수 확인 필요
- [ ] 빌드/시작 명령 확인 필요

### KataGo ❓ 확인 필요
- [ ] Railway 로그 확인 필요
- [ ] Dockerfile 빌드 확인 필요
- [ ] 네트워크 타임아웃 확인 필요

## 🔍 오류 로그 확인 방법

각 서비스의 Railway 로그를 확인하려면:

1. Railway 대시보드 접속
2. 서비스 선택 (Frontend/Backend/KataGo)
3. "Deployments" 탭 클릭
4. 최근 배포 선택
5. "View Logs" 클릭

로그에서 확인할 내용:
- 빌드 성공 여부
- 에러 메시지
- 환경 변수 관련 에러
- 모듈을 찾을 수 없다는 에러

## 📚 관련 문서

- [Railway 배포 오류 해결 가이드](./RAILWAY_DEPLOYMENT_ERRORS.md)
- [Railway 오류 진단 가이드](./RAILWAY_ERROR_DIAGNOSIS.md)
- [빠른 배포 가이드](../QUICK_DEPLOY.md)

---

**마지막 업데이트**: 2024-12-19

