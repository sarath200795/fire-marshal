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
  isClosed,
} from '../lib/extinguisherLogic'
import { derivePhysicalDefectLog } from '../lib/defectReports'

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
    const summary = fleetSummary(extinguishers, today)
    const defectLog = derivePhysicalDefectLog(reports, extinguishers)
    return {
      loading,
      org,
      extinguishers,
      reports,
      users,
      summary,
      pendingReports: reports.filter((r) => r.approvalStatus === 'pending'),
      pendingUsers: users.filter((u) => u.status === 'pending'),
      refillDue: extinguishers.filter((e) => isToBeRefilled(e, today)),
      inProcess: extinguishers.filter((e) => isInProcess(e)),
      physicalDefects: extinguishers.filter((e) => isPhysicalDefect(e)),
      closed: extinguishers.filter((e) => isClosed(e)),
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
