// Narrated tutorial tour for Fire Marshal. Run via ../run.mjs.
export const meta = {
  app: 'fire-marshal',
  title: 'Fire Marshal',
  port: 5174,
}

export async function run(page, ctx) {
  const { caption, say, showCard, sleep, slowType, moveToSelector, dismissCoachmarks, base } = ctx
  const stamp = Date.now().toString().slice(-5)
  const org = `Northwind Industrial ${stamp}`
  const email = `alex${stamp}@northwind.example`

  // ── Welcome card ───────────────────────────────────────────────────
  await showCard(page, {
    kicker: 'Tutorial', title: 'Fire Marshal',
    subtitle: 'Track every fire extinguisher across all your sites — QR tags, defect workflows and live compliance dashboards.',
  })
  await say('Welcome to Fire Marshal — the app that helps you track every fire extinguisher across all your sites.')
  await say("In this short tutorial, we'll show you how to register, add equipment, and monitor compliance.")

  // ── Step 1: Register organization ──────────────────────────────────
  await page.goto(`${base}/register-org`, { waitUntil: 'networkidle2' })
  await caption(page, 'Step 1 — Register your organization', 'The first person to sign up becomes the admin.')
  await say('First, register your organization. The first person to sign up automatically becomes the administrator.')
  await page.waitForSelector('input[placeholder="Acme Facilities"]')
  await slowType(page, 'input[placeholder="Acme Facilities"]', org)
  await slowType(page, 'input[placeholder="City, Country"]', 'Manchester, UK')
  await slowType(page, 'input[placeholder="Jordan Lee"]', 'Alex Carter')
  await slowType(page, 'input[placeholder="you@company.com"]', email)
  await slowType(page, 'input[placeholder="At least 6 characters"]', 'demo12345')
  await say('Fill in your organization name, your details and a password, then create the organization.')
  await moveToSelector(page, 'button[type="submit"]')
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 20000 })
  await sleep(1500)
  await dismissCoachmarks(page)

  // ── Dashboard overview ─────────────────────────────────────────────
  await caption(page, 'Your safety dashboard', 'Live KPIs and color-coded compliance — updated in real time.')
  await say('You land on your safety dashboard — live KPIs and color-coded compliance, updated in real time.')

  // ── Step 2: Add an extinguisher ────────────────────────────────────
  await page.goto(`${base}/app/add`, { waitUntil: 'networkidle2' })
  await caption(page, 'Step 2 — Add an extinguisher', 'Leave the serial blank to auto-assign; a public QR code is created on save.')
  await say('Next, add an extinguisher. Leave the serial number blank to auto-assign one, and a public QR code is created on save.')
  await page.waitForSelector('input[placeholder="e.g. Tower B - Floor 3"]')
  await slowType(page, 'input[placeholder="e.g. Tower B - Floor 3"]', 'Tower B — Floor 3')
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
  await say('Set the location and the service dates, then save.')
  await moveToSelector(page, 'button[type="submit"]')
  await page.click('button[type="submit"]')
  await sleep(1800)

  // ── Repository ─────────────────────────────────────────────────────
  await page.goto(`${base}/app/repository`, { waitUntil: 'networkidle2' })
  await caption(page, 'The Repository', 'Every extinguisher in one filterable, searchable list.')
  await say('The repository holds every extinguisher in one filterable, searchable list.')

  // ── Refill due ─────────────────────────────────────────────────────
  await page.goto(`${base}/app/refill-due`, { waitUntil: 'networkidle2' })
  await caption(page, 'To Be Refilled', 'Automatically surfaces units approaching their next service date.')
  await say('The To Be Refilled view automatically surfaces units approaching their next service date.')

  // ── QR print ───────────────────────────────────────────────────────
  await page.goto(`${base}/app/qr-print`, { waitUntil: 'networkidle2' })
  await caption(page, 'Print QR tags', 'Anyone can scan to view status or report a defect — no login needed.')
  await say('Print QR tags and affix them. Anyone can scan a tag to view status or report a defect, with no login needed.')

  // ── Approvals ──────────────────────────────────────────────────────
  await page.goto(`${base}/app/approvals`, { waitUntil: 'networkidle2' })
  await caption(page, 'Approvals', 'Admins review and approve refill and defect requests in one place.')
  await say('Admins review and approve refill and defect requests, all in one place.')

  // ── Thank-you card ─────────────────────────────────────────────────
  await showCard(page, {
    kicker: 'Thank you', title: 'Thanks for watching',
    subtitle: 'Get started with Fire Marshal by registering your organization.',
  })
  await say("That's a quick tour of Fire Marshal. Thanks for watching — get started by registering your organization.")
}
