// Reusable screen-recording + tutorial helpers for the headless-Chromium tours.
// Captures CDP screencast frames (with timestamps) and encodes them to a
// constant-frame-rate MP4 using the standalone ffmpeg binary that survives in
// the Playwright browser cache.
import fs from 'fs'
import { spawnSync } from 'child_process'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

// Full static ffmpeg (libx264 + concat) installed from the npm registry — the
// ffmpeg bundled with Playwright is stripped (mjpeg→VP8 only, no H.264/concat).
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path

export async function launch() {
  const exe = await chromium.executablePath()
  return puppeteer.launch({
    executablePath: exe,
    headless: 'shell',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
      '--disable-dev-shm-usage', '--no-zygote', '--single-process',
      '--disable-software-rasterizer', '--no-first-run',
      '--force-color-profile=srgb', '--hide-scrollbars',
    ],
  })
}

// Begin collecting screencast frames into `dir`.
export async function startScreencast(page, dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const client = await page.target().createCDPSession()
  const frames = []
  client.on('Page.screencastFrame', async (e) => {
    const file = `${dir}/f${String(frames.length).padStart(6, '0')}.jpg`
    try { fs.writeFileSync(file, Buffer.from(e.data, 'base64')) } catch {}
    frames.push({ file, ts: Date.now() })
    try { await client.send('Page.screencastFrameAck', { sessionId: e.sessionId }) } catch {}
  })
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 75, everyNthFrame: 1 })
  return { client, frames }
}

// Stop the screencast and encode the captured frames to `outFile` (mp4).
export async function stopAndEncode(rec, outFile, width = 1366) {
  try { await rec.client.send('Page.stopScreencast') } catch {}
  await new Promise((r) => setTimeout(r, 400))
  const { frames } = rec
  if (frames.length < 2) throw new Error(`too few frames captured: ${frames.length}`)
  // Build an ffmpeg concat list with per-frame durations from real timestamps,
  // so static pauses simply hold the previous frame.
  let list = ''
  for (let i = 0; i < frames.length; i++) {
    const dur = i < frames.length - 1
      ? Math.min(6, Math.max(0.04, (frames[i + 1].ts - frames[i].ts) / 1000))
      : 1.5
    list += `file '${frames[i].file}'\nduration ${dur.toFixed(3)}\n`
  }
  list += `file '${frames[frames.length - 1].file}'\n`
  const listFile = `${outFile}.concat.txt`
  fs.writeFileSync(listFile, list)
  const args = [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `scale=${width}:-2:flags=lanczos,format=yuv420p`,
    '-r', '25', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', outFile,
  ]
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + String(r.stderr || '').slice(-800))
  return { outFile, frames: frames.length }
}

// Inject / update a fixed caption banner so the recording reads as a tutorial.
// Bottom caption banner with a bold step title and a closed-caption line that
// `say()` fills in with the descriptive narration text.
export async function caption(page, title, sub = '') {
  await page.evaluate(({ title, sub }) => {
    let el = document.getElementById('__demo_caption__')
    if (!el) {
      el = document.createElement('div')
      el.id = '__demo_caption__'
      el.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
        'padding:18px 30px 24px', 'pointer-events:none',
        'background:linear-gradient(transparent,rgba(2,6,23,.5) 30%,rgba(2,6,23,.94))',
        'color:#fff', "font-family:system-ui,-apple-system,Segoe UI,sans-serif",
        'text-shadow:0 1px 4px rgba(0,0,0,.85)',
      ].join(';')
      el.innerHTML =
        '<div id="__cap_title__" style="font-size:26px;font-weight:700"></div>' +
        '<div id="__cap_cc__" style="font-size:19px;font-weight:400;opacity:.96;margin-top:7px;min-height:26px;max-width:1100px"></div>'
      document.documentElement.appendChild(el)
    }
    document.getElementById('__cap_title__').textContent = title || ''
    document.getElementById('__cap_cc__').textContent = sub || ''
  }, { title, sub })
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Click the first visible button whose text starts with `text` (case-insensitive).
export async function clickButtonByText(page, text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')]
    const b = els.find((el) => el.offsetParent !== null && el.textContent.trim().toLowerCase().startsWith(t.toLowerCase()))
    if (b) { b.click(); return true }
    return false
  }, text)
}

