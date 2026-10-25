import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createApi } from "./server/api.mjs";
import { installBundledMusic } from "./server/music-seed.mjs";
import { createPublisher } from "./server/publishing.mjs";

export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_XGN_PUBLIC": JSON.stringify(mode === "public"),
  },
  build: {
    outDir: mode === "public" ? "dist/public-site" : "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [
    react(),
    {
      name: "xgn-api",
      configureServer(server) {
        const api = createApi({ publisher: createPublisher() });
        installBundledMusic(api.store);
        server.middlewares.use((req, res, next) => api.handle(req, res, next));
        server.httpServer?.once("close", () => api.store.db.close());
      },
    },
  ],
}));
