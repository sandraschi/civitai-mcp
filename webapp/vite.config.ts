import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 11125,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/api": { target: "http://127.0.0.1:11124", changeOrigin: true },
      "/mcp": { target: "http://127.0.0.1:11124", changeOrigin: true },
    },
  },
})
