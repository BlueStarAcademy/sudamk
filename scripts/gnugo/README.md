# GnuGo WASM 패(Pass) 지원 빌드

수순에 **패**가 있어도 WASM GnuGo 수준을 유지하려면 `_playPass`를 노출한 커스텀 빌드가 필요합니다.

## 1. 준비

- [dna2ai/gnugo.js](https://github.com/dna2ai/gnugo.js) 저장소 (clone)
- Emscripten SDK (dna2ai 저장소의 `build_gnugo.sh`, `rebuild_gnugo_with_em.sh` 실행 환경)

## 2. 패치 적용

이 디렉터리의 `gnugowrapper-playpass.patch`를 dna2ai/gnugo.js 루트에서 적용합니다.

```bash
cd /path/to/gnugo.js
git apply /path/to/SUDAMR/scripts/gnugo/gnugowrapper-playpass.patch
```

또는 `gnugowrapper.c`에 직접 다음 함수를 `moveTo` 다음, `finalizeGoGame` 앞에 추가합니다.

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

## 3. Emscripten 빌드 시 `_playPass` export

`rebuild_gnugo_with_em.sh`(또는 사용 중인 emcc 명령)에서 **EXPORTED_FUNCTIONS**에 `_playPass`를 추가합니다.

예:

```bash
# 기존에 비슷한 형태가 있다면 그 목록에 "_playPass" 추가
-s EXPORTED_FUNCTIONS='["_initializeGoGame","_finalizeGoGame","_moveTo","_genNextStep","_getBoard","_isLastMove","_playPass", ...]'
```

정확한 인자는 dna2ai 저장소의 빌드 스크립트를 확인한 뒤, 기존 export 목록에 `_playPass`만 넣으면 됩니다.

## 4. 빌드 및 배치

1. dna2ai/gnugo.js에서 `build_gnugo.sh` 실행 후 `rebuild_gnugo_with_em.sh` 실행.
2. 생성된 `dist/gnugo.js`와 `dist/gnugo.wasm`을 **SUDAMR** 프로젝트의 `public/gnugo/`에 복사합니다.

```bash
cp /path/to/gnugo.js/dist/gnugo.js  /path/to/SUDAMR/public/gnugo/
cp /path/to/gnugo.js/dist/gnugo.wasm /path/to/SUDAMR/public/gnugo/
```

3. 앱은 기본적으로 `/gnugo/gnugo.js`를 먼저 로드하므로, 위 파일을 넣어 두면 **패가 나와도 WASM GnuGo**로 다음 수를 둡니다.

자세한 내용은 프로젝트 루트의 [docs/WASM_GNUGO_PASS.md](../../docs/WASM_GNUGO_PASS.md)를 참고하세요.