// Dismiss product onboarding coach-marks (e.g. the "Sam" guided tour) that
// would otherwise overlay the UI. Non-fatal; retries briefly.
export async function dismissCoachmarks(page) {
  for (let i = 0; i < 6; i++) {
    const hit = (await clickButtonByText(page, 'Skip')) || (await clickButtonByText(page, 'Finish'))
    if (hit) { await sleep(400); return true }
    await sleep(600)
  }
  return false
}

// Keep "Sam" on screen but quiet: make the app believe every guide tip / greeting
// / onboarding tour has already been seen, so the character renders without the
// popup bubbles. Installed before any document loads so it survives navigation.
export async function makeSamQuiet(page) {
  await page.evaluateOnNewDocument(() => {
    try {
      const realGet = Storage.prototype.getItem
      Storage.prototype.getItem = function (k) {
        if (typeof k === 'string' && /guide:(tip|greeted|tour)/i.test(k)) return '1'
        return realGet.call(this, k)
      }
    } catch { /* ignore */ }
  })
}

// ── Narration (offline TTS) ─────────────────────────────────────────────────
// Synthesizes each line to a WAV with espeak-ng (mbrola voice when available),
// accumulating a timeline aligned to the screencast clock so the final audio
// track lines up with the on-screen captions.
const SR = 22050
let audio = null

export function initAudio(workDir, t0) {
  fs.rmSync(workDir, { recursive: true, force: true })
  fs.mkdirSync(workDir, { recursive: true })
  audio = { workDir, t0, cursor: 0, segs: [], n: 0 }
}

function wavDuration(file) {
  const sz = fs.statSync(file).size
  return Math.max(0.1, (sz - 44) / (SR * 2)) // 16-bit mono
}

// Clarity pass: roll off low rumble, lift presence ~3 kHz, dynamic-normalize.
const CLARITY = 'highpass=f=90,equalizer=f=3000:t=o:w=2:g=4,dynaudnorm'
function synth(text) {
  const i = audio.n++
  const raw = `${audio.workDir}/raw${i}.wav`
  const f = `${audio.workDir}/clip${i}.wav`
  // Crisp, clearly-enunciated espeak voice at a conversational rate.
  const r = spawnSync('espeak-ng', ['-v', 'en-us', '-s', '150', '-g', '4', '-w', raw, text], { encoding: 'utf8' })
  if (r.status !== 0 || !fs.existsSync(raw)) {
    spawnSync('espeak-ng', ['-s', '150', '-g', '4', '-w', raw, text])
  }
  const ff = spawnSync(FFMPEG, ['-y', '-i', raw, '-af', CLARITY,
    '-ar', String(SR), '-ac', '1', '-c:a', 'pcm_s16le', f], { encoding: 'utf8' })
  if (ff.status !== 0 || !fs.existsSync(f)) fs.copyFileSync(raw, f)
  return { file: f, dur: wavDuration(f) }
}

// Hold for `ms`, forcing a repaint every ~180ms so the CDP screencast keeps
// emitting frames even on otherwise-static pages (e.g. the title cards). Without
// this, the video clock lags the narration and the tail gets trimmed.
async function holdWithFrames(page, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      await page.evaluate(() => {
        let e = document.getElementById('__keepalive__')
        if (!e) {
          e = document.createElement('div')
          e.id = '__keepalive__'
          e.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;pointer-events:none;z-index:2147483647'
          document.documentElement.appendChild(e)
        }
        e.style.background = e.style.background === 'rgb(0, 0, 0)' ? 'rgb(0, 0, 1)' : 'rgb(0, 0, 0)'
      })
    } catch { /* navigation in flight */ }
    await sleep(180)
  }
}

// Show a narration line as an on-screen closed-caption (no audio) and hold for
// a brisk reading time proportional to its length. Also records a subtitle cue.
export async function say(page, text) {
  await page.evaluate((t) => {
    const cc = document.getElementById('__cap_cc__')
    if (cc) cc.textContent = t
  }, text)
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const ms = Math.min(5000, Math.max(1400, 500 + words * 250))
  const start = subs ? (Date.now() - subs.t0) / 1000 : 0
  await holdWithFrames(page, ms)
  if (subs) subs.cues.push({ start, end: (Date.now() - subs.t0) / 1000, text })
}

