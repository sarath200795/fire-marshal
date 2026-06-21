// Tutorial tour for Fire Marshal. Run via ../run.mjs.
export const meta = {
  app: 'fire-marshal',
  title: 'Fire Marshal',
  port: 5174,
}

// React-friendly value setter (triggers onChange for controlled inputs).
async function setNative(page, selector, value) {
  await page.$eval(selector, (el, val) => {
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

export async function run(page, ctx) {
  const { caption, sleep, slowType, moveToSelector, dismissCoachmarks, base } = ctx
  const stamp = Date.now().toString().slice(-5)
  const org = `Northwind Industrial ${stamp}`
  const email = `alex${stamp}@northwind.example`

  // ── Intro / landing ────────────────────────────────────────────────
  await page.goto(`${base}/login`, { waitUntil: 'networkidle2' })
  await caption(page, 'Fire Marshal', 'Track every fire extinguisher across all your sites — QR tags, defect workflows and live compliance dashboards.')
  await sleep(3500)

  // ── Step 1: Register organization ──────────────────────────────────
  await page.goto(`${base}/register-org`, { waitUntil: 'networkidle2' })
  await caption(page, 'Step 1 — Register your organization', 'The first person to sign up becomes the admin.')
  await page.waitForSelector('input[placeholder="Acme Facilities"]')
  await sleep(800)
  await slowType(page, 'input[placeholder="Acme Facilities"]', org)
  await slowType(page, 'input[placeholder="City, Country"]', 'Manchester, UK')
  await slowType(page, 'input[placeholder="Jordan Lee"]', 'Alex Carter')
  await slowType(page, 'input[placeholder="you@company.com"]', email)
  await slowType(page, 'input[placeholder="At least 6 characters"]', 'demo12345')
  await sleep(600)
  await moveToSelector(page, 'button[type="submit"]')
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 20000 })
  await sleep(2500)
  // Dismiss the built-in "Sam" onboarding coach-marks so they don't overlay the tour.
  await dismissCoachmarks(page)

  // ── Dashboard overview ─────────────────────────────────────────────
  await caption(page, 'Your safety dashboard', 'Live KPIs and color-coded compliance — updated in real time.')
  await sleep(3000)

  // ── Step 2: Add an extinguisher ────────────────────────────────────
  await page.goto(`${base}/app/add`, { waitUntil: 'networkidle2' })
  await caption(page, 'Step 2 — Add an extinguisher', 'Leave the serial blank to auto-assign; a public QR code is created on save.')
  await page.waitForSelector('input[placeholder="e.g. Tower B - Floor 3"]')
  await sleep(700)
  await slowType(page, 'input[placeholder="e.g. Tower B - Floor 3"]', 'Tower B — Floor 3')
  // pick a near refill date so it shows under "To Be Refilled"
  const refill = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)
  const setDateInput = (el, val) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const dateInputs = await page.$$('input[type="date"]')
  if (dateInputs[0]) await page.evaluate(setDateInput, dateInputs[0], new Date().toISOString().slice(0, 10))
  if (dateInputs[1]) await page.evaluate(setDateInput, dateInputs[1], refill)
  await sleep(800)
  await moveToSelector(page, 'button[type="submit"]')
  await page.click('button[type="submit"]')
  await sleep(2200) // success card

  // ── Step 3: Add a second one (populate data) ───────────────────────
  await page.goto(`${base}/app/add`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('input[placeholder="e.g. Tower B - Floor 3"]')
  await caption(page, 'Step 3 — Build your register', 'Repeat for each unit, or bulk-import many at once from CSV.')
  await slowType(page, 'input[placeholder="e.g. Tower B - Floor 3"]', 'Warehouse — Bay 1')
  await sleep(500)
  await page.click('button[type="submit"]')
  await sleep(1800)

  // ── Repository ─────────────────────────────────────────────────────
  await page.goto(`${base}/app/repository`, { waitUntil: 'networkidle2' })
  await caption(page, 'The Repository', 'Every extinguisher in one filterable, searchable list.')
  await sleep(3000)

  // ── Refill due ─────────────────────────────────────────────────────
  await page.goto(`${base}/app/refill-due`, { waitUntil: 'networkidle2' })
  await caption(page, 'To Be Refilled', 'Automatically surfaces units approaching their next service date.')
  await sleep(2800)

  // ── QR print ───────────────────────────────────────────────────────
  await page.goto(`${base}/app/qr-print`, { waitUntil: 'networkidle2' })
  await caption(page, 'Print QR tags', 'Affix scannable tags — anyone can scan to view status or report a defect, no login needed.')
  await sleep(3000)

  // ── Approvals ──────────────────────────────────────────────────────
  await page.goto(`${base}/app/approvals`, { waitUntil: 'networkidle2' })
  await caption(page, 'Approvals', 'Admins review and approve refill and defect requests in one place.')
  await sleep(2800)

  // ── Close on dashboard ─────────────────────────────────────────────
  await page.goto(`${base}/app/dashboard`, { waitUntil: 'networkidle2' })
  await caption(page, 'Fire Marshal — every extinguisher, accounted for.', 'Start by registering your organization.')
  await sleep(3500)
}
