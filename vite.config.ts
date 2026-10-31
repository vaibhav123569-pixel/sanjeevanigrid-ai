import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    // Firebase's modular Auth, Firestore and Storage clients ship as one ~572 kB raw chunk (~172 kB gzip).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/node_modules\/(leaflet|react-leaflet)\//.test(id)) return 'map-vendor';
          if (/node_modules\/(recharts|d3-[^/]+|victory-vendor)\//.test(id)) return 'charts-vendor';
          if (/node_modules\/@firebase\//.test(id) || /node_modules\/firebase\//.test(id)) return 'firebase-vendor';
          if (/node_modules\/framer-motion\//.test(id)) return 'motion-vendor';
          return undefined;
        },
      },
    },
  },
});
