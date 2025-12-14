# 프로덕션 배포 가이드

SUDAM v2 프로젝트의 프로덕션 배포 가이드입니다.

## 빠른 시작

### Railway 배포 (권장)

1. Railway 프로젝트 생성
2. GitHub 저장소 연결
3. 환경 변수 설정
4. 자동 배포 활성화

자세한 내용은 [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)를 참고하세요.

## 환경 변수

### 필수 환경 변수

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-minimum-32-characters-long-for-security
NODE_ENV=production
PORT=4000
```

**주의사항:**
- `JWT_SECRET`은 최소 32자 이상이어야 합니다
- `DATABASE_URL`은 프로덕션 데이터베이스 URL이어야 합니다
- `PORT`는 배포 플랫폼에서 자동 설정될 수 있습니다 (Railway 등)

### 선택적 환경 변수

```env
# CORS 설정 (쉼표로 구분된 여러 도메인 가능)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Railway 환경 (Railway 사용 시 자동 설정됨)
RAILWAY_ENVIRONMENT=production
```

### 환경 변수 예시 파일

프로젝트 루트의 `.env.example` 파일을 참고하세요.

## 배포 전 확인사항

[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)를 확인하세요.

### 프로덕션 준비 스크립트 실행

배포 전에 프로덕션 준비 스크립트를 실행하여 모든 체크를 수행할 수 있습니다:

```bash
# 기본 체크 (환경 변수, 빌드 아티팩트, 데이터베이스)
pnpm prepare:production

# 테스트 포함 체크
pnpm prepare:production:test
```

이 스크립트는 다음을 확인합니다:
- 필수 환경 변수 설정
- 빌드 아티팩트 존재 여부
- 데이터베이스 연결 가능 여부
- 테스트 통과 여부 (--test 플래그 사용 시)

## 배포 후 확인

### 자동 검증

```bash
# 배포 후 검증 스크립트 실행
pnpm verify:deployment https://your-backend-domain.railway.app
```

### 수동 확인

1. 헬스체크: `https://your-api-domain.com/health`
2. API 테스트: `https://your-api-domain.com/api`
3. 프론트엔드: `https://your-frontend-domain.com`

자세한 배포 단계는 [DEPLOYMENT_STEPS.md](./DEPLOYMENT_STEPS.md)를 참고하세요.

## 문제 해결

문제가 발생하면 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)의 트러블슈팅 섹션을 참고하세요.

## 지원

문제가 지속되면 GitHub Issues에 리포트해주세요.

