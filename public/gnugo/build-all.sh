#!/bin/bash
# Run from public/gnugo: ./build-all.sh
# Requires: wget, tar, emcc (Emscripten). Run from Git Bash or WSL on Windows.

set -xe
SELF=$(cd "`dirname "$0"`" && pwd)
cd "$SELF"

if [ ! -d local/gnugo-3.8 ]; then
  echo "=== Step 1: build_gnugo.sh (download GnuGo 3.8, native build) ==="
  ./build_gnugo.sh
fi

echo "=== Step 2: rebuild_gnugo_with_em.sh (Emscripten + playPass) ==="
./rebuild_gnugo_with_em.sh

echo "=== Build complete: dist/gnugo.js (with _playPass) ==="
ls -la dist/gnugo.js
