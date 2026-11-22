import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Relative base: the built site works from any folder (GitHub Pages, a preview link, a USB stick).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: [{ find: "@", replacement: path.resolve(import.meta.dirname, "./src") }] },
  server: { port: 5192, strictPort: true, host: "127.0.0.1" },
  build: { chunkSizeWarningLimit: 4000 },
})
