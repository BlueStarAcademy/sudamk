# SUDAM-API: 로그에 오류 없이 크래시하는 경우 대응

## 현상
- Railway에서 SUDAM-API 서비스가 자주 크래시함
- 로그에는 별다른 에러 메시지가 보이지 않음

## 로그에 안 보일 수 있는 크래시 원인

### 1. **OOM (Out of Memory) – 가장 흔함**
Railway/OS가 메모리 한도를 초과하면 프로세스를 **SIGKILL**로 강제 종료합니다. 이때 Node는 종료 핸들러를 실행할 기회가 없어서 **로그에 아무 메시지도 남지 않을 수 있습니다**.

**확인 방법**
- Railway Dashboard → **SUDAM-API** 서비스 → **Metrics** 탭
- **Memory Usage** 그래프 확인: 크래시 직전에 메모리가 급상승하다가 끊기는지 확인
- 할당된 메모리 한도(예: 512MB, 1GB)에 닿았는지 확인

**대응**
1. **Settings → Resources**: Memory를 **최소 2GB**로 올리기 (권장 4GB 이상)
2. **환경 변수**에 힙 상한 설정으로 OOM 직전에 GC 유도:
   ```bash
   NODE_OPTIONS=--max-old-space-size=1536
   ```
   (메모리 2GB면 1536, 4GB면 3584 등으로 설정)
3. 코드에서 이미 적용된 메모리 가드 확인:
   - `OFFLINE_REGEN_SKIP_RSS_MB` (RSS가 이 값 넘으면 해당 주기 작업 스킵)
   - `RAILWAY_REPLICA_MEMORY_LIMIT_MB`로 복제본 메모리 한도 지정 가능

---

### 2. **헬스체크 타임아웃**
Railway가 주기적으로 `/api/health`를 호출하는데, **응답이 설정한 시간 안에 오지 않으면** 서비스를 비정상으로 간주하고 컨테이너를 재시작할 수 있습니다. 앱 입장에서는 “에러”가 아니라 그냥 재시작이라 로그에 명시적 에러가 없을 수 있습니다.

**확인 방법**
- 로그에서 크래시 직전에 `Health check response delayed` 등이 있는지 확인
- Railway 로그에 `Healthcheck failed` / `Attempt #N failed` 메시지가 있는지 확인

**대응**
- **Settings → Deploy → Health Check**:
  - **Path**: `/api/health`
  - **Timeout**: **120**초 이상 (60 → 120 권장)
  - **Interval**: **120**초 이상
- 여전히 실패하면 일시적으로 Health Check를 끄고, 메모리/리소스만 먼저 올려서 테스트

---

### 3. **메인 루프 연속 타임아웃/실패**
서버 내부 메인 루프에서 DB/작업이 연속으로 타임아웃하거나 실패하면, **의도적으로 `process.exit(1)`**을 호출해 재시작하도록 되어 있습니다.  
이 경우 로그에 다음 중 하나가 있어야 합니다 (최근 코드에서 `[CRASH_REASON]`으로 더 명확히 남기도록 개선됨):

- `[MainLoop] CRITICAL: ... consecutive timeouts ... Exiting for restart.`
- `[FATAL] Main loop failed N times consecutively. Exiting for Railway restart.`

**확인 방법**
- 로그에서 `CRITICAL`, `FATAL`, `CRASH_REASON` 검색
- `consecutive timeouts`, `Main loop failed` 검색

**대응**
- DB(Postgres) 지연/부하 확인 (Railway Postgres 메트릭, 느린 쿼리 등)
- **Settings → Resources**: CPU/메모리 여유 확보
- 필요 시 `MAINLOOP_DB_TIMEOUT_MS`, `GET_ALL_ACTIVE_GAMES_INTERVAL_MS` 등 타임아웃/주기 상수 조정 (코드 내 Railway용 값이 이미 완화되어 있음)

---

### 4. **SIGTERM으로 인한 정상 종료**
Railway가 배포/스케일 조정/헬스 실패 등으로 컨테이너에 **SIGTERM**을 보내면, 서버는 graceful shutdown을 하고 `process.exit(0)`으로 끝납니다.  
이때는 “에러”가 아니라 정상 종료라서, 로그에는 다음만 보일 수 있습니다:

- `[Server] SIGTERM received. Initiating graceful shutdown...`
- `[Server] HTTP server closed.`

**확인 방법**
- 크래시 직전 로그에 `SIGTERM` / `graceful shutdown` 검색

**대응**
- SIGTERM이 너무 자주 온다면, 위 1~3번(메모리, 헬스체크, 메인 루프)을 먼저 점검
- Restart Policy를 **Never**로 두고, 불필요한 재배포/재시작이 반복되지 않는지 확인

---

### 5. **로그가 버퍼링되거나 잘리거나 늦게 나오는 경우**
`process.exit(1)` 직후에는 stdout/stderr가 플러시되기 전에 프로세스가 사라질 수 있어, **마지막 몇 줄이 로그에 안 찍힐 수** 있습니다.

**대응**
- 코드에서 크래시 직전에 **`[CRASH_REASON] ...`** 한 줄을 `process.stderr.write`로 남기도록 되어 있음 (배포 후 로그에서 `CRASH_REASON` 검색)
- Railway **Metrics**에서 메모리/CPU와 크래시 시점을 함께 보면, OOM 등 원인 추정에 도움이 됨

---

## 체크리스트 (Railway Dashboard)

| 항목 | 확인 위치 | 권장 |
|------|-----------|------|
| 메모리 사용량 | Metrics → Memory | 크래시 직전 스파이크 여부 확인, 한도 여유 확보 |
| 메모리 한도 | Settings → Resources | 최소 2GB, 권장 4GB 이상 |
| NODE_OPTIONS | Settings → Variables | `--max-old-space-size=1536` (또는 할당 메모리에 맞게) |
| Health Check Path | Settings → Deploy | `/api/health` |
| Health Check Timeout | Settings → Deploy | 120초 이상 |
| Health Check Interval | Settings → Deploy | 120초 이상 |
| Restart Policy | Settings → Deploy | NEVER (불필요 재시작 방지) |
| DATABASE_URL | Settings → Variables | Postgres 서비스와 연결 확인 |

---

## 요약
- **로그에 에러가 없이** 크래시하면 **OOM** 또는 **헬스체크 타임아웃** 가능성이 큼.
- **Metrics**로 메모리 곡선을 보고, **Resources**로 메모리 한도를 올린 뒤, **Health Check** 타임아웃/경로를 완화해 보는 순서로 진행하는 것을 권장합니다.
