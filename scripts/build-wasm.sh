#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p web/src/generated
em++ -std=c++23 -O2 -Wall -Wextra -Wpedantic src/analysis.cpp src/bindings.cpp \
  --no-entry -lembind -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker \
  -sALLOW_MEMORY_GROWTH=1 -sFILESYSTEM=0 -o web/src/generated/energy.mjs
