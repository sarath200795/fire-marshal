// ─────────────────────────────────────────────────────────────────────────────
// Editable legal/compliance details. Replace the [BRACKETED] placeholders with
// your real values before publishing the app for production use. The legal page
// bodies (src/pages/Legal.jsx) read from here so the prose stays generic.
// ─────────────────────────────────────────────────────────────────────────────
export const LEGAL = {
  companyName: '[COMPANY NAME]',
  productName: 'Fire Marshal',
  contactEmail: '[CONTACT EMAIL]',
  jurisdiction: '[JURISDICTION / GOVERNING LAW]',
  effectiveDate: '[EFFECTIVE DATE]',
  // Soft-delete auto-purge window — keep in sync with the Recycle Bin (30 days).
  retentionDays: 30,
}

// The four legal pages + their routes (used for nav + cross-links).
export const LEGAL_PAGES = [
  { kind: 'privacy', path: '/privacy', label: 'Privacy Policy' },
  { kind: 'terms', path: '/terms', label: 'Terms of Service' },
  { kind: 'retention', path: '/data-retention', label: 'Data Retention' },
  { kind: 'cookies', path: '/cookies', label: 'Cookies & Storage' },
]
