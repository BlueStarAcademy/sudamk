# gnugo.wasm 위치 & playPass 패치 적용 안내

## 1. playPass 패치 적용됨

`gnugowrapper.c`에 **playPass()** 함수가 이미 추가되어 있습니다.  
다만 **실제로 사용하려면** 이 소스로 다시 빌드해야 하고, 빌드 시 **EXPORTED_FUNCTIONS**에 `_playPass`를 넣어야 합니다.

- `rebuild_gnugo_with_em.sh`(또는 사용하는 emcc 명령)에서 export 목록에 `_playPass` 추가 후 빌드하면, 생성된 `gnugo.js`에서 `Module._playPass`로 호출 가능합니다.
- 자세한 빌드 절차: 프로젝트 루트의 **scripts/gnugo/README.md** 참고.

---

## 2. gnugo.wasm은 어디 있나?

- **이 프로젝트의 `rebuild_gnugo_with_em.sh`** 는 `-s WASM=0` 으로 설정되어 있어서 **WebAssembly 대신 asm.js**만 만듭니다.  
  → 이 스크립트로 빌드하면 **gnugo.wasm 파일은 생성되지 않고**, `a.out.js`(이동 후 `gnugo.js`) 하나만 나옵니다.

- **gnugo.wasm이 필요한 경우**  
  - CDN 등에서 받은 `gnugo.js`가 **WASM 버전**이면, 같은 출처에서 **gnugo.wasm**을 받아야 합니다.  
    - 예: [dna2ai/gnugo.js dist](https://github.com/dna2ai/gnugo.js/tree/main/dist) 에서 `gnugo.js`와 `gnugo.wasm`을 함께 받아서 `public/gnugo/dist/` 에 넣으면 됩니다.
  - 또는 emcc 빌드 시 **WASM=1** 로 바꾸면, 빌드 결과로 **.js**와 **.wasm** 두 파일이 나오고, 둘 다 같은 폴더(예: `dist/`)에 두면 됩니다.

- **정리**  
  - **asm.js 빌드**(WASM=0): `gnugo.js`만 있으면 되고, **gnugo.wasm은 없음**.  
  - **WASM 빌드**(WASM=1): `gnugo.js`와 **gnugo.wasm**을 같은 폴더에 두고, 앱이 로드하는 스크립트 경로가 그 폴더를 가리키면 됩니다 (예: `/gnugo/dist/gnugo.js` → wasm은 `/gnugo/dist/gnugo.wasm`).
