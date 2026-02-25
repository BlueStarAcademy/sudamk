# Windows에서 GnuGo WASM(playPass 포함) 빌드하기

이 PC에는 `bash`가 없어 자동 빌드를 실행하지 못했습니다. 아래 순서대로 진행하면 됩니다.

## 필요한 것

- **Git Bash** 또는 **WSL**(Windows Subsystem for Linux)  
  - Git for Windows를 설치했다면 "Git Bash" 사용 가능
- **Emscripten**  
  - https://emscripten.org/docs/getting_started/downloads.html  
  - 또는 WSL 안에서: `emsdk install latest && emsdk activate latest && source emsdk_env.sh`

## 한 번에 빌드 (권장)

1. **Git Bash** 또는 **WSL** 터미널을 연다.
2. 프로젝트의 `public/gnugo`로 이동한다.
   ```bash
   cd /c/project/SUDAMR/public/gnugo
   ```
3. Emscripten을 쓸 수 있게 한다 (WSL 예시).
   ```bash
   source /path/to/emsdk/emsdk_env.sh
   ```
4. 빌드 스크립트 실행.
   ```bash
   bash build-all.sh
   ```
5. 끝나면 `dist/gnugo.js`가 생성된다. 이 파일에 **playPass**가 포함되어 있다.

## 단계별로 빌드

- **1단계 (최초 1회)**  
  GnuGo 3.8 소스 다운로드 및 네이티브 빌드:
  ```bash
  bash build_gnugo.sh
  ```
- **2단계**  
  Emscripten으로 `gnugowrapper.c`(playPass 포함) 빌드:
  ```bash
  bash rebuild_gnugo_with_em.sh
  ```
- 결과물: `public/gnugo/dist/gnugo.js`  
  앱은 이미 `/gnugo/dist/gnugo.js`를 우선 로드하므로, 이 파일만 있으면 패가 나와도 WASM GnuGo 수준이 유지된다.

## 이미 해 둔 작업

- `gnugowrapper.c`에 **playPass()** 추가됨
- `rebuild_gnugo_with_em.sh`: `SELF` 수정, `local/gnugo-3.8` 경로 사용, **EXPORTED_FUNCTIONS**에 `_playPass` 포함
- `build_gnugo.sh`: `SELF` 문법 수정
- `build-all.sh`: 위 두 스크립트를 순서대로 실행

Git Bash나 WSL에서 **`bash build-all.sh`** 한 번만 실행하면 된다.
