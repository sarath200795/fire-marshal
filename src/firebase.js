import { initializeApp } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
} from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Helpful warning if the developer forgot to create .env
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

if (!isFirebaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Fire Marshal] Firebase is not configured. Copy .env.example to .env and add your project keys.'
  )
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// ── Local emulator wiring (demo / offline dev only) ──────────────────────────
// When VITE_USE_EMULATOR is "1" we point Auth + Firestore at the local Firebase
// emulators instead of a live project. Guarded by an env flag that is absent in
// production builds, so this has no effect on deployed hosting.
export const usingEmulator = import.meta.env.VITE_USE_EMULATOR === '1'
if (usingEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

// Use session persistence (sessionStorage): the login is dropped when the tab /
// browser is closed, so reopening requires signing in again. A same-tab reload
// keeps the session (sessionStorage survives reloads of the same tab).
if (isFirebaseConfigured) {
  setPersistence(auth, browserSessionPersistence).catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[Fire Marshal] could not set session persistence:', e?.message || e)
  })
}

export default app
