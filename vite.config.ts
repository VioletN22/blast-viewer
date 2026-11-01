import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/blast-viewer/',
  plugins: [react()],
  build: {
    // three is one 722 kB (184 kB gzip) module that cannot be split further; everything else is far smaller.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Vendor chunks: three on its own, the React Three Fiber stack, then React.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 3 },
            { name: 'r3f', test: /node_modules[\\/](@react-three|three-stdlib|zustand|its-fine|suspend-react)/, priority: 2 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})
