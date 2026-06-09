import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FullScreenLoader } from './ui'

/**
 * Wraps the auth pages (login / signup / register). If the visitor is already
 * signed in, send them straight to the app instead of showing a login form:
 *  - approved member  → /app/dashboard
 *  - signed in but not yet approved → /pending
 * Otherwise render the public page.
 */
export default function PublicOnlyRoute({ children }) {
  const { loading, isAuthed, profile, isApproved } = useAuth()

  if (loading) return <FullScreenLoader label="Loading…" />
  if (isAuthed && profile && isApproved) return <Navigate to="/app/dashboard" replace />
  if (isAuthed && profile && !isApproved) return <Navigate to="/pending" replace />
  return children
}