// ── Subtitles (toggleable .srt / mov_text track) ────────────────────────────
let subs = null
export function initSubtitles(t0) { subs = { t0, cues: [] } }

const srtTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0')
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  const mil = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${sec},${mil}`
}

export function writeSrt(file) {
  if (!subs) return null
  let out = ''
  subs.cues.forEach((c, i) => {
    // Avoid zero/negative-length cues and overlap with the next one.
    const end = Math.max(c.end, c.start + 0.4)
    out += `${i + 1}\n${srtTime(c.start)} --> ${srtTime(end)}\n${c.text}\n\n`
  })
  fs.writeFileSync(file, out)
  return file
}

export function embedSubs(videoIn, srtFile, videoOut) {
  const r = spawnSync(FFMPEG, ['-y', '-i', videoIn, '-i', srtFile,
    '-c:v', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
    '-movflags', '+faststart', videoOut], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('subtitle mux failed: ' + String(r.stderr || '').slice(-400))
  return videoOut
}

export function finalizeAudio(outWav, totalVideoSec) {
  const silCache = {}
  const silFile = (dur) => {
    const key = Math.max(0.02, dur).toFixed(2)
    if (!silCache[key]) {
      const f = `${audio.workDir}/sil_${key}.wav`
      spawnSync(FFMPEG, ['-y', '-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=mono`, '-t', key, '-c:a', 'pcm_s16le', f])
      silCache[key] = f
    }
    return silCache[key]
  }
  let list = ''
  for (const s of audio.segs) list += `file '${s.type === 'sil' ? silFile(s.dur) : s.file}'\n`
  if (totalVideoSec > audio.cursor + 0.1) list += `file '${silFile(totalVideoSec - audio.cursor)}'\n`
  const listFile = `${audio.workDir}/list.txt`
  fs.writeFileSync(listFile, list)
  const r = spawnSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'pcm_s16le', outWav], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('audio concat failed: ' + String(r.stderr || '').slice(-400))
  return outWav
}

export function muxAudio(videoFile, wavFile, outFile) {
  const r = spawnSync(FFMPEG, ['-y', '-i', videoFile, '-i', wavFile, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', outFile], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('mux failed: ' + String(r.stderr || '').slice(-400))
  return outFile
}

// ── Full-screen title card (Welcome / Thank you) ─────────────────────────────
export async function showCard(page, { kicker, title, subtitle, accent = '#f97316' }) {
  await page.goto('about:blank')
  await page.evaluate((o) => {
    document.body.style.margin = '0'
    const wrap = document.createElement('div')
    wrap.style.cssText = [
      'position:fixed', 'inset:0', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'text-align:center', 'padding:48px',
      'background:radial-gradient(1200px 620px at 50% 28%, #1c2740 0%, #0a0e1a 70%)',
      'color:#fff', 'font-family:system-ui,-apple-system,Segoe UI,sans-serif',
    ].join(';')
    wrap.innerHTML =
      `<div style="font-size:15px;letter-spacing:.34em;text-transform:uppercase;color:${o.accent};font-weight:700;margin-bottom:20px">${o.kicker}</div>` +
      `<div style="font-size:58px;font-weight:800;letter-spacing:-.01em;margin-bottom:16px">${o.title}</div>` +
      `<div style="font-size:22px;font-weight:400;opacity:.85;max-width:780px;line-height:1.55">${o.subtitle}</div>`
    document.documentElement.appendChild(wrap)
  }, { kicker, title, subtitle, accent })
}

// Human-paced typing.
export async function slowType(page, selector, text, delay = 55) {
  const el = await page.waitForSelector(selector, { timeout: 15000 })
  await el.click()
  await page.type(selector, text, { delay })
}

// Smoothly move the mouse to an element (generates screencast motion frames).
export async function moveToSelector(page, selector) {
  const el = await page.waitForSelector(selector, { timeout: 15000 })
  const box = await el.boundingBox()
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
  return el
}
