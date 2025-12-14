# 빠른 배포 시작 가이드

기존 배포를 정리하고 새로 배포하는 빠른 가이드입니다.

## 🗑️ 기존 배포 정리 (5분)

### Railway에서 삭제

1. **Railway 대시보드 접속**
   - https://railway.app → 프로젝트 선택

2. **서비스 삭제**
   - 백엔드 서비스 선택 → Settings → Delete Service
   - 프론트엔드 서비스 선택 → Settings → Delete Service
   - **PostgreSQL은 삭제하지 않음!**

3. **환경 변수 백업** (중요!)
   - PostgreSQL 서비스 → Variables → `DATABASE_URL` 복사
   - 기존 백엔드에서 `JWT_SECRET` 복사 (또는 새로 생성)

## 🚀 새로 배포하기 (10분)

### 1. 백엔드 배포

```
Railway → New → GitHub Repo → 저장소 선택
서비스 이름: "backend"
```

**환경 변수 설정:**
```env
DATABASE_URL=postgresql://... (PostgreSQL에서 복사)
JWT_SECRET=your-secret-key-minimum-32-characters
NODE_ENV=production
```

**배포 완료 후:**
- Settings → Generate Domain
- 백엔드 도메인 기록 (예: `https://api-production.up.railway.app`)

### 2. 프론트엔드 배포

```
Railway → New → GitHub Repo → 저장소 선택
서비스 이름: "frontend"
```

**환경 변수 설정:**
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
NODE_ENV=production
```

**배포 완료 후:**
- Settings → Generate Domain
- 프론트엔드 도메인 기록

### 3. CORS 설정 업데이트

백엔드 → Variables → `ALLOWED_ORIGINS` 업데이트:
```env
ALLOWED_ORIGINS=https://your-frontend-domain.railway.app
```

### 4. 데이터베이스 마이그레이션

```bash
railway login
railway link
railway run pnpm db:migrate
```

### 5. 검증

```bash
pnpm verify:deployment https://your-backend-domain.railway.app
```

## ✅ 체크리스트

- [ ] PostgreSQL 데이터베이스 유지
- [ ] `DATABASE_URL` 백업
- [ ] 백엔드 서비스 삭제
- [ ] 프론트엔드 서비스 삭제
- [ ] 백엔드 재배포 및 환경 변수 설정
- [ ] 프론트엔드 재배포 및 환경 변수 설정
- [ ] CORS 설정 업데이트
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 배포 검증

## 📚 상세 가이드

더 자세한 내용은 다음 문서를 참고하세요:
- [기존 배포 정리 및 재배포](./CLEANUP_AND_REDEPLOY.md) - 상세 가이드
- [배포 단계별 가이드](./DEPLOYMENT_STEPS.md) - 전체 배포 프로세스

