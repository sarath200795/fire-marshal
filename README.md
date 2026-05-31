# 🔥 Fire Marshal — Multi-Org Fire Extinguisher Management

A web app for managing fire extinguishers across multiple organizations: self-service org
registration with admin approval, QR-tracked extinguishers, defect reporting, a full refill
workflow, and an animated, color-coded dashboard.

Built with **React (JSX) + Vite**, **Cloud Firestore + Firebase Auth**, **Tailwind CSS**,
**Framer Motion**, and **Recharts**.

---

## Quality & CI

- **Tests:** `npm test` (Vitest) — unit tests for the pure logic libs
  (`extinguisherLogic`, `serial`, `defectReports`, `audit`).
- **CI:** `.github/workflows/ci.yml` runs tests + a production build on every push/PR to `main`.
  Recommended: enable **branch protection** on `main` (GitHub → Settings → Branches) requiring the
  `build-and-test` check to pass before merge.
- **Audit log:** every data change is recorded in an append-only `auditLogs` subcollection and viewable
  by admins at **/app/audit**. The Firestore rules make these entries immutable (no update/delete).

---

## 1. Prerequisites

- Node.js 18+
- A Google account (for Firebase)

## 2. Install

```bash
npm install
```

## 3. Create a Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** → name it (e.g. `fire-marshal`).
2. **Authentication** → Get started → **Sign-in method** → enable **Email/Password**.
3. **Firestore Database** → Create database → **Production mode** → pick a region.
4. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app →
   copy the `firebaseConfig` values.

## 4. Configure environment

```bash
cp .env.example .env   # Windows: copy .env.example .env
```

Fill `.env` with the values from step 3.4:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 5. Publish security rules

Rules are in [`firestore.rules`](./firestore.rules). Publish them either via the Console
(**Firestore → Rules → paste → Publish**) or the CLI:

```bash
npm i -g firebase-tools
firebase login
firebase use --add          # select your project
firebase deploy --only firestore:rules
```

The rules enforce:
- Extinguishers/reports are scoped to a user's organization.
- Only **approved** members can read/write their org's data; only **admins** approve users.
- `qr/{token}` is **world-readable** (so a phone scan works without login) but only writable
  by signed-in members.
- Public QR visitors may **create** a pending report (defect/status request) — which the
  portal then approves or rejects.

## 6. Run

```bash
npm run dev
```

Open <http://localhost:5173>. Register an organization — the first user becomes the **admin**.

## 7. Deploy to Vercel (so QR codes are publicly scannable)

The app is a static Vite SPA. It's hosted on **Vercel**:

```bash
npm i -g vercel       # if not already installed
vercel login
vercel --prod         # build = "npm run build", output = "dist" (auto-detected)
```

- [`vercel.json`](./vercel.json) rewrites all paths to `/index.html` so client-side routes
  (`/qr/:token`, `/app/*`) work on refresh/deep-link.
- Set the six `VITE_FIREBASE_*` values as **Environment Variables** in the Vercel project
  (Project → Settings → Environment Variables), then redeploy.
- In **Firebase Console → Authentication → Settings → Authorized domains**, add your Vercel domain
  (e.g. `your-app.vercel.app`) so login works on the live site.

QR codes encode `https://<your-app>/qr/<token>`, which renders live extinguisher details to
anyone who scans them.

(You can alternatively `npm run build && firebase deploy --only hosting` if you prefer Firebase Hosting.)

---

## Concepts

| Concept | Where |
| --- | --- |
| Enums + color map | `src/lib/constants.js` |
| Due-date math & category derivation | `src/lib/extinguisherLogic.js` |
| All Firestore access | `src/lib/firestore.js` |
| Auth/session state | `src/context/AuthContext.jsx` |

**Lists are derived, not duplicated:** "To be refilled", "In process", "Physical defects" and
"Closed" are all computed from each extinguisher's fields + `status`, so they can never drift.
