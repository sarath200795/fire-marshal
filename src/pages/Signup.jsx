import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Building2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'
import { Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'

export default function Signup() {
  const { signUpMember } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await signUpMember(form)
      toast.success('Account created — awaiting admin approval.')
      navigate('/pending', { replace: true })
    } catch (err) {
      toast.error(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })

  return (
    <AuthShell>
      <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">Join your team</h2>
      <p className="mt-1 text-sm text-ink-500">
        Request access to an existing organization. An admin will approve you.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <label className="label">Organization name</label>
          <div className="relative">
            <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input required className="input pl-9" placeholder="Acme Facilities" {...field('orgName')} />
          </div>
        </div>
        <div>
          <label className="label">Your name</label>
          <div className="relative">
            <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input required className="input pl-9" placeholder="Jordan Lee" {...field('name')} />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input type="email" required className="input pl-9" placeholder="you@company.com" {...field('email')} />
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input type="password" required minLength={6} className="input pl-9" placeholder="At least 6 characters" {...field('password')} />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner size={18} /> : (<>Request access <ArrowRight size={16} /></>)}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-ink-500">
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
        </p>
        <p>
          No organization yet?{' '}
          <Link to="/register-org" className="font-semibold text-brand-600 hover:underline">Register one</Link>
        </p>
      </div>
    </AuthShell>
  )
}
