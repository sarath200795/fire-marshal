import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Building2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'
import { Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'
import { listOrganizations } from '../lib/firestore'

export default function Signup() {
  const { signUpMember } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ orgId: '', name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [orgs, setOrgs] = useState([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [orgsError, setOrgsError] = useState(false)

  useEffect(() => {
    let live = true
    listOrganizations()
      .then((list) => { if (live) setOrgs(list) })
      .catch(() => { if (live) setOrgsError(true) })
      .finally(() => { if (live) setOrgsLoading(false) })
    return () => { live = false }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.orgId) return toast.error('Select your organization')
    setBusy(true)
    try {
      const org = orgs.find((o) => o.id === form.orgId)
      await signUpMember({ ...form, orgName: org?.name || '' })
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

  // No organizations to join (none exist yet, or the list failed to load).
  const noOrgs = !orgsLoading && (orgsError || orgs.length === 0)

  return (
    <AuthShell>
      <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">Join your team</h2>
      <p className="mt-1 text-sm text-ink-500">
        Request access to an existing organization. An admin will approve you.
      </p>

      {noOrgs ? (
        <div className="mt-7 rounded-2xl bg-clay-surface p-5 text-sm text-ink-600 shadow-clay-inset">
          <p className="font-semibold text-ink-800">
            {orgsError ? "Couldn't load organizations" : 'No organizations yet'}
          </p>
          <p className="mt-1">
            {orgsError
              ? 'Please check your connection and try again.'
              : 'There are no organizations to join right now. Be the first — register your organization.'}
          </p>
          <Link to="/register-org" className="btn-primary mt-4 inline-flex">
            <Building2 size={16} /> Register an organization
          </Link>
        </div>
      ) : (
      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <label className="label">Organization</label>
          <div className="relative">
            <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 z-10" />
            <select required className="input pl-9" disabled={orgsLoading} {...field('orgId')}>
              <option value="" disabled>
                {orgsLoading ? 'Loading organizations…' : 'Select your organization…'}
              </option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
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
      )}

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
