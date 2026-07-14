import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import Layout from './components/Layout'
import { FleetProvider } from './context/FleetContext'
import { FullScreenLoader } from './components/ui'
import { isFirebaseConfigured } from './firebase'
import SetupNeeded from './pages/SetupNeeded'

// Route-level code splitting — each page is fetched only when navigated to.
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const RegisterOrg = lazy(() => import('./pages/RegisterOrg'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const PendingApproval = lazy(() => import('./pages/PendingApproval'))
const PublicQR = lazy(() => import('./pages/PublicQR'))
const Legal = lazy(() => import('./pages/Legal'))

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Repository = lazy(() => import('./pages/Repository'))
const Signages = lazy(() => import('./pages/Signages'))
const MockDrills = lazy(() => import('./pages/MockDrills'))
const AddExtinguisher = lazy(() => import('./pages/AddExtinguisher'))
const BulkUpload = lazy(() => import('./pages/BulkUpload'))
const QRPrint = lazy(() => import('./pages/QRPrint'))
const RefillDue = lazy(() => import('./pages/RefillDue'))
const InProcess = lazy(() => import('./pages/InProcess'))
const PhysicalDefects = lazy(() => import('./pages/PhysicalDefects'))
const PhysicalDefectLog = lazy(() => import('./pages/PhysicalDefectLog'))
const Closed = lazy(() => import('./pages/Closed'))
const Approvals = lazy(() => import('./pages/Approvals'))
const Users = lazy(() => import('./pages/Users'))
const AEDRepository = lazy(() => import('./pages/AEDRepository'))
const AEDDashboard = lazy(() => import('./pages/AEDDashboard'))
const FASRepository = lazy(() => import('./pages/FASRepository'))
const FASDashboard = lazy(() => import('./pages/FASDashboard'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const RecycleBin = lazy(() => import('./pages/RecycleBin'))

function AppShell() {
  return (
    <ProtectedRoute>
      <FleetProvider>
        <Layout />
      </FleetProvider>
    </ProtectedRoute>
  )
}

export default function App() {
  if (!isFirebaseConfigured) return <SetupNeeded />
  // NOTE: the route tree was previously wrapped in <AnimatePresence mode="wait">
  // keyed on the pathname. That made the incoming page wait for the outgoing
  // page's exit animations to finish — and the in-app subtree (sidebar drawer,
  // the always-animating Assistant, etc.) never cleanly signalled "exit done",
  // so after logout the login page mounted but stayed at its initial opacity:0
  // (a blank screen). Pages still animate in on mount via their own
  // initial/animate props, so rendering <Routes> directly keeps the entrance
  // motion without the fragile cross-page exit gating.
  return (
    <Suspense fallback={<FullScreenLoader label="Loading…" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
          <Route path="/register-org" element={<PublicOnlyRoute><RegisterOrg /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route path="/qr/:token" element={<PublicQR />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/data-retention" element={<Legal kind="retention" />} />
          <Route path="/cookies" element={<Legal kind="cookies" />} />

          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="repository" element={<Repository />} />
            <Route path="signages" element={<Signages />} />
            <Route path="mock-drills" element={<MockDrills />} />
            <Route path="aed" element={<AEDRepository />} />
            <Route path="aed-dashboard" element={<AEDDashboard />} />
            <Route path="fas" element={<FASRepository />} />
            <Route path="fas-dashboard" element={<FASDashboard />} />
            <Route path="add" element={<AddExtinguisher />} />
            <Route path="bulk-upload" element={<BulkUpload />} />
            <Route path="qr-print" element={<QRPrint />} />
            <Route path="refill-due" element={<RefillDue />} />
            <Route path="in-process" element={<InProcess />} />
            <Route path="physical-defects" element={<PhysicalDefects />} />
            <Route path="physical-open" element={<PhysicalDefectLog mode="open" />} />
            <Route path="physical-closed" element={<PhysicalDefectLog mode="closed" />} />
            <Route path="closed" element={<Closed />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
            <Route path="audit" element={<ProtectedRoute adminOnly><AuditLog /></ProtectedRoute>} />
            <Route path="recycle" element={<ProtectedRoute adminOnly><RecycleBin /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
    </Suspense>
  )
}
