# WASM GnuGo 패 지원 (패가 나와도 수준 유지)

수순에 **패**가 있어도 WASM GnuGo로 다음 수를 두려면, 래퍼가 **패 한 수를 재현**하는 API를 노출해야 합니다.  
표준 [dna2ai/gnugo.js](https://github.com/dna2ai/gnugo.js)에는 해당 API가 없으므로, 아래처럼 **커스텀 빌드**를 만들어 사용합니다.

---

## 1. 동작 방식

- 앱은 `getWasmGnuGoMove()` 호출 시 수순을 재현한 뒤 `_genNextStep()`으로 다음 수를 받습니다.
- 수순에 패(`x === -1 && y === -1`)가 있으면, **`_playPass()`가 있을 때만** 그 구간을 재현하고, 없으면 `pass-not-supported`로 에러를 반환해 lightGoAi로 폴백합니다.
- 따라서 **`_playPass()`를 노출한 WASM 빌드**를 로드하면, 패가 나와도 WASM GnuGo 수준을 유지할 수 있습니다.

---

## 2. dna2ai/gnugo.js 포크에 playPass 추가

GnuGo C 쪽에는 이미 `gnugo_play_move(PASS_MOVE, color)`로 패를 두는 처리가 있습니다.  
래퍼 C 파일에 **패 한 수**만 호출하는 함수를 추가하면 됩니다.

### 2.1 gnugowrapper.c에 추가할 코드

[dna2ai/gnugo.js](https://github.com/dna2ai/gnugo.js)의 `gnugowrapper.c`에서 `moveTo` 근처에 다음 함수를 추가합니다.  
(헤더는 이미 `liberty.h`, `interface.h` 등을 쓰고 있으므로 `PASS_MOVE` 등은 그대로 사용 가능합니다.)

```c
int EMSCRIPTEN_KEEPALIVE playPass(void) {
   globalPasses++;
   gnugo_play_move(PASS_MOVE, globalGameInfo.to_move);
   sgftreeAddPlay(&globalSgfTree, globalGameInfo.to_move, -1, -1);
   sgffile_output(&globalSgfTree);
   globalGameInfo.to_move = OTHER_COLOR(globalGameInfo.to_move);
   return 0;
}
```

- `PASS_MOVE`는 GnuGo 엔진(예: `liberty.h`)에 정의된 패 위치 상수입니다.
- `sgftreeAddPlay(..., -1, -1)`는 공식 GnuGo `do_pass()`와 동일한 방식으로 SGF에 패를 기록합니다.

### 2.2 Emscripten 빌드 시 export

Emscripten으로 빌드할 때 `playPass`를 내보내도록 설정합니다.  
예: `EXPORTED_FUNCTIONS`에 `_playPass`를 추가하거나, `EMSCRIPTEN_KEEPALIVE`만으로 내보내는 방식이면 빌드 스크립트에 맞게 조정합니다.

```text
# 예시 (기존 export 목록에 추가)
EXPORTED_FUNCTIONS='[..., "_playPass", ...]'
```

빌드 후 생성되는 `gnugo.js`에서 `Module._playPass` 또는 `Module.playPass`로 호출 가능하면 됩니다.

---

## 3. 앱에서 사용하는 방법

1. **위 방식으로 빌드한** `gnugo.js`와 `gnugo.wasm`을 **`public/gnugo/`** 에 넣습니다.
2. 앱은 **기본적으로 `/gnugo/gnugo.js`를 먼저** 로드하고, 실패 시 CDN으로 폴백합니다.  
   따라서 `public/gnugo/`에 파일만 두면 추가 설정 없이 패 지원 빌드가 사용됩니다.
3. 별도 URL을 쓰려면 `window.__GNUGO_WASM_URL = 'https://...';` 로 지정할 수 있습니다.
4. 이렇게 하면 수순에 패가 있어도 `getWasmGnuGoMove()`가 **패를 재현한 뒤** 다음 수를 반환하고, 패를 두는 수가 나오면 `{ x: -1, y: -1 }`로 반환되어 앱에서 `PASS_TURN`으로 처리됩니다.

빌드 절차는 **scripts/gnugo/README.md**, 배치 안내는 **public/gnugo/README.md**를 참고하세요.

---

## 4. 요약

| 항목 | 내용 |
|------|------|
| **목표** | 패가 나와도 WASM GnuGo 수준 유지 |
| **조건** | WASM 래퍼에 `_playPass()` 노출 |
| **방법** | dna2ai/gnugo.js 포크에 `playPass()` C 함수 추가 후 재빌드·호스팅 |
| **앱** | `__GNUGO_WASM_URL`로 해당 빌드 로드 시 자동으로 패 구간도 WASM 사용 |

표준 CDN(dna2ai/gnugo.js) 빌드는 `_playPass`가 없으므로, 패가 있으면 기존처럼 lightGoAi로만 폴백됩니다.

**이 저장소**: GitHub Actions 워크플로 `Build GnuGo WASM (playPass)`가 빌드한 `public/gnugo/dist/gnugo.js`를 main에 커밋합니다. `git pull` 후 배포하면 배포 환경에서도 playPass 포함 버전이 사용됩니다.
