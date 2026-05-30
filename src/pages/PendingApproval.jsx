import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, LogOut, RefreshCw, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function PendingApproval() {
  const { profile, isApproved, isAuthed, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // If approved (e.g. admin just approved), bounce into the app.
  useEffect(() => {
    if (isApproved) navigate('/app/dashboard', { replace: true })
    if (!isAuthed) navigate('/login', { replace: true })
  }, [isApproved, isAuthed, navigate])

  const rejected = profile?.status === 'rejected'

  return (
    <div className="aurora flex min-h-screen items-center justify-center p-6 text-white">
      <motion.div
        className="w-full max-w-md rounded-3xl glass p-8 text-center"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-white/15">
          {rejected ? (
            <XCircle size={30} className="text-red-300" />
          ) : (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}>
              <Clock size={30} className="text-brand-200" />
            </motion.div>
          )}
        </div>

        {rejected ? (
          <>
            <h1 className="text-2xl font-extrabold">Access not approved</h1>
            <p className="mt-2 text-white/70">
              Your request to join <strong>{profile?.orgName}</strong> was declined. Contact your
              organization's administrator if you believe this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">Awaiting approval</h1>
            <p className="mt-2 text-white/70">
              Thanks, <strong>{profile?.name}</strong>! Your request to join{' '}
              <strong>{profile?.orgName}</strong> is pending. An administrator will approve your
              access shortly.
            </p>
          </>
        )}

        <div className="mt-7 flex flex-col gap-2">
          {!rejected && (
            <button
              className="btn bg-white text-ink-900 hover:bg-white/90"
              onClick={async () => {
                await refreshProfile()
                toast('Checked — still pending', { icon: '⏳' })
              }}
            >
              <RefreshCw size={16} /> Check approval status
            </button>
          )}
          <button
            className="btn bg-white/10 text-white hover:bg-white/20"
            onClick={async () => {
              await signOut()
              navigate('/login')
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </motion.div>
    </div>
  )
}
