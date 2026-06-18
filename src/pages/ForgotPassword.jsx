import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'
import { Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.success('Reset link sent — check your inbox.')
    } catch (err) {
      toast.error(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">Reset password</h2>
      <p className="mt-1 text-sm text-ink-500">
        Enter your account email and we'll send you a link to set a new password.
      </p>

      {sent ? (
        <div className="mt-7 rounded-2xl bg-clay-surface p-5 text-sm text-ink-600 shadow-clay-inset">
          <p className="flex items-center gap-2 font-semibold text-ink-800">
            <CheckCircle2 size={18} className="text-green-600" /> Check your email
          </p>
          <p className="mt-1">
            If an account exists for <span className="font-semibold">{email}</span>, a password reset
            link is on its way. The link expires after a short while, so use it soon.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 text-sm font-semibold text-brand-600 hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner size={18} /> : (<>Send reset link <ArrowRight size={16} /></>)}
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-ink-500">
        <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    </AuthShell>
  )
}
