# Railway 데이터베이스 설정 가이드

백엔드 서비스가 `DATABASE_URL` 환경 변수를 찾지 못하는 경우, Railway에서 PostgreSQL 데이터베이스를 추가하고 연결해야 합니다.

## PostgreSQL 데이터베이스 추가 방법

### 방법 1: Railway 대시보드에서 추가 (권장)

1. **Railway 프로젝트 대시보드**로 이동
2. **New Service** 클릭
3. **Database** 선택
4. **Add PostgreSQL** 클릭
5. Railway가 자동으로 PostgreSQL 데이터베이스를 생성합니다

### 방법 2: 기존 데이터베이스 사용

이미 PostgreSQL 데이터베이스가 있는 경우:
1. 해당 데이터베이스 서비스 선택
2. **Settings** → **Variables** 확인
3. `DATABASE_URL` 또는 `POSTGRES_URL` 변수가 있는지 확인

## DATABASE_URL 환경 변수 설정

### 자동 설정 (Railway가 자동으로 제공)

Railway는 같은 프로젝트 내의 서비스 간에 자동으로 환경 변수를 제공합니다:
- PostgreSQL 서비스를 추가하면 `DATABASE_URL` 환경 변수가 자동으로 생성됩니다
- 백엔드 서비스의 **Settings** → **Variables**에서 확인할 수 있습니다

### 수동 설정 (필요한 경우)

1. **PostgreSQL 서비스** 선택
2. **Settings** → **Variables** 또는 **Connect** 탭
3. **Connection String** 또는 **DATABASE_URL** 복사
4. **Backend 서비스** 선택
5. **Settings** → **Variables**
6. **New Variable** 클릭
7. **Name**: `DATABASE_URL`
8. **Value**: 복사한 연결 문자열 붙여넣기
9. **Add** 클릭

## 연결 문자열 형식

Railway PostgreSQL 연결 문자열 형식:
```
postgresql://postgres:password@hostname:port/railway
```

또는 Railway 내부 네트워크 사용:
```
postgresql://postgres:password@postgres:5432/railway
```

## 확인 방법

1. **Backend 서비스** → **Settings** → **Variables**
2. `DATABASE_URL` 또는 `POSTGRES_URL` 변수가 있는지 확인
3. 값이 비어있지 않은지 확인

## 문제 해결

### DATABASE_URL이 자동으로 설정되지 않는 경우

1. **PostgreSQL 서비스**와 **Backend 서비스**가 같은 프로젝트에 있는지 확인
2. **PostgreSQL 서비스** → **Settings** → **Variables**에서 연결 정보 확인
3. **Backend 서비스** → **Settings** → **Variables**에서 수동으로 추가

### Railway 내부 네트워크 사용

Railway는 같은 프로젝트 내 서비스 간에 내부 네트워크를 제공합니다:
- 서비스 이름을 호스트로 사용할 수 있습니다
- 예: `postgresql://postgres:password@postgres:5432/railway`

### 환경 변수 이름 확인

Railway는 때때로 다른 이름으로 환경 변수를 제공할 수 있습니다:
- `DATABASE_URL`
- `POSTGRES_URL`
- `RAILWAY_SERVICE_POSTGRES_URL`
- `POSTGRES_PRIVATE_URL`

백엔드 코드는 `DATABASE_URL`을 우선적으로 사용하므로, 다른 이름의 변수가 있으면 `DATABASE_URL`로 복사하거나 별칭을 추가하세요.

## 빠른 설정 체크리스트

- [ ] PostgreSQL 서비스가 프로젝트에 추가됨
- [ ] Backend 서비스의 Variables에 `DATABASE_URL`이 있음
- [ ] `DATABASE_URL` 값이 비어있지 않음
- [ ] 연결 문자열 형식이 올바름 (`postgresql://...`)
- [ ] 백엔드 서비스 재배포 완료

## 참고사항

- Railway는 환경 변수를 변경하면 자동으로 서비스를 재배포합니다
- 데이터베이스 연결이 실패하면 서버는 계속 실행되지만 데이터베이스 기능은 사용할 수 없습니다
- 로그에서 `[DB] Failed to connect to database` 메시지가 보이면 `DATABASE_URL`을 확인하세요

