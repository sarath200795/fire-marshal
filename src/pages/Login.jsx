import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, ArrowRight, PlayCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'
import { Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'

// Demo credentials come from env (never hard-coded), so the button only
// appears once a read-only demo account is configured.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD
const DEMO_ENABLED = Boolean(DEMO_EMAIL && DEMO_PASSWORD)

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)

  const go = () => navigate(location.state?.from?.pathname || '/app/dashboard', { replace: true })

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await login(form)
      toast.success('Welcome back!')
      go()
    } catch (err) {
      toast.error(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const demoLogin = async () => {
    setBusy(true)
    try {
      await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      toast.success('Welcome to the demo! 🧯')
      go()
    } catch (err) {
      toast.error(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">Sign in</h2>
      <p className="mt-1 text-sm text-ink-500">Access your organization's safety portal.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="email"
              required
              autoComplete="email"
              className="input pl-9"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input pl-9"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner size={18} /> : (<>Sign in <ArrowRight size={16} /></>)}
        </button>
      </form>

      {DEMO_ENABLED && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <span className="h-px flex-1 bg-clay-200" /> or <span className="h-px flex-1 bg-clay-200" />
          </div>
          <button type="button" onClick={demoLogin} disabled={busy} className="btn-soft w-full">
            <PlayCircle size={16} /> Explore the live demo
          </button>
          <p className="mt-2 text-center text-xs text-ink-400">
            No sign-up needed — jump straight into a sample organization.
          </p>
        </>
      )}

      <div className="mt-6 space-y-2 text-center text-sm text-ink-500">
        <p>
          New teammate?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            Join your organization
          </Link>
        </p>
        <p>
          Setting up a new company?{' '}
          <Link to="/register-org" className="font-semibold text-brand-600 hover:underline">
            Register an organization
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
