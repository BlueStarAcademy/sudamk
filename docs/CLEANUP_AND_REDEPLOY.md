# 기존 배포 정리 및 재배포 가이드

기존에 배포했던 서비스들을 정리하고 새로 배포하는 가이드입니다.

## 기존 배포 정리

### Railway에서 정리할 항목

**삭제해도 되는 것:**
- ✅ 백엔드 서비스 (API 서비스)
- ✅ 프론트엔드 서비스 (Web 서비스)
- ✅ KataGo 서버 서비스 (별도로 배포된 경우)
- ✅ 기타 서비스들 (Redis, 기타 유틸리티 등)

**유지해야 하는 것:**
- ❌ **PostgreSQL 데이터베이스** - 데이터 보존을 위해 유지
- ❌ **환경 변수 설정** - 나중에 재사용할 수 있도록 기록해두기

### Railway에서 서비스 삭제 방법

1. **Railway 대시보드 접속**
   - https://railway.app 접속
   - 프로젝트 선택

2. **서비스 삭제**
   - 삭제할 서비스(백엔드/프론트엔드/KataGo) 선택
   - "Settings" 탭 클릭
   - 맨 아래 "Delete Service" 버튼 클릭
   - 확인 메시지에서 서비스 이름 입력하여 확인

3. **PostgreSQL 데이터베이스 확인**
   - PostgreSQL 서비스는 **삭제하지 않음**
   - "Settings"에서 데이터베이스 정보 확인
   - `DATABASE_URL` 복사해두기 (나중에 사용)

4. **KataGo 서버 확인** (있는 경우)
   - KataGo 서비스가 별도로 있다면 삭제 가능
   - 나중에 재배포할 예정이면 환경 변수 백업

### 환경 변수 백업

삭제하기 전에 환경 변수를 백업해두세요:

1. 각 서비스의 "Variables" 탭에서 환경 변수 확인
2. 중요한 환경 변수 복사:
   - `DATABASE_URL` (PostgreSQL에서)
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS`
   - `NEXT_PUBLIC_API_URL` (프론트엔드용)

## 새로 배포하기

### 1단계: Railway 프로젝트 준비

#### 옵션 A: 기존 프로젝트 사용 (권장)

1. Railway 대시보드에서 기존 프로젝트 선택
2. PostgreSQL 데이터베이스가 있는지 확인
3. `DATABASE_URL` 확인 및 복사

#### 옵션 B: 새 프로젝트 생성

1. "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. GitHub 저장소 연결
4. PostgreSQL 데이터베이스 추가:
   - "New" → "Database" → "Add PostgreSQL"
   - `DATABASE_URL` 복사

### 2단계: 백엔드 서비스 배포

1. **서비스 생성**
   ```
   Railway 프로젝트 → "New" → "GitHub Repo"
   → 저장소 선택 → 서비스 이름: "backend" 또는 "api"
   ```

2. **환경 변수 설정**
   - "Variables" 탭 클릭
   - 다음 환경 변수 추가:

   ```env
   DATABASE_URL=postgresql://... (PostgreSQL에서 복사한 URL)
   JWT_SECRET=your-secret-key-minimum-32-characters-long
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-frontend-domain.railway.app
   ```

   **주의사항:**
   - `JWT_SECRET`은 기존 것과 동일하게 사용하거나 새로 생성
   - `ALLOWED_ORIGINS`는 프론트엔드 도메인 (나중에 설정 가능)

3. **빌드 설정 확인**
   - `railway.json` 파일이 자동으로 인식됨
   - 수동 설정이 필요한 경우:
     - Build Command: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm build`
     - Start Command: `cd apps/api && pnpm start`

4. **배포 확인**
   - "Deployments" 탭에서 배포 상태 확인
   - 배포 완료 후 "Settings" → "Generate Domain"으로 도메인 생성
   - 백엔드 도메인 기록 (예: `https://api-production.up.railway.app`)

### 3단계: 프론트엔드 서비스 배포

1. **서비스 생성**
   ```
   Railway 프로젝트 → "New" → "GitHub Repo"
   → 저장소 선택 → 서비스 이름: "frontend" 또는 "web"
   ```

