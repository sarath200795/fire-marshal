import { motion } from 'framer-motion'
import { Flame, KeyRound } from 'lucide-react'

const VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

/** Shown when no Firebase config is present, so the app never blanks out. */
export default function SetupNeeded() {
  return (
    <div className="aurora flex min-h-screen items-center justify-center p-6 text-white">
      <motion.div
        className="w-full max-w-xl rounded-3xl glass p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl">🔥</div>
          <div>
            <h1 className="text-2xl font-extrabold">Fire Marshal</h1>
            <p className="text-sm text-white/60">Connect Firebase to get started</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-200">
            <KeyRound size={16} /> Missing configuration
          </p>
          <p className="mt-2 text-sm text-white/70">
            Create a <code className="rounded bg-black/30 px-1.5 py-0.5">.env</code> file in the project
            root (copy <code className="rounded bg-black/30 px-1.5 py-0.5">.env.example</code>) and add
            your Firebase web config, then restart the dev server.
          </p>
          <ul className="mt-4 space-y-1.5 font-mono text-xs text-white/80">
            {VARS.map((v) => (
              <li key={v} className="rounded bg-black/20 px-3 py-1.5">{v}=…</li>
            ))}
          </ul>
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-white/50">
          <Flame size={14} /> See README.md → “Create a Firebase project” for step-by-step setup.
        </p>
      </motion.div>
    </div>
  )
}
