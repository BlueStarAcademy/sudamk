# KataGo 서버 배포 가이드

KataGo는 바둑 AI 엔진으로, 별도의 서비스로 분리하여 배포해야 합니다.

## KataGo 서버 분리 이유

1. **리소스 집약적**: CPU/GPU 리소스를 많이 사용
2. **큰 파일 크기**: 모델 파일이 수백 MB ~ 수 GB
3. **독립 실행**: API 서버와 독립적으로 동작
4. **확장성**: 필요에 따라 별도로 스케일링 가능

## 배포 옵션

### 옵션 1: Railway에 별도 서비스로 배포 (권장)

#### 1.1 KataGo 서버 서비스 생성

```
Railway → New → Empty Service
서비스 이름: "katago-server"
```

#### 1.2 Dockerfile 생성

프로젝트 루트에 `Dockerfile.katago` 생성:

```dockerfile
FROM ubuntu:22.04

# 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    libzip4 \
    && rm -rf /var/lib/apt/lists/*

# KataGo 바이너리 및 모델 복사
WORKDIR /app
COPY katago/ /app/katago/

# KataGo 실행 권한 부여
RUN chmod +x /app/katago/katago || true

# KataGo 서버 실행
CMD ["/app/katago/katago", "gtp", "-model", "/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz", "-config", "/app/katago/default_gtp.cfg"]
```

#### 1.3 Railway 설정

- **Build Command**: `docker build -f Dockerfile.katago -t katago .`
- **Start Command**: (Dockerfile의 CMD 사용)

또는 Nixpacks 사용:
- **Root Directory**: `katago/`
- **Start Command**: `./katago gtp -model kata1-b28c512nbt-s9853922560-d5031756885.bin.gz -config default_gtp.cfg`

#### 1.4 환경 변수

```env
KATAGO_MODEL_PATH=/app/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz
KATAGO_CONFIG_PATH=/app/katago/default_gtp.cfg
KATAGO_PORT=8081
```

### 옵션 2: 별도 서버에 배포

#### 2.1 VPS 또는 전용 서버 사용

1. **서버 요구사항**
   - Linux (Ubuntu 22.04 권장)
   - 최소 4GB RAM
   - GPU (선택사항, 성능 향상)

2. **KataGo 설치**

```bash
# KataGo 바이너리 다운로드
wget https://github.com/lightvector/KataGo/releases/latest/download/katago-<version>-linux.zip
unzip katago-*.zip

# 모델 파일 다운로드 (이미 있으면 스킵)
# wget https://katagotraining.org/.../kata1-b28c512nbt-s9853922560-d5031756885.bin.gz

# 실행 권한 부여
chmod +x katago

# KataGo 서버 실행
./katago gtp -model kata1-b28c512nbt-s9853922560-d5031756885.bin.gz -config default_gtp.cfg
```

3. **systemd 서비스로 등록**

`/etc/systemd/system/katago.service`:

```ini
[Unit]
Description=KataGo GTP Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/katago
ExecStart=/path/to/katago/katago gtp -model /path/to/katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz -config /path/to/katago/default_gtp.cfg
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable katago
sudo systemctl start katago
```

### 옵션 3: Docker 컨테이너로 실행

#### 3.1 Dockerfile

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libzip4 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY katago/ /app/

CMD ["./katago", "gtp", "-model", "kata1-b28c512nbt-s9853922560-d5031756885.bin.gz", "-config", "default_gtp.cfg"]
```

#### 3.2 Docker 실행

```bash
docker build -t katago-server -f Dockerfile.katago .
docker run -d -p 8081:8081 --name katago katago-server
```

## API 서버에서 KataGo 연결

### 환경 변수 설정

백엔드 서비스에 KataGo 서버 URL 추가:

```env
KATAGO_SERVER_URL=http://katago-server:8081
# 또는 Railway 도메인 사용
KATAGO_SERVER_URL=https://katago-production.up.railway.app
```

### 코드에서 연결

KataGo는 GTP (Go Text Protocol)를 사용합니다. API 서버에서 연결하는 예시:

```typescript
// apps/api/src/services/katago.ts
import { spawn } from 'child_process';

