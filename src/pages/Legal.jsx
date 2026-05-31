import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { LEGAL, LEGAL_PAGES } from '../lib/legal'

const { companyName, productName, contactEmail, jurisdiction, effectiveDate, retentionDays } = LEGAL

// A block is { h?: heading, p?: paragraph, list?: [items] }.
const SECTIONS = {
  privacy: {
    title: 'Privacy Policy',
    intro: `This Privacy Policy explains how ${companyName} ("we") collects, uses, and protects information in ${productName} (the "Service").`,
    blocks: [
      { h: 'Information we collect', list: [
        'Account information you provide: your name and email address.',
        'Organization information: organization name, address, and the notification email set by an admin.',
        'Operational records you enter: fire-extinguisher details (serial, type, capacity, entity, region, center, deployment / refill / HPT dates), status changes, and defect reports.',
        'Reports submitted via public QR scans, including the reporter role you select and any note you add.',
        'An immutable audit log of changes (who performed an action, what changed, and when).',
      ] },
      { h: 'How we use it', p: 'We use this information solely to provide the Service: managing your organization’s extinguishers, running the defect/refill workflow, generating dashboards and reports, and maintaining an audit trail. We do not sell your data or use it for advertising.' },
      { h: 'Storage & processing', p: 'Data is stored in Google Firebase (Cloud Firestore and Firebase Authentication). Each organization’s records are logically isolated, and access is restricted by security rules so that only approved members of an organization can read its data.' },
      { h: 'Public QR pages', p: 'Each extinguisher has a QR code linking to a public page that displays that unit’s current details and status by design, so anyone scanning it can view condition and report defects. Do not encode sensitive personal data into extinguisher fields.' },
      { h: 'Retention & deletion', p: `Deleted extinguishers are soft-deleted and retained in a Recycle Bin for ${retentionDays} days before permanent purge. See the Data Retention & Deletion page for details and how to request export or deletion.` },
      { h: 'Your rights & contact', p: `To request access, export, correction, or deletion of your data, contact us at ${contactEmail}.` },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: `These Terms govern your use of ${productName}, provided by ${companyName}. By using the Service you agree to them.`,
    blocks: [
      { h: 'Acceptable use', p: 'You may use the Service only for lawful fire-safety record-keeping for your own organization. You are responsible for the accuracy of the data you enter and for the actions of the users you approve.' },
      { h: 'Accounts & organizations', p: 'The first user of an organization is its administrator and approves additional members. Administrators are responsible for managing access, roles, and the organization’s data.' },
      { h: 'Not a substitute for professional inspection', p: `${productName} is a record-keeping and tracking aid ONLY. It does NOT perform, certify, or replace physical fire-extinguisher inspection, servicing, hydrostatic testing, or any legal/regulatory compliance obligation. You remain solely responsible for ensuring extinguishers are inspected, serviced, and compliant by qualified professionals as required by applicable law and standards.` },
      { h: 'Disclaimer of warranties', p: 'The Service is provided "AS IS" and "AS AVAILABLE", without warranties of any kind, express or implied, including fitness for a particular purpose and accuracy of due-date calculations or reminders.' },
      { h: 'Limitation of liability', p: `To the maximum extent permitted by law, ${companyName} shall not be liable for any indirect, incidental, or consequential damages, or for any loss arising from reliance on the Service, including missed inspections, refills, or compliance deadlines.` },
      { h: 'Governing law', p: `These Terms are governed by the laws of ${jurisdiction}.` },
      { h: 'Contact', p: `Questions about these Terms: ${contactEmail}.` },
    ],
  },
  retention: {
    title: 'Data Retention & Deletion',
    intro: 'This describes how long data is kept and how to remove it.',
    blocks: [
      { h: 'Active records', p: 'Extinguisher records, reports, and organization data are retained for as long as your organization uses the Service.' },
      { h: 'Soft-delete & Recycle Bin', p: `Deleting an extinguisher does not erase it immediately — it is moved to an admin-only Recycle Bin (and its public QR page stops resolving). It can be restored during this window.` },
      { h: 'Auto-purge', p: `Soft-deleted records are intended to be permanently purged ${retentionDays} days after deletion. Administrators can also purge a record immediately from the Recycle Bin.` },
      { h: 'Audit log', p: 'The audit log is append-only and immutable: entries cannot be edited or deleted, by design, to preserve an accurate compliance trail.' },
      { h: 'Export', p: 'Administrators can download a full JSON backup of their organization’s data (including soft-deleted records) from the Recycle Bin page.' },
      { h: 'Requesting deletion', p: `To request deletion of your account or your organization’s data, contact ${contactEmail}.` },
    ],
  },
  cookies: {
    title: 'Cookies & Storage',
    intro: `${productName} keeps browser storage to a minimum.`,
    blocks: [
      { h: 'What we store', p: 'We use Firebase Authentication, which stores a session token in your browser (local storage / IndexedDB) to keep you signed in. This is strictly necessary for the Service to function.' },
      { h: 'What we do NOT use', p: 'We do not use third-party advertising or cross-site tracking cookies, and we do not run analytics that profile you across other websites.' },
      { h: 'Managing it', p: 'Signing out clears your session. Clearing your browser’s site data for this app removes the stored token.' },
      { h: 'Contact', p: `Questions: ${contactEmail}.` },
    ],
  },
}

export default function Legal({ kind = 'privacy' }) {
  const section = SECTIONS[kind] || SECTIONS.privacy

  return (
    <div className="aurora min-h-screen px-4 py-10 text-white">
      <motion.div
        className="mx-auto w-full max-w-3xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <span className="text-lg font-extrabold tracking-tight">{productName}</span>
          </div>
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
            <ArrowLeft size={15} /> Back to login
          </Link>
        </div>

        <div className="rounded-3xl bg-white p-6 text-ink-800 shadow-card sm:p-9">
          <div className="mb-1 flex items-center gap-2 text-brand-600">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">{section.title}</h1>
          <p className="mt-1 text-sm text-ink-400">Effective date: {effectiveDate}</p>
          {section.intro && <p className="mt-4 text-ink-600">{section.intro}</p>}

          <div className="mt-6 space-y-6">
            {section.blocks.map((b, i) => (
              <section key={i}>
                {b.h && <h2 className="text-base font-bold text-ink-900">{b.h}</h2>}
                {b.p && <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{b.p}</p>}
                {b.list && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-600">
                    {b.list.map((it, j) => <li key={j}>{it}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Cross-links to the other legal pages */}
          <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-ink-100 pt-5 text-sm">
            {LEGAL_PAGES.map((p) => (
              <Link
                key={p.kind}
                to={p.path}
                className={`font-semibold ${p.kind === kind ? 'text-ink-400' : 'text-brand-600 hover:underline'}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-white/50">
          © {new Date().getFullYear()} {productName}. This is a record-keeping aid, not a substitute for certified fire inspection.
        </p>
      </motion.div>
    </div>
  )
}
