import { defineConfig } from 'vitest/config'

// Unit tests live in src/ and run in the default (node) env with no emulator.
// Rules tests live in tests/rules/ and are run separately via `npm run test:rules`
// (which boots the Firestore emulator). Exclude them from the default run so
// `npm test` never needs the emulator/Java.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['tests/rules/**', 'node_modules/**', 'dist/**'],
  },
})
