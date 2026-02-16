# 데이터베이스 연결 문제 해결 가이드

## 현재 문제
Railway 데이터베이스 서버(`turntable.proxy.rlwy.net:17109`)에 연결할 수 없습니다.

## 해결 방법

### 옵션 1: Railway 데이터베이스 확인 (권장)

1. **Railway 대시보드 접속**
   - https://railway.app 접속
   - 프로젝트 선택
   - Postgres 서비스 확인

2. **Postgres 서비스 상태 확인**
   - 서비스가 실행 중인지 확인
   - 일시 중지되었다면 재시작
   - 로그에서 에러 확인

3. **DATABASE_URL 확인**
   - Postgres 서비스 → Variables 탭
   - `DATABASE_URL` 또는 `DATABASE_PUBLIC_URL` 확인
   - 올바른 URL로 `.env` 파일 업데이트

### 옵션 2: 로컬 PostgreSQL 사용 (개발 환경)

로컬 개발을 위해 로컬 PostgreSQL을 사용할 수 있습니다:

1. **PostgreSQL 설치** (아직 설치하지 않은 경우)
   - https://www.postgresql.org/download/windows/
   - 또는 Docker 사용: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=sudamr -e POSTGRES_DB=sudamr postgres:15`

2. **.env 파일 수정**
   ```env
   DATABASE_URL="postgresql://postgres:sudamr@localhost:5432/sudamr?schema=public"
   ```

3. **데이터베이스 생성**
   ```sql
   CREATE DATABASE sudamr;
   ```

4. **마이그레이션 실행**
   ```bash
   npm run prisma:migrate:deploy
   ```

5. **연결 테스트**
   ```bash
   npm run test-db
   ```

### 옵션 3: Railway 데이터베이스 연결 재시도

Railway 데이터베이스가 일시적으로 다운되었을 수 있습니다:

1. **잠시 대기 후 재시도**
   - 몇 분 후 서버 재시작
   - Railway가 자동으로 재시작할 수 있음

2. **연결 테스트**
   ```bash
   npm run test-db
   ```

## 데이터베이스 연결 테스트

연결 상태를 확인하려면:
```bash
npm run test-db
```

이 명령어는:
- DATABASE_URL 설정 확인
- 데이터베이스 서버 연결 시도
- 연결 성공 시 테이블 목록 표시
- 연결 실패 시 해결 방법 제시

## 현재 설정 확인

현재 `.env` 파일의 DATABASE_URL:
```
postgresql://postgres:****@turntable.proxy.rlwy.net:17109/railway?sslmode=require
```

## 다음 단계

1. Railway 대시보드에서 Postgres 서비스 상태 확인
2. 서비스가 다운되었다면 재시작
3. 여전히 연결되지 않으면 로컬 PostgreSQL로 전환 고려
4. 연결 테스트: `npm run test-db`
