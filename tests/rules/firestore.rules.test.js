import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

let testEnv

// Seed data shared across tests.
const ORG_A = 'orgA'
const ORG_B = 'orgB'
const ADMIN_A = 'adminA'
const MEMBER_A = 'memberA'
const ADMIN_B = 'adminB'
const EXT_A = 'extA1'

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fire-marshal-rules-test',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  // Seed users + orgs + an extinguisher via the admin (rules-bypassing) context.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ADMIN_A), { orgId: ORG_A, status: 'approved', role: 'admin', name: 'Admin A', email: 'a@a.com' })
    await setDoc(doc(db, 'users', MEMBER_A), { orgId: ORG_A, status: 'approved', role: 'member', name: 'Member A', email: 'm@a.com' })
    await setDoc(doc(db, 'users', ADMIN_B), { orgId: ORG_B, status: 'approved', role: 'admin', name: 'Admin B', email: 'b@b.com' })
    await setDoc(doc(db, 'organizations', ORG_A), { name: 'Org A', nameLower: 'org a' })
    await setDoc(doc(db, 'organizations', ORG_B), { name: 'Org B', nameLower: 'org b' })
    await setDoc(doc(db, 'organizations', ORG_A, 'extinguishers', EXT_A), {
      type: 'ABC', capacity: '5 Kg', entity: '1P', region: 'North', centerName: 'Tower A', status: 'active', qrToken: 'tok-a',
    })
    await setDoc(doc(db, 'qr', 'tok-a'), { orgId: ORG_A, extId: EXT_A, type: 'ABC' })
    await setDoc(doc(db, 'orgIndex', 'org a'), { orgId: ORG_A, name: 'Org A' })
  })
})

// Context helpers
const member = () => testEnv.authenticatedContext(MEMBER_A).firestore()
const adminA = () => testEnv.authenticatedContext(ADMIN_A).firestore()
const adminB = () => testEnv.authenticatedContext(ADMIN_B).firestore()
const anon = () => testEnv.unauthenticatedContext().firestore()

describe('organizations', () => {
  it('member can read own org', async () => {
    await assertSucceeds(getDoc(doc(member(), 'organizations', ORG_A)))
  })
  it('member CANNOT read another org', async () => {
    await assertFails(getDoc(doc(member(), 'organizations', ORG_B)))
  })
})

describe('orgIndex (public name lookup)', () => {
  it('anonymous can read the index', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'orgIndex', 'org a')))
  })
  it('cannot be tampered (update denied)', async () => {
    await assertFails(setDoc(doc(member(), 'orgIndex', 'org a'), { orgId: 'hacked', name: 'x' }))
  })
})

describe('users', () => {
  it('user reads own profile', async () => {
    await assertSucceeds(getDoc(doc(member(), 'users', MEMBER_A)))
  })
  it('cross-org user read denied', async () => {
    await assertFails(getDoc(doc(adminB(), 'users', MEMBER_A)))
  })
})

describe('qr mirror', () => {
  it('anyone can read a qr mirror', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'qr', 'tok-a')))
  })
  it('cross-org write denied', async () => {
    await assertFails(setDoc(doc(adminB(), 'qr', 'tok-a'), { orgId: ORG_A, extId: EXT_A, type: 'CO2' }))
  })
  it('same-org write allowed', async () => {
    await assertSucceeds(setDoc(doc(member(), 'qr', 'tok-a'), { orgId: ORG_A, extId: EXT_A, type: 'CO2' }))
  })
})

describe('extinguishers (validation)', () => {
  it('valid create allowed for member', async () => {
    await assertSucceeds(setDoc(doc(member(), 'organizations', ORG_A, 'extinguishers', 'new1'), {
      type: 'ABC', capacity: '5 Kg', entity: '1P', region: 'North', centerName: 'Bay 2', status: 'active',
    }))
  })
  it('invalid enum (bad type) denied', async () => {
    await assertFails(setDoc(doc(member(), 'organizations', ORG_A, 'extinguishers', 'bad1'), {
      type: 'PLASMA', capacity: '5 Kg', entity: '1P', centerName: 'Bay 2', status: 'active',
    }))
  })
  it('cross-org create denied', async () => {
    await assertFails(setDoc(doc(adminB(), 'organizations', ORG_A, 'extinguishers', 'x1'), {
      type: 'ABC', capacity: '5 Kg', entity: '1P', centerName: 'Bay 2', status: 'active',
    }))
  })
})

describe('soft-delete vs purge', () => {
  it('member can soft-delete (update deletedAt)', async () => {
    await assertSucceeds(updateDoc(doc(member(), 'organizations', ORG_A, 'extinguishers', EXT_A), {
      deletedAt: new Date(), deletedBy: 'Member A',
    }))
  })
  it('member CANNOT purge (hard delete) — admin only', async () => {
    await assertFails(deleteDoc(doc(member(), 'organizations', ORG_A, 'extinguishers', EXT_A)))
  })
  it('admin can purge (hard delete)', async () => {
    await assertSucceeds(deleteDoc(doc(adminA(), 'organizations', ORG_A, 'extinguishers', EXT_A)))
  })
})

describe('public reports', () => {
  const validReport = (over = {}) => ({
    approvalStatus: 'pending', source: 'qr', kind: 'defect', defectType: 'pin',
    extId: EXT_A, note: 'pin missing', extLabel: 'FE-1 · ABC', ...over,
  })
  it('valid public defect report allowed', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'organizations', ORG_A, 'reports', 'r1'), validReport()))
  })
  it('bad defect enum denied', async () => {
    await assertFails(setDoc(doc(anon(), 'organizations', ORG_A, 'reports', 'r2'), validReport({ defectType: 'explode' })))
  })
  it('non-pending status denied', async () => {
    await assertFails(setDoc(doc(anon(), 'organizations', ORG_A, 'reports', 'r3'), validReport({ approvalStatus: 'approved' })))
  })
  it('report against a non-existent extinguisher denied', async () => {
    await assertFails(setDoc(doc(anon(), 'organizations', ORG_A, 'reports', 'r4'), validReport({ extId: 'ghost' })))
  })
  it('oversized note denied', async () => {
    await assertFails(setDoc(doc(anon(), 'organizations', ORG_A, 'reports', 'r5'), validReport({ note: 'x'.repeat(501) })))
  })
})

describe('audit log immutability', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'auditLogs', 'log1'), { action: 'extinguisher.create', actorName: 'A' })
    })
  })
  it('member can read audit log', async () => {
    await assertSucceeds(getDoc(doc(member(), 'organizations', ORG_A, 'auditLogs', 'log1')))
  })
  it('member can append a new audit entry', async () => {
    await assertSucceeds(setDoc(doc(member(), 'organizations', ORG_A, 'auditLogs', 'log2'), { action: 'extinguisher.update', actorName: 'M' }))
  })
  it('updating an existing audit entry denied', async () => {
    await assertFails(setDoc(doc(member(), 'organizations', ORG_A, 'auditLogs', 'log1'), { action: 'tampered' }))
  })
  it('deleting an audit entry denied', async () => {
    await assertFails(deleteDoc(doc(member(), 'organizations', ORG_A, 'auditLogs', 'log1')))
  })
})
