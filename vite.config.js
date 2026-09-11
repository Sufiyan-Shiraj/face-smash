import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

import { tripoProxy } from './src/server/tripoProxy.js'

export default defineConfig(({ mode }) => {
  // Load .env.local into process.env for the SERVER side only. The third
  // argument is the prefix filter, and '' means "no filter" — which is the
  // whole point: TRIPO_API_KEY deliberately has no VITE_ prefix so that Vite
  // will not inline it into the client bundle, and that also means the default
  // loadEnv would skip it. It is read here, used only inside the proxy
  // middleware, and never reaches the browser.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.TRIPO_API_KEY) process.env.TRIPO_API_KEY = env.TRIPO_API_KEY

  return {
    plugins: [react(), tripoProxy()],
    server: {
      host: true, // phones/second laptop on the same wifi can hit the dev server
      port: 5180, // 5173 belongs to another project on this machine
      strictPort: true,
    },
  }
})

// MediaPipe's wasm and .task models are not imported through the bundler. They
// live in public/ (put there by scripts/prepare-assets.mjs) so Vite serves them
// byte-for-byte in dev and copies them into dist/ on build, with no plugin in
// the middle that could behave differently between the two.
