# Railway 빨간 상태 표시 해결 가이드

## 현재 상황

- ✅ 빌드는 성공
- ✅ 서버는 정상 시작
- ❌ Railway Dashboard에 빨간 상태 표시

## 가능한 원인

### 1. Health Check 실패

**증상:**
- 서버는 시작되지만 Railway가 Health Check를 받지 못함
- "Stopping Container" → "Starting Container" 반복

**확인 방법:**
1. Railway Dashboard → Logs 탭
2. `[Health Check]` 로그 메시지 확인
3. Health Check 요청이 들어오는지 확인

### 2. Railway Dashboard 설정 문제

**확인할 설정:**

#### A. Restart Policy (Settings → Deploy)
- **Restart Policy**: `Never` 또는 `Off`로 설정되어 있는지 확인
- 만약 `On Failure`로 설정되어 있으면 `Never`로 변경

#### B. Health Check 설정 (Settings → Deploy)
- **Healthcheck Path**: `/api/health`로 설정되어 있는지 확인
- **Healthcheck Timeout**: `60` (초)
- **Healthcheck Interval**: `120` (초)

### 3. 배포 상태 확인

**Railway Dashboard에서 확인:**
1. **Architecture** 탭
   - Sudam1 서비스 상태 확인
   - 빨간색 "Failed" 또는 노란색 "Deploying" 표시 확인

2. **Deployments** 탭
   - 최신 배포 상태 확인
   - "Failed" 배포가 있는지 확인
   - "Active" 배포 확인

3. **Logs** 탭
   - 최신 로그 확인
   - 에러 메시지 확인
   - Health Check 로그 확인

## 즉시 확인해야 할 항목

### 1단계: 배포 상태 확인

**Railway Dashboard → Architecture 탭:**
- Sudam1 서비스의 상태 확인
  - 🟢 **Green**: 정상
  - 🟡 **Yellow**: 배포 중
  - 🔴 **Red**: 실패 또는 문제

### 2단계: Deployments 탭 확인

**Railway Dashboard → Deployments 탭:**
- 최신 배포의 상태 확인
- "Active" 배포가 있는지 확인
- "Failed" 배포가 있으면 로그 확인

### 3단계: Settings 확인

**Railway Dashboard → Settings → Deploy:**

#### Restart Policy
```
✅ "Never" 또는 "Off" 선택
❌ "On Failure" 선택하면 안됨
```

#### Healthcheck Path
```
✅ "/api/health" 입력되어 있는지 확인
```

### 4단계: Logs 확인

**Railway Dashboard → Logs 탭:**
- `[Health Check]` 로그 메시지 확인
- Health Check 요청이 들어오는지 확인
- 에러 메시지 확인

## 해결 방법

### 방법 1: Restart Policy 확인 및 수정

**Railway Dashboard → Settings → Deploy:**
1. **Restart Policy** 섹션 찾기
2. 드롭다운에서 **"Never"** 선택
3. 저장

### 방법 2: Health Check 설정 확인

**Railway Dashboard → Settings → Deploy:**
1. **Healthcheck Path** 섹션 찾기
2. 값이 `/api/health`인지 확인
3. 없으면 추가

### 방법 3: 수동 재배포

**Railway Dashboard → Deployments:**
1. 최신 배포 클릭
2. **"Redeploy"** 버튼 클릭
3. 배포 완료까지 대기

### 방법 4: 서비스 재시작

**Railway Dashboard → Settings:**
1. 하단의 **"Restart Service"** 버튼 클릭
2. 서비스 재시작

## Health Check 로그 확인

서버 로그에서 다음 메시지를 찾으세요:

```
[Health Check] ok (10ms, listening: true, ready: true)
```

이 메시지가 보이면 Health Check가 정상 작동 중입니다.

## Dashboard 빨간 상태가 계속 보이는 경우

### 가능한 원인

1. **배포가 아직 진행 중**
   - 🟡 노란색으로 표시될 수 있음
   - 배포 완료까지 대기

2. **이전 배포가 실패**
   - 🔴 빨간색으로 표시된 이전 배포가 있을 수 있음
   - 새로운 배포가 성공하면 해결됨

3. **Health Check 타임아웃**
   - Railway가 Health Check를 받지 못함
   - Logs 탭에서 Health Check 요청 확인

### 확인 방법

1. **Architecture 탭에서 현재 상태 확인**
2. **Deployments 탭에서 최신 배포 상태 확인**
3. **Logs 탭에서 Health Check 로그 확인**

## 결론

**Railway Dashboard의 빨간 상태가 계속 보이는 경우:**

1. ✅ **Architecture 탭**에서 현재 상태 확인
2. ✅ **Deployments 탭**에서 최신 배포 상태 확인
3. ✅ **Settings → Deploy**에서 Restart Policy 확인
4. ✅ **Logs 탭**에서 Health Check 로그 확인

**서버가 정상적으로 실행 중이라면:**
- Dashboard의 빨간 표시는 이전 배포 실패 기록일 수 있음
- 새로운 배포가 성공하면 자동으로 해결될 수 있음
- 또는 수동으로 재배포하면 해결될 수 있음

