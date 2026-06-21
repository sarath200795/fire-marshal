// Entry point: launch headless Chromium, record the narrated tour, mux the MP4.
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { spawnSync } from 'child_process'
import { launch, startScreencast, stopAndEncode, caption, say, showCard, sleep, slowType, moveToSelector, clickButtonByText, dismissCoachmarks, makeSamQuiet, initAudio, finalizeAudio, muxAudio } from './recorder.mjs'
import { run } from './tour.mjs'

const require = createRequire(import.meta.url)
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path
const __dir = path.dirname(fileURLToPath(import.meta.url))
const base = 'http://127.0.0.1:' + (process.argv[2] || '5173')
const outDir = path.join(__dir, 'out')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'fire-marshal.mp4')
const silentFile = path.join(outDir, 'fire-marshal.silent.mp4')
const probe = (f) => { const r = spawnSync(FFMPEG, ['-hide_banner','-i',f], { encoding:'utf8' }); const m = String(r.stderr||'').match(/Duration: (\d+):(\d+):(\d+\.\d+)/); return m ? (+m[1])*3600+(+m[2])*60+(+m[3]) : 0 }

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 850 })
await makeSamQuiet(page)
page.setDefaultTimeout(30000)
const t0 = Date.now()
const rec = await startScreencast(page, path.join('/tmp', 'frames-fire-marshal'))
initAudio(path.join('/tmp', 'audio-fire-marshal'), t0)
const ctx = { caption, say: (t) => say(page, t), showCard, sleep, slowType, moveToSelector, clickButtonByText, dismissCoachmarks, base }
try {
  await run(page, ctx)
} catch (e) { console.error('TOUR_ERROR:', e.message) }
const res = await stopAndEncode(rec, silentFile).catch((e) => { console.error('ENCODE_ERROR:', e.message); return null })
await browser.close()
if (res) {
  const dur = probe(silentFile)
  const wav = path.join('/tmp', 'audio-fire-marshal', 'narration.wav')
  finalizeAudio(wav, dur)
  muxAudio(silentFile, wav, outFile)
  fs.unlinkSync(silentFile)
  console.log('VIDEO_OK', outFile, 'frames=' + res.frames)
}
