import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'vendor-react': ['react', 'react-dom'],

          // Supabase (auth/database)
          'vendor-supabase': ['@supabase/supabase-js'],

          // Heavy analysis libraries (only loaded when needed)
          'vendor-analysis': ['simple-statistics', 'jstat'],

          // Excel import (large library, only loaded when modal opens)
          'vendor-excel': ['xlsx'],

          // Image processing (only loaded with ImageryAnalyzer)
          'vendor-image': ['piexifjs'],

          // UI icons
          'vendor-icons': ['lucide-react']
        }
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true
      }
    }
  }
})
