import { motion } from 'framer-motion'
import { Users as UsersIcon, Check, X, ShieldCheck, Clock, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, Badge, EmptyState } from '../components/ui'
import { useFleet } from '../context/FleetContext'
import { useAuth } from '../context/AuthContext'
import { setUserStatus, setUserRole } from '../lib/firestore'

const STATUS_META = {
  approved: { color: '#16a34a', label: 'Approved' },
  pending: { color: '#f59e0b', label: 'Pending' },
  rejected: { color: '#dc2626', label: 'Rejected' },
}

export default function Users() {
  const { users } = useFleet()
  const { user: me } = useAuth()

  const pending = users.filter((u) => u.status === 'pending')
  const others = users.filter((u) => u.status !== 'pending')

  const act = async (fn, msg) => {
    try {
      await fn()
      toast.success(msg)
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Team & Approvals"
        subtitle="Approve teammates joining your organization and manage roles."
        icon={UsersIcon}
      />

      {/* Pending approvals */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-500">
        <Clock size={15} /> Pending requests ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <EmptyState icon={Check} title="No pending requests" hint="New sign-ups will appear here for approval." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pending.map((u, i) => (
            <motion.div
              key={u.uid}
              className="card flex items-center gap-3 p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-bold text-white">
                {u.name?.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink-900">{u.name}</p>
                <p className="truncate text-xs text-ink-500">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn bg-green-600 px-3 text-white hover:bg-green-700"
                  onClick={() => act(() => setUserStatus(u.uid, 'approved'), `${u.name} approved`)}
                >
                  <Check size={16} />
                </button>
                <button
                  className="btn-ghost px-3"
                  onClick={() => act(() => setUserStatus(u.uid, 'rejected'), `${u.name} rejected`)}
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* All members */}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-500">
        <ShieldCheck size={15} /> Members ({others.length})
      </h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {others.map((u) => {
              const meta = STATUS_META[u.status] || STATUS_META.pending
              const isMe = u.uid === me?.uid
              return (
                <tr key={u.uid} className="hover:bg-ink-50/60">
                  <td className="px-4 py-3 font-semibold text-ink-900">
                    {u.name} {isMe && <span className="text-xs font-normal text-ink-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge color={u.role === 'admin' ? '#6366f1' : '#64748b'}>
                      {u.role === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={meta.color}>{meta.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isMe && (
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-ghost px-2.5 py-1.5 text-xs"
                          onClick={() =>
                            act(
                              () => setUserRole(u.uid, u.role === 'admin' ? 'member' : 'admin'),
                              `${u.name} is now ${u.role === 'admin' ? 'a member' : 'an admin'}`
                            )
                          }
                        >
                          <UserCog size={14} /> {u.role === 'admin' ? 'Make member' : 'Make admin'}
                        </button>
                        {u.status === 'approved' ? (
                          <button
                            className="btn-ghost px-2.5 py-1.5 text-xs"
                            onClick={() => act(() => setUserStatus(u.uid, 'rejected'), `${u.name} revoked`)}
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            className="btn-soft px-2.5 py-1.5 text-xs"
                            onClick={() => act(() => setUserStatus(u.uid, 'approved'), `${u.name} approved`)}
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