export class KataGoService {
  private katagoProcess: any;
  
  async connect() {
    // KataGo 서버 URL에서 연결
    // 또는 로컬 프로세스로 실행
    this.katagoProcess = spawn('katago', [
      'gtp',
      '-model', 'kata1-b28c512nbt-s9853922560-d5031756885.bin.gz',
      '-config', 'default_gtp.cfg'
    ]);
  }
  
  async analyze(position: string) {
    // GTP 명령어 전송
    // 분석 결과 반환
  }
}
```

## Railway 배포 시 주의사항

### 1. 파일 크기 제한

Railway는 빌드 시 파일 크기 제한이 있습니다. KataGo 모델 파일이 크면:

**해결 방법:**
- 모델 파일을 Railway의 볼륨에 저장
- 또는 외부 스토리지(S3 등)에서 다운로드
- 또는 Git LFS 사용

### 2. 빌드 시간

큰 파일로 인해 빌드 시간이 길어질 수 있습니다.

**해결 방법:**
- Docker 이미지를 미리 빌드하여 사용
- 또는 Railway의 볼륨 기능 활용

### 3. 리소스 제한

KataGo는 CPU/메모리를 많이 사용합니다.

**해결 방법:**
- Railway Pro 플랜 고려
- 또는 별도 VPS 사용

## 배포 체크리스트

### KataGo 서버 배포 전
- [ ] KataGo 바이너리 준비 (Linux용)
- [ ] 모델 파일 준비
- [ ] 설정 파일 확인 (`default_gtp.cfg`)
- [ ] 로컬에서 테스트 실행

### KataGo 서버 배포 후
- [ ] KataGo 서버 실행 확인
- [ ] GTP 프로토콜 연결 테스트
- [ ] API 서버에서 연결 테스트
- [ ] 분석 기능 테스트

### API 서버 설정
- [ ] `KATAGO_SERVER_URL` 환경 변수 설정
- [ ] KataGo 연결 코드 확인
- [ ] 에러 핸들링 추가

## 모니터링

### KataGo 서버 모니터링

- CPU/메모리 사용량
- 응답 시간
- 에러 로그
- 프로세스 상태

### Railway에서 모니터링

- Railway 대시보드 → KataGo 서비스 → Metrics
- 로그 확인: Deployments → View Logs

## 트러블슈팅

### KataGo 서버가 시작되지 않음

**문제:** 바이너리 실행 권한 없음
**해결:** `chmod +x katago` 실행

**문제:** 모델 파일을 찾을 수 없음
**해결:** 모델 파일 경로 확인

### API 서버에서 연결 실패

**문제:** KataGo 서버 URL이 잘못됨
**해결:** `KATAGO_SERVER_URL` 환경 변수 확인

**문제:** 네트워크 연결 문제
**해결:** Railway 내부 네트워크 사용 또는 공개 도메인 확인

## 성능 최적화

### 1. 스레드 수 조정

`default_gtp.cfg`에서 `numSearchThreads` 조정:

```cfg
numSearchThreads = 4  # CPU 코어 수에 맞게 조정
```

### 2. GPU 사용 (가능한 경우)

OpenCL 또는 CUDA 버전 사용

### 3. 캐싱

자주 사용하는 분석 결과 캐싱

## 요약

1. **KataGo는 별도 서비스로 분리** - API 서버와 독립적으로 배포
2. **Railway에 별도 서비스로 배포** 또는 **별도 서버 사용**
3. **API 서버에서 환경 변수로 연결** - `KATAGO_SERVER_URL` 설정
4. **모니터링 및 최적화** - 리소스 사용량 확인

## 참고 문서

- [KataGo 공식 문서](https://github.com/lightvector/KataGo)
- [GTP 프로토콜](https://www.lysator.liu.se/~gunnar/gtp/)
- [Railway 배포 가이드](./RAILWAY_DEPLOYMENT.md)

