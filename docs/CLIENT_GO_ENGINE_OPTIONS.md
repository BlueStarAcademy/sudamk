# 클라이언트 바둑 엔진 옵션 (WASM / SGF)

브라우저에서 돌리거나, SGF/프로토콜로 수를 둘 수 있는 바둑 엔진 후보 정리.

---

## 1. WASM으로 브라우저에서 실행 가능한 엔진

### 1) GnuGo WASM (이미 프로젝트에서 사용 경험 있음)

| 프로젝트 | 설명 | 라이선스 | API |
|---------|------|----------|-----|
| **dna2ai/gnugo.js** | Emscripten으로 GnuGo를 JS/WASM 포팅. `_initializeGoGame`, `_genNextStep`, `_moveTo(i,j)` 등 C API 노출. | MIT | `Module._moveTo(i,j)`, `Module._genNextStep()` 등 |
| **TristanCacqueray/wasm-gnugo** | GnuGo 포크, 브라우저용으로 정리. JS 디렉터리 포함. | GPL-3.0 | 빌드/연동 방식은 저장소 참고 |

- **현재 프로젝트**: `services/wasmGnuGo.ts`에서 dna2ai/gnugo.js CDN 로드 후 사용. **패가 포함된 수순**은 래퍼에 `_playPass()`가 있을 때만 WASM으로 재현 가능(없으면 lightGoAi로 폴백).
- **장점**: Gnugo 수준, 클라이언트만으로 대국 가능, 서버 부하 없음.
- **패가 나와도 수준 유지**: `_playPass`를 노출한 커스텀 WASM 빌드를 쓰면 수순에 패가 있어도 WASM GnuGo로 다음 수를 두며 수준 유지. 빌드 방법은 [WASM GnuGo 패 지원](WASM_GNUGO_PASS.md) 참고.

### 2) Leela Zero – 브라우저 (WASM + WebGL)

| 항목 | 내용 |
|------|------|
| **Leela Zero - JS** | ntt123 제작. Emscripten + TensorFire(WebGL)로 브라우저에서 동작. [데모](https://ntt123.github.io/leela-zero/) |
| **역할** | 원래는 자기대국/학습용. 임베드해서 “한 수 받기” API로 쓸 수 있는지는 소스 확인 필요. |
| **강도** | 네트워크 가중치에 따라 Gnugo보다 훨씬 강함. 브라우저에서는 느릴 수 있음. |
| **라이선스** | GPL-3.0 |

### 3) KataGo – 브라우저 (WebGPU/WASM)

| 항목 | 내용 |
|------|------|
| **Web KaTrain** | KaTrain 클론, 브라우저에서 KataGo 분석(WebGPU/WASM). [포럼 논의](https://forums.online-go.com/t/web-katrain-browser-based-katrain-clone-with-in-browser-katago-analysis-webgpu-wasm/59096) |
| **Kata_web** | [kata-web.vercel.app](https://kata-web.vercel.app/) – 브라우저에서 KataGo 대국/분석. 클라우드 GPU 사용 설명 있음. |
| **특징** | 강력한 엔진이지만, 순수 클라이언트만 쓰는지/일부 서버 사용인지 앱별로 다름. 임베드 API 제공 여부는 각 프로젝트 확인 필요. |

---

## 2. SGF / GTP로 “수 두기”를 제공하는 엔진

대부분 **데스크톱/서버**에서 GTP(GO Text Protocol) 또는 SGF 로 대국·분석합니다. 브라우저에서 “SGF 형태로 한 수만 받고 싶다”면 보통 다음 둘 중 하나입니다.

### 1) GTP 프로토콜

- **역할**: 엔진과 “바둑판 상태 + 한 수 요청”을 텍스트로 주고받는 표준.
- **주요 엔진**: GnuGo, Leela Zero, KataGo, Pachi 등이 GTP 2 지원.
- **SGF 연동**: GTP 확장으로 `loadsgf`, `printsgf` 등 지원하는 엔진 많음 (예: Leela Zero).
- **브라우저에서 쓰려면**:
  - 엔진을 **서버**에서 돌리고, 브라우저는 WebSocket/HTTP로 “현재 국면 + GTP 명령”을 보내고 “genmove” 결과만 받는 방식이 일반적.
  - 또는 엔진을 **WASM으로** 컴파일해 브라우저에서 돌리고, 같은 GTP 명령을 JS에서 문자열로 주고받는 래퍼를 만드는 방식(예: wasm-gnugo + GTP 래퍼).

### 2) SGF만 다루는 라이브러리 (수 생성 아님)

- **seehuhn/go-sgf**, **toikarin/sgf** 등: SGF **파싱/생성/편집**용. “현재 국면을 SGF로 주면 다음 수를 계산해 주는 AI”는 아님.
- 즉, “SGF 형태로 바둑을 두는 엔진”이 아니라 “SGF 파일을 다루는 도구”입니다.  
  **수 두기**를 원하면 GTP 지원 엔진 + (서버 또는 WASM 래퍼)가 맞습니다.

---

## 3. 정리 및 권장

| 목표 | 추천 |
|------|------|
| **WASM으로 클라이언트에서만 Gnugo급** | **dna2ai/gnugo.js** 다시 활성화 후, 패/국면 동기화 버그만 집중 수정. 이미 `wasmGnuGo.ts`와 연동 경험이 있음. |
| **WASM + 더 강한 수** | **Leela Zero JS** 또는 **Web KaTrain/ Kata_web** 계열 조사 후, “genmove 한 수”만 받는 API가 있으면 그걸로 교체 검토. (라이선스 GPL 등 확인 필요.) |
| **SGF “형태”로 수를 두는 엔진** | SGF는 포맷일 뿐이므로, “SGF로 국면 주고 수 받기”는 **GTP 지원 엔진**을 서버 또는 WASM으로 돌리고, 서버/클라우드에서는 GTP(`loadsgf` + `genmove`)로 연동하는 구성이 현실적. |
| **서버 부하는 피하고 브라우저만 쓰고 싶을 때** | 현재는 **WASM GnuGo(gnugo.js) 버그 수정**이 가장 빠르고, 그 다음에 Leela Zero JS / KataGo 웹 프로젝트의 임베드 가능 여부를 보는 순서를 권장. |

---

## 4. 참고 링크

- dna2ai/gnugo.js: https://github.com/dna2ai/gnugo.js  
- wasm-gnugo: https://github.com/TristanCacqueray/wasm-gnugo  
- Leela Zero (원본, GTP): https://github.com/leela-zero/leela-zero  
- Leela Zero JS 데모: https://ntt123.github.io/leela-zero/  
- GTP 2 스펙: https://www.lysator.liu.se/~gunnar/gtp/gtp2-spec-draft2/gtp2-spec.html  
- SGF: https://www.red-bean.com/sgf/
