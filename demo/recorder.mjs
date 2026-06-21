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
export async function caption(page, title, sub = '') {
  await page.evaluate(({ title, sub }) => {
    let el = document.getElementById('__demo_caption__')
    if (!el) {
      el = document.createElement('div')
      el.id = '__demo_caption__'
      el.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
        'padding:16px 26px 18px', 'pointer-events:none',
        'background:linear-gradient(transparent,rgba(2,6,23,.55) 35%,rgba(2,6,23,.9))',
        'color:#fff', "font-family:system-ui,-apple-system,Segoe UI,sans-serif",
        'text-shadow:0 1px 4px rgba(0,0,0,.8)',
      ].join(';')
      document.documentElement.appendChild(el)
    }
    el.innerHTML =
      `<div style="font-size:24px;font-weight:700">${title}</div>` +
      (sub ? `<div style="font-size:15px;font-weight:400;opacity:.9;margin-top:5px">${sub}</div>` : '')
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

function synth(text) {
  const f = `${audio.workDir}/clip${audio.n++}.wav`
  let r = spawnSync('espeak-ng', ['-v', 'mb-us1', '-s', '148', '-w', f, text], { encoding: 'utf8' })
  if (r.status !== 0 || !fs.existsSync(f)) {
    spawnSync('espeak-ng', ['-v', 'en-us', '-s', '150', '-p', '45', '-w', f, text])
  }
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

// Speak a line now: pad silence up to the current video time, append the clip,
// then hold the scene for the clip's duration (keeping the screencast alive).
export async function say(page, text) {
  if (!audio) { await sleep(800); return }
  const clip = synth(text)
  const nowRel = (Date.now() - audio.t0) / 1000
  if (nowRel > audio.cursor + 0.02) { audio.segs.push({ type: 'sil', dur: nowRel - audio.cursor }); audio.cursor = nowRel }
  audio.segs.push({ type: 'clip', file: clip.file }); audio.cursor += clip.dur
  await holdWithFrames(page, Math.round(clip.dur * 1000) + 350)
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
