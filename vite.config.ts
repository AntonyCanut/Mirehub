import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/index.ts'),
        onstart(args) {
          args.startup()
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/main'),
            emptyOutDir: true,
            rollupOptions: {
              external: ['electron', 'electron-updater', 'node-pty', 'pg', 'pg-native', 'mysql2', 'mssql', 'mongodb', 'better-sqlite3'],
              output: {
                // Prevent code-splitting for dynamic driver imports — avoids
                // chunk hash mismatches between dev and production builds.
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'src/preload/index.ts'),
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/preload'),
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
    // Prevent Vite from resolving symlinks/junctions to their real paths.
    // Without this, esbuild outputs use the real path while Vite's dep
    // optimizer looks up the junction path — the mismatch causes a crash
    // ("Cannot read properties of undefined (reading 'imports')") on Windows.
    preserveSymlinks: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
})
