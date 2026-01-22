
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Khmer Chess',
        short_name: 'KhmerChess',
        description: 'The future of Cambodian Chess.',
        theme_color: '#0C0C0C',
        background_color: '#0C0C0C',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'https://api.dicebear.com/7.x/shapes/svg?seed=pwa-192',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'https://api.dicebear.com/7.x/shapes/svg?seed=pwa-512',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'https://api.dicebear.com/7.x/shapes/svg?seed=pwa-512-maskable',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.chesscomfiles\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'chess-assets',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'piece-images',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
  define: {
    'process.env': process.env
  }
});
