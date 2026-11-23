import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const page = (name: string) => path.resolve(import.meta.dirname, name)

// Relative base: the built site works from any folder (GitHub Pages, a preview link, a USB stick).
// Three pages: the app, the light viewer other sites put in a frame, and the community gallery.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: [{ find: "@", replacement: path.resolve(import.meta.dirname, "./src") }] },
  server: { port: 5192, strictPort: true, host: "127.0.0.1" },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: { main: page("index.html"), embed: page("embed.html"), gallery: page("gallery.html") } },
  },
})
