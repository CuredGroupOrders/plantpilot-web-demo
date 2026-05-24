import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/gas":     { target: "http://127.0.0.1:8789", changeOrigin: true, proxyTimeout: 120000, timeout: 120000 },
      "/sheet":   { target: "http://127.0.0.1:8789", changeOrigin: true, proxyTimeout: 120000, timeout: 120000 },
      "/v1":      { target: "http://127.0.0.1:8789", changeOrigin: true, proxyTimeout: 120000, timeout: 120000 },
      "/speak":   { target: "http://127.0.0.1:8789", changeOrigin: true, proxyTimeout: 120000, timeout: 120000 },
      "/coach":   { target: "http://127.0.0.1:8789", changeOrigin: true, proxyTimeout: 120000, timeout: 120000 },
      "/healthz": { target: "http://127.0.0.1:8789", changeOrigin: true },
      "/whoami":  { target: "http://127.0.0.1:8789", changeOrigin: true },
    },
  },
});
