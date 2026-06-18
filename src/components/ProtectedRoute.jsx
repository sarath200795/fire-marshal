import { useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FullScreenLoader } from './ui'

/**
 * Guards the in-app area:
 *  - not signed in    → /login
 *  - signed in, no profile / not approved → /pending
 *  - adminOnly route + non-admin → /app/dashboard
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { loading, isAuthed, profile, isApproved, isAdmin } = useAuth()
  const location = useLocation()

  // Stable `state` for the login redirect. <Navigate> calls navigate() from an
  // effect keyed on the `state` identity, so a fresh `{ from: location }` object
  // each render re-fires the navigation. During logout, AnimatePresence keeps
  // this redirect mounted through the page-exit animation, so an unstable object
  // produced a navigation storm ("Throttling navigation to prevent the browser
  // from hanging"). Memoizing on pathname keeps the reference stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fromState = useMemo(() => ({ from: location }), [location.pathname])

  if (loading) return <FullScreenLoader label="Securing your session…" />

  if (!isAuthed) return <Navigate to="/login" state={fromState} replace />

  if (!profile || !isApproved) return <Navigate to="/pending" replace />

  if (adminOnly && !isAdmin) return <Navigate to="/app/dashboard" replace />

  return children
}
