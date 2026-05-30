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

  if (loading) return <FullScreenLoader label="Securing your session…" />

  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />

  if (!profile || !isApproved) return <Navigate to="/pending" replace />

  if (adminOnly && !isAdmin) return <Navigate to="/app/dashboard" replace />

  return children
}
