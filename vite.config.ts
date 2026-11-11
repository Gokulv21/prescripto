import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/prescripto/",
  server: {
    host: "::",
    port: 8080,
    watch: {
      ignored: ['**/dist/**', '**/.git/**']
    }
  },
  plugins: [
    react(),
    // mode === 'development' &&
    // componentTagger(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      strategies: 'generateSW',
      includeAssets: ['favicon.ico', 'prescriptionLogo.png', 'logo.png'],
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
        maximumFileSizeToCacheInBytes: 5000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webmanifest}']
      },
      manifest: {
        name: 'PreScripto',
        short_name: 'PreScripto',
        description: 'Advanced Clinic Management & Prescription System',
        theme_color: '#0284c7',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })

  ].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 1000,
    emptyOutDir: true,
    sourcemap: false,
  },
  optimizeDeps: {
    include: [
      '@radix-ui/react-switch',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      'recharts',
      'framer-motion',
      'lucide-react',
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
