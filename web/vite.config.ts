import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Highcharts は大きいので別のファイルに分け、キャッシュを効かせる
        manualChunks: (id) => (id.includes('node_modules/highcharts') ? 'highcharts' : undefined),
      },
    },
  },
});
