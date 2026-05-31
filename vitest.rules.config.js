import { defineConfig } from 'vitest/config'

// Separate config for the Firestore rules tests (run via `npm run test:rules`,
// which boots the emulator). Kept apart from the default unit-test config so
// `npm test` never needs Java/the emulator.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.{js,jsx}'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
