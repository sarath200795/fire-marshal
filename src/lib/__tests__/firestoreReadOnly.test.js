import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Firestore + firebase app so we test the read-only guard, not the network.
const addDocMock = vi.fn(async () => ({ id: 'new-id' }))
const updateDocMock = vi.fn(async () => {})
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false, data: () => ({}) }),
  getDocs: async () => ({ docs: [] }),
  setDoc: vi.fn(async () => {}),
  addDoc: (...a) => addDocMock(...a),
  updateDoc: (...a) => updateDocMock(...a),
  deleteDoc: vi.fn(async () => {}),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => 'ts',
  writeBatch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} }),
  limit: () => ({}),
  startAfter: () => ({}),
  increment: (n) => n,
}))
vi.mock('../../firebase', () => ({ db: {} }))

const { addSignage, setFirestoreReadOnly, DEMO_READONLY_MESSAGE } = await import('../firestore')

describe('read-only demo guard', () => {
  beforeEach(() => { addDocMock.mockClear(); setFirestoreReadOnly(false) })

  it('blocks writes and never touches Firestore when read-only', async () => {
    setFirestoreReadOnly(true)
    await expect(addSignage('org1', { type: 'FERP Signage', centerName: 'Tower A', condition: 'OK' }, {}))
      .rejects.toThrow(DEMO_READONLY_MESSAGE)
    expect(addDocMock).not.toHaveBeenCalled()
  })

  it('allows writes when not read-only', async () => {
    setFirestoreReadOnly(false)
    await expect(addSignage('org1', { type: 'FERP Signage', centerName: 'Tower A', condition: 'OK' }, {}))
      .resolves.toBe('new-id')
    expect(addDocMock).toHaveBeenCalled()
  })
})
