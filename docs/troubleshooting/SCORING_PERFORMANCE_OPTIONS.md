# 계가(스코어링) 성능 옵션

계가 완료까지 걸리는 **실제 분석 시간**을 줄이면서 정확도를 유지하기 위한 옵션 정리.

---

## 1. 계가 전용 파라미터 (즉시 적용 가능)

계가 시에만 visits·시간 상한을 낮추면 20초대 → 8~12초대로 단축할 수 있습니다.

### 환경 변수 (KataGo 서비스 또는 백엔드)

| 변수 | 예시 | 설명 |
|------|------|------|
| `KATAGO_SCORING_MAX_VISITS` | `300` | 계가 시 최대 시뮬레이션 수. 미설정 시 `KATAGO_MAX_VISITS` 사용 |
| `KATAGO_SCORING_MAX_TIME_SEC` | `10` | 계가 시 최대 분석 시간(초). 미설정 시 `KATAGO_MAX_TIME_SEC`(기본 20) 사용 |

- **설정 위치**: Railway KataGo 서비스 Variables, 또는 백엔드에서 KataGo HTTP API를 쓰는 경우 **KataGo 서비스**에 설정 (계가 요청 시 쿼리로 전달됨).
- **검증**: 적용 후 실제로 몇 판을 두고, 기존 설정(예: 500 visits, 20초) 결과와 **승자·점수**가 일치하는지 확인하는 것을 권장합니다. 문제 없으면 해당 값 유지.

자세한 변수 설명은 [RAILWAY_VARIABLES_REFERENCE.md](../railway/RAILWAY_VARIABLES_REFERENCE.md) KataGo 서비스 섹션 참고.

---

## 2. GPU 인프라 검토

동일 visits에서 **수 초 대**로 끝내려면 KataGo를 GPU에서 실행하는 것이 가장 효과적입니다.

### 현재 환경 (Railway)

- **KataGo 서비스**: [Dockerfile.katago](Dockerfile.katago) 기준 **eigen(CPU 전용)** 바이너리 사용.
- **Railway**: 2024년 기준 **GPU 인스턴스 미제공**. GPU 지원 요청이 있으나 공개 일정은 없음.

### GPU 사용 시 옵션

| 옵션 | 설명 | 비고 |
|------|------|------|
| **RunPod / Lambda Labs / Vast.ai** | GPU 클라우드에서 KataGo 서버 실행 후 `KATAGO_API_URL`로 백엔드 연결 | CUDA 또는 OpenCL 빌드 필요, 비용·네트워크 검토 |
| **자체 서버 + GPU** | CUDA/OpenCL 지원 Linux에서 KataGo 실행, 공개 URL 또는 VPN으로 백엔드 연동 | 인프라 운영 부담 |
| **Railway 추후 GPU** | Railway에서 GPU가 제공되면 KataGo 서비스만 CUDA/OpenCL 이미지로 전환 | 공식 일정 없음, 피드백/업보트로 수요 표시 가능 |

### KataGo GPU 빌드

- 릴리스: https://github.com/lightvector/KataGo/releases  
- CPU: `katago-*-eigen-*`  
- GPU: `katago-*-cuda-*`(NVIDIA), `katago-*-opencl-*`(다양한 GPU)  
- GPU 빌드 사용 시 동일 visits에서 CPU 대비 크게 단축되는 것이 일반적입니다.

---

## 3. 계가 전용 작은 네트워크 검토

동일 visits에서 **추론만** 빨리 하려면 블록 수가 적은 네트워크를 쓰는 방법이 있습니다.

### 네트워크 종류

- **공식 목록**: https://katagotraining.org/networks/
- **현재 기본**: kata1 **b28** (28블록) 계열 — 정확도 높고, CPU에서는 추론이 무거운 편.
- **작은 네트워크**: 같은 kata1 run에서 블록 수가 적은 네트워크(예: b20, b15 등)는 추론이 더 빠르고, 정확도는 소폭 낮을 수 있음. (영역/사석 계가용으로는 “충분한” 경우가 많음.)

### 적용 방법 (구현 필요)

- **현재**: 서버는 하나의 `KATAGO_MODEL_PATH`(또는 `KATAGO_MODEL_URL`)로 모든 분석(계가 포함)을 수행합니다.
- **계가만 작은 네트워크**를 쓰려면 예를 들어:
  - **A)** KataGo 서비스를 하나 더 두고, 계가 요청만 작은 모델을 쓰는 서비스로 라우팅 (백엔드에서 계가 시에만 다른 `KATAGO_API_URL` 사용하도록 분기).
  - **B)** 같은 KataGo 프로세스에서 요청별로 다른 모델을 쓰는 기능은 KataGo 기본 지원이 아니므로, 계가 전용 **별도 KataGo 인스턴스**(작은 모델 로드)를 띄우고 그쪽 URL만 계가용으로 사용.
- **정확도**: 작은 네트워크로 바꾼 뒤, 기존 b28 결과와 **승자·점수·사석**을 몇 판 비교해 보는 것을 권장합니다.

---

## 4. 정리

| 목표 | 우선 시도 | 추가 검토 |
|------|------------|------------|
| 분석 시간 8~12초대 | `KATAGO_SCORING_MAX_VISITS` / `KATAGO_SCORING_MAX_TIME_SEC` 설정 후 검증 | — |
| 수 초 대 완료 | — | GPU 인프라(RunPod 등) + CUDA/OpenCL KataGo |
| 같은 시간에 더 많은 visits | — | GPU 또는 계가 전용 작은 네트워크 |

현재 Railway + CPU KataGo 환경에서는 **1번 계가 전용 파라미터** 적용이 가장 빠르고, GPU 또는 작은 네트워크는 인프라/구현 비용을 고려해 필요 시 검토하면 됩니다.
