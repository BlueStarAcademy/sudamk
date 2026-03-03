# SUDAM-API 크래시 원인 찾기 (세팅했는데도 계속 크래시할 때)

세팅을 다 했는데도 SUDAM-API가 계속 크래시한다면, 아래 순서대로 확인하세요.

---

## 1단계: 로그에서 어디까지 진행됐는지 확인

배포 후 **Railway 로그**에서 다음 문구가 나오는지 확인합니다.

| 로그 문구 | 의미 |
|-----------|------|
| `[Server] Bootstrap: pid=... env_loaded` | 프로세스가 시작되어 env까지 로드됨. **이것도 없으면** 컨테이너/Node/메모리 문제 가능. |
| `[Server] Bootstrap: about to listen port=4000` | Express·DB 초기화까지 진행됨. **여기 다음에 크래시**면 listen 단계 문제. |
| `[Server] Server listening on port 4000` | 정상 기동 완료. 이후 크래시면 런타임(메모리/메인루프 등). |

- **Bootstrap 로그가 전혀 없음**  
  → OOM으로 프로세스가 바로 죽었거나, **Start Command / tsx 실행 실패** 가능.  
  → **Metrics → Memory**에서 크래시 직전 메모리 곡선 확인.  
  → **Settings → Deploy → Start Command**가 `npm run start-server`(또는 `npx tsx ...`)인지 확인.

- **`env_loaded`만 있고 그 다음이 없음**  
  → `express`/`cors`/`db` 등 **모듈 로드 중** 크래시.  
  → Prisma 생성 경로 문제일 수 있음: Dockerfile에서 `generated` 폴더가 제대로 복사되는지 확인 (아래 4단계).

---

## 2단계: 로그에서 크래시 원인 키워드 검색

Railway 로그에서 아래를 검색해 보세요.

| 검색어 | 의미 |
|--------|------|
| `[CRASH_REASON]` | 코드가 남긴 크래시 사유 (main_loop, enomem, uncaught_exception 등). |
| `SIGTERM` / `graceful shutdown` | Railway가 프로세스를 종료시킴. 보통 OOM·헬스 실패 후 재시작. |
| `CRITICAL` / `FATAL` | 메인루프 연속 실패, DB 재연결 실패 등. |
| `Main loop failed` / `consecutive timeouts` | DB 지연·타임아웃으로 인한 의도적 재시작. |
| `Health check` / `Healthcheck failed` | 헬스체크 타임아웃으로 서비스 재시작. |

자세한 내용은 **같은 폴더의 `RAILWAY_SUDAM_API_CRASH_NO_ERROR.md`**를 참고하세요.

---

## 3단계: Railway Metrics로 메모리 확인

- **Dashboard → SUDAM-API 서비스 → Metrics**
- **Memory Usage** 그래프 확인:
  - 크래시 직전에 **메모리가 한도까지 올라갔다가 끊기면** → **OOM** 가능성이 큼.

**대응:**

- **Settings → Resources**: Memory를 **최소 2GB, 권장 4GB** 이상으로 설정.
- **Variables**에 추가:
  ```bash
  NODE_OPTIONS=--max-old-space-size=1536
  ```
  (메모리 2GB면 1536, 4GB면 3584 등으로 조정.)

---

## 4단계: 자주 놓치는 설정들

### DATABASE_URL이 변수 참조로만 되어 있는 경우

- 값이 `${{Postgres.DATABASE_URL}}` 처럼 **Railway 변수 참조**만 있고, 실제 URL이 안 들어가 있으면 DB 연결 실패 후 이상 동작·크래시로 이어질 수 있습니다.
- **조치:**  
  - Postgres 서비스에서 **실제 DATABASE_URL 값**을 복사해서,  
  - SUDAM-API 서비스 **Variables**에 `DATABASE_URL`을 **실제 URL**로 직접 넣어 주세요.  
  - (문서: `RAILWAY_VARIABLES_FIX.md`, `FIX_RAILWAY_AUTO_DATABASE_URL.md` 참고.)

### 헬스체크 타임아웃

- **Settings → Deploy → Health Check**
  - **Path**: `/api/health`
  - **Timeout**: **120초** 이상 (60초면 부족할 수 있음).
  - **Interval**: **120초** 이상.

### Dockerfile.api로 빌드하는 경우 (API 전용 이미지)

- Prisma 클라이언트가 `generated/prisma`에 생성됩니다.  
- **Dockerfile.api**에서 `COPY --from=deps /app/generated ./generated`가 있고,  
  deps 단계에서 `npx prisma generate --schema prisma/schema.prisma`가 **실행되는지** 확인하세요.  
- `generated`가 비어 있거나 없으면 **모듈 로드 시점에 크래시**하고, 로그에는 `Bootstrap: env_loaded`까지만 보일 수 있습니다.

---

## 5단계: 체크리스트 요약

| 항목 | 확인 위치 | 권장 |
|------|-----------|------|
| 메모리 한도 | Settings → Resources | 최소 2GB, 권장 4GB |
| NODE_OPTIONS | Variables | `--max-old-space-size=1536` (또는 할당 메모리에 맞게) |
| DATABASE_URL | Variables | 실제 URL 문자열 (변수 참조만 있으면 안 됨) |
| Health Check Path | Deploy | `/api/health` |
| Health Check Timeout | Deploy | 120초 이상 |
| Health Check Interval | Deploy | 120초 이상 |
| Start Command | Deploy | `npm run start-server` (또는 프로젝트에서 사용하는 명령) |
| Bootstrap 로그 | 배포 후 로그 | `env_loaded` → `about to listen` → `listening` 순서로 나오는지 |

---

## 요약

1. **로그에 `[Server] Bootstrap:`** 가 있는지 보고, **어디까지** 나오는지로 구간을 좁힙니다.  
2. **`[CRASH_REASON]`**, **SIGTERM**, **메모리 그래프**로 OOM·헬스·메인루프 원인을 확인합니다.  
3. **메모리 2GB 이상 + NODE_OPTIONS**, **헬스체크 120초**, **DATABASE_URL 실제 값**을 꼭 확인합니다.  
4. API 전용 Docker 빌드를 쓰면 **Prisma `generated`** 가 이미지에 포함되는지 확인합니다.

이후에도 크래시가 반복되면,  
- **크래시 직전 1~2분 로그 전체**와  
- **Metrics의 Memory/CPU 그래프 캡처**  
를 남겨 두면 원인 분석에 도움이 됩니다.
