import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeExtinguishers,
  subscribeReports,
  subscribeOrgUsers,
  subscribeOrg,
} from '../lib/firestore'
import {
  fleetSummary,
  isToBeRefilled,
  isInProcess,
  isPhysicalDefect,
  isRefilledClosed,
  isDeleted,
} from '../lib/extinguisherLogic'
import { derivePhysicalDefectLog } from '../lib/defectReports'
import { EXT_LOAD_CAP } from '../lib/firestore'

const FleetContext = createContext(null)

/**
 * One set of real-time listeners for the whole authed app: extinguishers,
 * reports (approval queue), org users and the org document. Pages read derived
 * slices from here.
 */
export function FleetProvider({ children }) {
  const { orgId } = useAuth()
  const [extinguishers, setExtinguishers] = useState([])
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    let ready = false
    const done = () => {
      if (!ready) {
        ready = true
        setLoading(false)
      }
    }
    const u1 = subscribeExtinguishers(orgId, (list) => {
      setExtinguishers(list)
      done()
    })
    const u2 = subscribeReports(orgId, setReports)
    const u3 = subscribeOrgUsers(orgId, setUsers)
    const u4 = subscribeOrg(orgId, setOrg)
    return () => {
      u1()
      u2()
      u3()
      u4()
    }
  }, [orgId])

  const value = useMemo(() => {
    const today = new Date()
    // Soft-deleted units live in the Recycle Bin only — exclude everywhere else.
    const active = extinguishers.filter((e) => !isDeleted(e))
    const deletedExtinguishers = extinguishers.filter((e) => isDeleted(e))
    const summary = fleetSummary(active, today)
    const defectLog = derivePhysicalDefectLog(reports, active)
    return {
      loading,
      org,
      extinguishers: active,
      deletedExtinguishers,
      // True when the live load hit the cap (full set may be larger).
      capped: extinguishers.length >= EXT_LOAD_CAP,
      loadCap: EXT_LOAD_CAP,
      reports,
      users,
      summary,
      pendingReports: reports.filter((r) => r.approvalStatus === 'pending'),
      pendingUsers: users.filter((u) => u.status === 'pending'),
      refillDue: active.filter((e) => isToBeRefilled(e, today)),
      inProcess: active.filter((e) => isInProcess(e)),
      physicalDefects: active.filter((e) => isPhysicalDefect(e)),
      closed: active.filter((e) => isRefilledClosed(e)),
      physicalOpen: defectLog.open,
      physicalClosed: defectLog.closed,
    }
  }, [extinguishers, reports, users, org, loading])

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}

export function useFleet() {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet must be used within FleetProvider')
  return ctx
}
