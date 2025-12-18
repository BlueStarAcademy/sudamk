# SUDAM v2 Railway 배포 가이드

## 아키텍처 개요

Railway에서 다음 서비스들을 배포합니다:

1. **Next.js 앱** (메인 서비스) - 포트 3000
2. **PostgreSQL** (데이터베이스)
3. **KataGo 서비스** (별도 서비스) - 포트 4001
4. **GNU Go 서비스** (별도 서비스) - 포트 4002

각 서비스는 독립적으로 스케일링 가능하며, 1000명 동시 사용자를 지원합니다.

## 배포 단계

### 1. Railway 프로젝트 생성

1. [Railway](https://railway.app)에 로그인
2. "New Project" 클릭
3. "Empty Project" 선택

### 2. PostgreSQL 서비스 추가

1. 프로젝트에서 "New" → "Database" → "Add PostgreSQL" 선택
2. 생성 후 `DATABASE_URL` 환경 변수 복사

### 3. Next.js 앱 배포

1. 프로젝트에서 "New" → "GitHub Repo" 선택
2. 저장소 선택 후 루트 디렉토리를 `app`으로 설정
3. 환경 변수 설정:
   ```
   DATABASE_URL=<PostgreSQL 연결 문자열>
   JWT_SECRET=<랜덤 시크릿 키>
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=<배포된 Next.js 앱 URL>
   KATAGO_API_URL=<KataGo 서비스 URL>
   GNUGO_API_URL=<GNU Go 서비스 URL>
   ```
4. 배포 시작

### 4. KataGo 서비스 배포

1. 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택, 루트 디렉토리를 `apps/katago`로 설정
3. Dockerfile 경로: `Dockerfile.katago` (프로젝트 루트)
4. 포트: 4001
5. 환경 변수:
   ```
   PORT=4001
   ALLOWED_ORIGINS=<Next.js 앱 URL>
   ```

### 5. GNU Go 서비스 배포

1. 프로젝트에서 "New" → "GitHub Repo" 선택
2. 같은 저장소 선택, 루트 디렉토리를 `apps/gnugo`로 설정
3. Dockerfile 경로: `Dockerfile.gnugo` (프로젝트 루트)
4. 포트: 4002
5. 환경 변수:
   ```
   PORT=4002
   ALLOWED_ORIGINS=<Next.js 앱 URL>
   GNUGO_LEVEL=5
   GNUGO_POOL_SIZE=5
   ```

### 6. 데이터베이스 마이그레이션

Next.js 앱이 배포된 후:

1. Railway 대시보드에서 Next.js 서비스 선택
2. "Deployments" → 최신 배포 선택
3. "View Logs" → 터미널 열기
4. 다음 명령 실행:
   ```bash
   pnpm db:migrate
   ```

또는 로컬에서:
```bash
DATABASE_URL=<Railway PostgreSQL URL> pnpm db:migrate
```

## 환경 변수 설정

### Next.js 앱

| 변수 | 설명 | 예시 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://...` |
| `JWT_SECRET` | JWT 서명 키 | 랜덤 문자열 |
| `NEXT_PUBLIC_API_URL` | 공개 API URL | `https://your-app.railway.app` |
| `KATAGO_API_URL` | KataGo 서비스 URL | `https://katago.railway.app` |
| `GNUGO_API_URL` | GNU Go 서비스 URL | `https://gnugo.railway.app` |
| `REDIS_URL` | Redis 연결 문자열 (선택사항) | `redis://...` |

### KataGo 서비스

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서비스 포트 | `4001` |
| `ALLOWED_ORIGINS` | 허용된 CORS 오리진 | `*` |

### GNU Go 서비스

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서비스 포트 | `4002` |
| `ALLOWED_ORIGINS` | 허용된 CORS 오리진 | `*` |
| `GNUGO_LEVEL` | AI 레벨 (1-10 범위, GNU Go 기본 지원) | `5` |
| `GNUGO_POOL_SIZE` | 프로세스 풀 크기 | `5` |

**레벨 범위:**
- 최소: 1 (가장 쉬움)
- 최대: 10 (가장 어려움)
- 기본값: 5

## 스케일링 설정

### 1000명 동시 사용자 지원

1. **Next.js 앱**: 
   - 인스턴스 수: 2-3개 (로드 밸런싱)
   - 메모리: 최소 1GB

2. **PostgreSQL**:
   - 연결 풀 크기: 50 (자동 설정됨)
   - 인스턴스: 표준 플랜 이상

3. **KataGo 서비스**:
   - 인스턴스 수: 2-3개
   - 메모리: 최소 2GB (모델 로딩)

4. **GNU Go 서비스**:
   - 인스턴스 수: 2-3개
   - 메모리: 최소 512MB

## 헬스체크

각 서비스는 다음 엔드포인트를 제공합니다:

- **Next.js**: `GET /api/health`
- **KataGo**: `GET /api/health`
- **GNU Go**: `GET /api/health`

Railway가 자동으로 헬스체크를 수행합니다.

## 모니터링

Railway 대시보드에서 다음을 모니터링할 수 있습니다:

- CPU 사용률
- 메모리 사용률
- 네트워크 트래픽
- 로그
- 에러율

## 트러블슈팅

### 데이터베이스 연결 오류

- `DATABASE_URL`이 올바른지 확인
- PostgreSQL 서비스가 실행 중인지 확인
- 연결 풀 크기 확인 (최대 50)

### KataGo/GNU Go 서비스 연결 오류

- 서비스 URL이 올바른지 확인
- CORS 설정 확인 (`ALLOWED_ORIGINS`)
- 서비스 로그 확인

### 성능 이슈

- 인스턴스 수 증가
- 메모리 할당 증가
- Redis 캐싱 활성화 (선택사항)

## 추가 최적화

### Redis 캐싱 활성화

1. Railway에서 Redis 서비스 추가
2. `REDIS_URL` 환경 변수 설정
3. 자동으로 캐싱 활성화됨

### CDN 설정

정적 자산을 CDN에 배포하여 성능 향상:
- Next.js 빌드 시 `output: 'standalone'` 사용
- Railway의 자동 CDN 활용

## 비용 예상

월 예상 비용 (1000명 동시 사용자 기준):

- Next.js 앱: $20-30
- PostgreSQL: $20-30
- KataGo 서비스: $20-30
- GNU Go 서비스: $10-15
- **총계**: 약 $70-105/월

*실제 비용은 사용량에 따라 달라질 수 있습니다.*

