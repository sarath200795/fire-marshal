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
