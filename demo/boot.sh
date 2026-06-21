#!/usr/bin/env bash
# Boot this app's Firebase emulators + Vite dev server (demo mode).
# Run from the repo root:  bash demo/boot.sh
set -e
( cd "$(dirname "$0")/.." && \
  firebase emulators:start --only auth,firestore --project demo-fire-marshal & \
  npm run dev -- --mode demo --host 127.0.0.1 --port 5173 --strictPort & \
  wait )
