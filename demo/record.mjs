// Entry point: launch headless Chromium, record the captioned tour, and embed a
// toggleable subtitle (mov_text) track from the recorded cues.
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { launch, startScreencast, stopAndEncode, caption, say, showCard, sleep, slowType, moveToSelector, clickButtonByText, dismissCoachmarks, makeSamQuiet, initSubtitles, writeSrt, embedSubs } from './recorder.mjs'
import { run } from './tour.mjs'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const base = 'http://127.0.0.1:' + (process.argv[2] || '5173')
const outDir = path.join(__dir, 'out')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'fire-marshal.mp4')
const rawFile = path.join(outDir, 'fire-marshal.raw.mp4')
const srtFile = path.join(outDir, 'fire-marshal.srt')

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 850 })
await makeSamQuiet(page)
page.setDefaultTimeout(30000)
const rec = await startScreencast(page, path.join('/tmp', 'frames-fire-marshal'))
initSubtitles(Date.now())
const ctx = { caption, say: (t) => say(page, t), showCard, sleep, slowType, moveToSelector, clickButtonByText, dismissCoachmarks, base }
try {
  await run(page, ctx)
} catch (e) { console.error('TOUR_ERROR:', e.message) }
const res = await stopAndEncode(rec, rawFile).catch((e) => { console.error('ENCODE_ERROR:', e.message); return null })
await browser.close()
if (res) {
  try { writeSrt(srtFile); embedSubs(rawFile, srtFile, outFile); fs.unlinkSync(rawFile) }
  catch (e) { console.error('SUBTITLE_ERROR:', e.message); fs.renameSync(rawFile, outFile) }
  console.log('VIDEO_OK', outFile, '+', srtFile, 'frames=' + res.frames)
}
