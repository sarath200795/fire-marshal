import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../firebase'
import {
  createOrganization,
  createPendingMember,
  findOrgByName,
  getUserProfile,
} from '../lib/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // firebase auth user
  const [profile, setProfile] = useState(null) // users/{uid} doc
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async (uid) => {
    const p = await getUserProfile(uid)
    setProfile(p)
    return p
  }, [])

  useEffect(() => {
    // Without config the auth listener never fires — don't hang on a loader.
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        await refreshProfile(u.uid)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [refreshProfile])

  // Register a brand new organization; caller becomes admin.
  // NOTE: create the auth user FIRST so the org-name lookup runs authenticated —
  // Firestore rules require sign-in to read `organizations`.
  const registerOrganization = async ({ orgName, address, name, email, password }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    try {
      const existing = await findOrgByName(orgName)
      if (existing) {
        throw new Error('An organization with that name already exists. Try signing up to join it.')
      }
      await updateProfile(cred.user, { displayName: name })
      await createOrganization({ orgName, address, uid: cred.user.uid, name, email })
      await refreshProfile(cred.user.uid)
    } catch (err) {
      // Roll back the half-created account so the email can be reused.
      await deleteUser(cred.user).catch(() => {})
      throw err
    }
  }

  // Sign up to join an existing org (pending admin approval). The org is now
  // chosen from a dropdown, so we receive its id directly — no name lookup.
  const signUpMember = async ({ orgId, orgName, name, email, password }) => {
    if (!orgId) throw new Error('Please select your organization.')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    try {
      await updateProfile(cred.user, { displayName: name })
      await createPendingMember({
        uid: cred.user.uid,
        name,
        email,
        orgId,
        orgName: orgName || '',
      })
      await refreshProfile(cred.user.uid)
    } catch (err) {
      await deleteUser(cred.user).catch(() => {})
      throw err
    }
  }

  const login = async ({ email, password }) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await refreshProfile(cred.user.uid)
  }

  const signOut = async () => {
    await fbSignOut(auth)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    isAuthed: Boolean(user),
    isApproved: profile?.status === 'approved',
    isAdmin: profile?.role === 'admin',
    orgId: profile?.orgId || null,
    orgName: profile?.orgName || '',
    registerOrganization,
    signUpMember,
    login,
    signOut,
    refreshProfile: () => user && refreshProfile(user.uid),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
