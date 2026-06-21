# Tutorial video harness — fire-marshal

Regenerates the screen-recorded tutorial (`fire-marshal.mp4`) by driving the **real app**
in headless Chromium against the local Firebase emulators. No live backend or
credentials required.

## How it works
- `../src` is wired (env-gated by `VITE_USE_EMULATOR`, see `../.env.demo`) to talk to
  the local **Auth + Firestore emulators** instead of a real Firebase project.
- The tour registers a fresh organization through the app's own UI (the first user
  becomes an approved admin), then walks the main pages, captioning each step.
- Frames are captured via Chrome DevTools screencast and encoded to MP4 with ffmpeg.

## Prerequisites
- Node 18+, Java (for the Firestore emulator), and `firebase-tools` on PATH.
- App dependencies installed in the repo root: `npm install`.

The tutorial uses on-screen **closed-caption text** (no audio). See `SCRIPT.md`
for the full caption text per scene.

## Run
```bash
cd demo && npm install        # browser + ffmpeg + puppeteer (from npm)
bash boot.sh                  # terminal 1: emulators + vite (demo mode)
npm run record                # terminal 2: drive the app and encode the video
```
The video is written to `demo/out/fire-marshal.mp4`.

> Note: in network-restricted environments install the browser via
> `@sparticuz/chromium` (bundled in the npm tarball) — this harness already uses it,
> so it works without reaching the Playwright CDN.
