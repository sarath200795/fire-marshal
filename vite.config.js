import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // Split heavy third-party libs into their own chunks so the initial
    // payload stays small. Route-level React.lazy (see src/App.jsx) means a
    // chunk like xlsx or recharts is only fetched when its page is opened.
    rollupOptions: {
      output: {
        // Only split out heavy, SELF-CONTAINED libraries that don't share a
        // dependency graph with React. Splitting React-coupled libs (recharts,
        // react-router, react-is, scheduler…) across chunks creates cross-chunk
        // circular imports → TDZ crashes ("Cannot access 'X' before
        // initialization" / "reading 'memo'"). Route-level React.lazy already
        // code-splits the app pages, so everything else stays in one vendor
        // chunk where evaluation order is correct.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          const m = id.split('node_modules/')[1] || ''
          const pkg = m.startsWith('@') ? m.split('/').slice(0, 2).join('/') : m.split('/')[0]
          if (pkg === 'xlsx') return 'xlsx'
          if (pkg === 'firebase' || pkg.startsWith('@firebase')) return 'firebase'
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
