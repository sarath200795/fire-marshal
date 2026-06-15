import { useState } from 'react'
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { LEGAL_PAGES } from '../lib/legal'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Boxes,
  PlusCircle,
  Upload,
  Flame,
  RefreshCw,
  Truck,
  Wrench,
  CheckCircle2,
  ClipboardCheck,
  Users as UsersIcon,
  QrCode,
  ClipboardList,
  ListChecks,
  ScrollText,
  Trash2,
  LogOut,
  Menu,
  X,
  Clock,
  Signpost,
  Siren,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { Modal } from './ui'
import Assistant from './Assistant'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { IDLE_MS, WARN_MS, formatMMSS } from '../lib/session'

function NavItem({ to, icon: Icon, label, badge, onClick }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
          isActive
            ? 'bg-brand-500 text-white shadow-glow'
            : 'text-ink-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-pill"
              className="absolute inset-0 -z-10 rounded-xl bg-brand-500"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <Icon size={18} className="shrink-0" />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className="ml-auto rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-700">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const { profile, orgName, isAdmin, signOut } = useAuth()
  const { pendingReports, pendingUsers, refillDue, inProcess, physicalDefects, physicalOpen, deletedExtinguishers } = useFleet()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const close = () => setMobileOpen(false)

  const doLogout = async () => {
    await signOut()
    navigate('/login')
  }

  // Auto-logout after inactivity, with a warning countdown before it fires.
  const { warning, remainingMs, stayActive } = useIdleTimeout({
    idleMs: IDLE_MS,
    warnMs: WARN_MS,
    onIdle: doLogout,
    enabled: true,
  })

  const SidebarContent = (
    <div className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      <div className="mb-4 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-xl shadow-glow">
          🔥
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-white">Fire Marshal</p>
          <p className="truncate text-xs text-ink-400">{orgName}</p>
        </div>
      </div>

      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-ink-500">
        Overview
      </p>
      <NavItem to="/app/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={close} />
      <NavItem to="/app/repository" icon={Boxes} label="Repository" onClick={close} />

      <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-ink-500">
        Manage
      </p>
      <NavItem to="/app/add" icon={PlusCircle} label="Add Extinguisher" onClick={close} />
      <NavItem to="/app/bulk-upload" icon={Upload} label="Bulk Upload" onClick={close} />
      <NavItem to="/app/qr-print" icon={QrCode} label="Print QR Codes" onClick={close} />

      <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-ink-500">
        Site Safety
      </p>
      <NavItem to="/app/signages" icon={Signpost} label="Safety Signage" onClick={close} />
      <NavItem to="/app/mock-drills" icon={Siren} label="Mock Drills" onClick={close} />

      <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-ink-500">
        Workflow
      </p>
      <NavItem to="/app/refill-due" icon={RefreshCw} label="To Be Refilled" badge={refillDue.length} onClick={close} />
      <NavItem to="/app/in-process" icon={Truck} label="In Process" badge={inProcess.length} onClick={close} />
      <NavItem to="/app/physical-defects" icon={Wrench} label="Physical Defects" badge={physicalDefects.length} onClick={close} />
      <NavItem to="/app/physical-open" icon={ClipboardList} label="Phys. Defects (Open)" badge={physicalOpen.length} onClick={close} />
      <NavItem to="/app/physical-closed" icon={ListChecks} label="Phys. Defects (Closed)" onClick={close} />
      <NavItem to="/app/closed" icon={CheckCircle2} label="Refilled & Closed" onClick={close} />
      <NavItem to="/app/approvals" icon={ClipboardCheck} label="Approvals" badge={pendingReports.length} onClick={close} />

      {isAdmin && (
        <>
          <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-ink-500">
            Admin
          </p>
          <NavItem to="/app/users" icon={UsersIcon} label="Users" badge={pendingUsers.length} onClick={close} />
          <NavItem to="/app/audit" icon={ScrollText} label="Audit Log" onClick={close} />
          <NavItem to="/app/recycle" icon={Trash2} label="Recycle Bin" badge={deletedExtinguishers.length} onClick={close} />
        </>
      )}

      <div className="mt-auto pt-4">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
              {(profile?.name || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{profile?.name}</p>
              <p className="truncate text-[11px] capitalize text-ink-400">{profile?.role}</p>
            </div>
            <button
              onClick={doLogout}
              className="rounded-lg p-2 text-ink-400 hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-clay-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink-950 shadow-clay lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink-950/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 bg-ink-950 lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-clay-bg/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 shadow-clay-sm transition hover:bg-clay-100 active:shadow-clay-pressed">
            <Menu size={20} />
          </button>
          <span className="flex items-center gap-2 font-extrabold">
            <Flame size={18} className="text-brand-500" /> Fire Marshal
          </span>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="no-print mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-ink-400 sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Fire Marshal</span>
          {LEGAL_PAGES.map((p) => (
            <Link key={p.kind} to={p.path} className="hover:text-ink-700">{p.label}</Link>
          ))}
        </footer>
      </div>

      {/* Sam — the fire-safety assistant (floating, on every authed page) */}
      <Assistant />

      {/* Idle session warning — auto sign-out countdown */}
      <Modal open={warning} onClose={() => {}} title="Still there?">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-clay-surface text-brand-600 shadow-clay-inset">
            <Clock size={26} />
          </div>
          <p className="text-sm text-ink-600">
            You've been inactive. For security you'll be signed out in
          </p>
          <p className="text-4xl font-black tabular-nums text-ink-900">{formatMMSS(remainingMs)}</p>
          <div className="mt-2 flex w-full gap-2">
            <button className="btn-ghost flex-1" onClick={doLogout}>
              <LogOut size={16} /> Log out now
            </button>
            <button className="btn-primary flex-1" onClick={stayActive}>
              Stay signed in
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
