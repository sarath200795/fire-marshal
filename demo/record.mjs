// Entry point: launch headless Chromium, record the tour, encode the MP4.
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { launch, startScreencast, stopAndEncode, caption, sleep, slowType, moveToSelector, clickButtonByText, dismissCoachmarks } from './recorder.mjs'
import { run } from './tour.mjs'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const base = 'http://127.0.0.1:' + (process.argv[2] || '5173')
const outDir = path.join(__dir, 'out')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'fire-marshal.mp4')

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 850 })
page.setDefaultTimeout(30000)
const rec = await startScreencast(page, path.join('/tmp', 'frames-fire-marshal'))
const ctx = { caption, sleep, slowType, moveToSelector, clickButtonByText, dismissCoachmarks, base }
try {
  await run(page, ctx)
} catch (e) { console.error('TOUR_ERROR:', e.message) }
const res = await stopAndEncode(rec, outFile).catch((e) => { console.error('ENCODE_ERROR:', e.message); return null })
await browser.close()
if (res) console.log('VIDEO_OK', res.outFile, 'frames=' + res.frames)
