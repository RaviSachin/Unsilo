import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // FastAPI serves the built files from /static.
  base: "/static/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "../web",
    emptyOutDir: true
  }
});