2. **환경 변수 설정**
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
   NODE_ENV=production
   ```

   **중요:** `NEXT_PUBLIC_API_URL`은 백엔드의 공개 도메인으로 설정

3. **빌드 설정**
   - Build Command: `pnpm install --frozen-lockfile && cd apps/web && pnpm build`
   - Start Command: `cd apps/web && pnpm start`

4. **배포 확인**
   - 배포 완료 후 도메인 생성
   - 프론트엔드 도메인 기록

### 4단계: CORS 설정 업데이트

프론트엔드 도메인이 생성된 후:

1. 백엔드 서비스 → "Variables" 탭
2. `ALLOWED_ORIGINS` 업데이트:
   ```env
   ALLOWED_ORIGINS=https://your-frontend-domain.railway.app
   ```
3. 서비스 재시작 (자동으로 재배포됨)

### 5단계: KataGo 서버 배포 (선택사항)

KataGo 서버가 필요한 경우:

1. **서비스 생성**
   ```
   Railway → New → Empty Service 또는 GitHub Repo
   서비스 이름: "katago-server"
   ```

2. **배포 설정**
   - 자세한 내용은 [KataGo 배포 가이드](./KATAGO_DEPLOYMENT.md) 참고

3. **환경 변수 설정**
   - 백엔드 서비스에 `KATAGO_SERVER_URL` 추가

### 6단계: 데이터베이스 마이그레이션

배포 후 데이터베이스 스키마를 최신 상태로 업데이트:

```bash
# 방법 1: Railway CLI 사용 (권장)
railway login
railway link  # 프로젝트 선택
railway run pnpm db:migrate

# 방법 2: 로컬에서 실행 (DATABASE_URL 설정 필요)
export DATABASE_URL="postgresql://..."
pnpm db:migrate
```

**주의:** 기존 데이터가 있다면 마이그레이션 전에 백업 권장

### 7단계: 배포 검증

```bash
# 배포 후 검증
pnpm verify:deployment https://your-backend-domain.railway.app
```

또는 수동 확인:
- 헬스체크: `https://your-backend-domain.railway.app/health`
- API: `https://your-backend-domain.railway.app/api`
- 프론트엔드: `https://your-frontend-domain.railway.app`

## 체크리스트

### 삭제 전 확인
- [ ] PostgreSQL 데이터베이스는 유지
- [ ] `DATABASE_URL` 백업
- [ ] `JWT_SECRET` 백업 (또는 새로 생성 준비)
- [ ] 기타 중요한 환경 변수 백업

### 배포 전 확인
- [ ] PostgreSQL 데이터베이스 존재 확인
- [ ] GitHub 저장소 최신 코드 확인
- [ ] 로컬에서 빌드 테스트: `pnpm build`
- [ ] 배포 준비 확인: `pnpm check:deployment`
- [ ] KataGo 서버 배포 필요 여부 확인 (선택사항)

### 배포 후 확인
- [ ] 백엔드 헬스체크 확인
- [ ] 프론트엔드 로드 확인
- [ ] 데이터베이스 연결 확인
- [ ] 기능 테스트 (등록, 로그인, 게임 생성 등)

## 문제 해결

### 기존 데이터베이스 연결 실패

**문제:** 새로 배포한 서비스가 기존 데이터베이스에 연결되지 않음

**해결:**
1. PostgreSQL 서비스의 "Variables"에서 `DATABASE_URL` 확인
2. 백엔드 서비스의 `DATABASE_URL`과 일치하는지 확인
3. 데이터베이스가 실행 중인지 확인

### 환경 변수 누락

**문제:** 배포 후 기능이 작동하지 않음

**해결:**
1. 각 서비스의 "Variables" 탭에서 필수 환경 변수 확인
2. 백엔드: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`
3. 프론트엔드: `NEXT_PUBLIC_API_URL`

### CORS 오류

**문제:** 프론트엔드에서 API 호출 실패

**해결:**
1. 백엔드 `ALLOWED_ORIGINS`에 프론트엔드 도메인 추가
2. 서비스 재시작

## 요약

1. **삭제:** 백엔드/프론트엔드 서비스만 삭제 (PostgreSQL은 유지)
2. **백업:** 환경 변수 백업 (특히 `DATABASE_URL`, `JWT_SECRET`)
3. **재배포:** 새 서비스 생성 및 환경 변수 설정
4. **검증:** 배포 후 검증 스크립트 실행

## 참고 문서

- [배포 단계별 가이드](./DEPLOYMENT_STEPS.md)
- [Railway 배포 가이드](./RAILWAY_DEPLOYMENT.md)
- [배포 체크리스트](./DEPLOYMENT_CHECKLIST.md)

