# Railway 데이터베이스 문제 해결

## 발견된 문제

### 1. 연결 리셋 오류
- 많은 "Connection reset by peer" 및 "could not accept SSL connection: EOF detected" 오류
- 원인: 너무 많은 동시 연결 시도 및 연결 풀링 설정 문제

### 2. 스키마 오류
- `UserCredential` 테이블의 `updatedAt` NOT NULL 제약 위반
- 원인: Raw SQL INSERT 시 `createdAt`과 `updatedAt`을 명시적으로 설정하지 않음

### 3. Checkpoint 지연
- Checkpoint가 20-30초 걸림 (정상: 1-2초)
- 원인: 데이터베이스 부하 및 연결 불안정

## 적용된 수정 사항

### 1. UserCredential INSERT 수정
**파일**: `server/prisma/credentialService.ts`

- INSERT 문에 `createdAt`과 `updatedAt`을 명시적으로 추가
- Raw SQL 사용 시 Prisma의 자동 타임스탬프가 작동하지 않으므로 수동 설정

```typescript
// 수정 전
INSERT INTO "UserCredential" (username, "passwordHash", "userId", "kakaoId", "emailVerified")
VALUES ($1, $2, $3, $4, $5)

// 수정 후
INSERT INTO "UserCredential" (username, "passwordHash", "userId", "kakaoId", "emailVerified", "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7)
```

### 2. 연결 풀링 설정 최적화
**파일**: `server/prismaClient.ts`

- Railway 연결 수 제한: 20개 → **10개로 감소**
- 연결 타임아웃: 10초 → **15초로 증가**
- 연결 체크 간격: 10초 → **30초로 증가** (부하 감소)
- SSL 모드 명시적 설정

```typescript
// Railway 환경 최적화
connection_limit=10        // 연결 수 감소 (연결 리셋 방지)
connect_timeout=15         // 타임아웃 증가
pool_timeout=20            // 풀 타임아웃
sslmode=require            // SSL 명시적 설정
```

### 3. 연결 재시도 로직 개선
- 연결 체크 간격 증가 (부하 감소)
- 연결 리셋 오류 감지 추가
- 로그 스팸 방지 (5회마다 로그 출력)

## 예상 효과

1. **연결 리셋 오류 감소**: 연결 수 제한으로 동시 연결 부하 감소
2. **스키마 오류 해결**: `updatedAt` NOT NULL 제약 위반 해결
3. **데이터베이스 부하 감소**: 연결 체크 간격 증가로 불필요한 쿼리 감소
4. **안정성 향상**: 타임아웃 증가로 일시적 네트워크 문제 대응

## 다음 단계

1. **서버 재시작**: 변경 사항 적용을 위해 서버 재시작
2. **모니터링**: Railway 로그에서 연결 리셋 오류 감소 확인
3. **성능 확인**: Checkpoint 시간이 정상 범위로 돌아왔는지 확인

## 추가 권장 사항

### Railway 대시보드에서 확인할 사항:
1. Postgres 서비스 리소스 사용량 확인
2. 연결 수 모니터링
3. 디스크 I/O 확인

### 필요시 추가 조치:
- Railway Postgres 서비스 업그레이드 고려
- 연결 풀링을 더 낮추기 (5개로)
- 로컬 개발 환경에서는 로컬 PostgreSQL 사용 고려

## 테스트

변경 사항 적용 후:
```bash
# 데이터베이스 연결 테스트
npm run test-db

# 서버 시작
npm start
```

로그에서 다음을 확인:
- ✅ "Database initialized successfully" 메시지
- ✅ 연결 리셋 오류 감소
- ✅ Checkpoint 시간 정상화
