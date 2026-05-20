import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createApiApp } from "./api";

const app = express();
export const configureApp = async () => {
  app.use("/api", createApiApp());

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  return app;
}

// Para uso local (onde rodamos no Cloud Run ou no PC)
async function startServer() {
  const configuredApp = await configureApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  
  configuredApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

import { fileURLToPath } from "url";

// Apenas starta se chamarmos diretamente pelo ts-node/node/tsx
const isMainModule = (() => {
  if (typeof process === "undefined" || !process.argv || !process.argv[1]) return false;
  if (typeof require !== "undefined" && require.main === module) return true;
  if (typeof import.meta !== "undefined" && import.meta.url) {
    try {
      return process.argv[1] === fileURLToPath(import.meta.url);
    } catch (e) {
      return false;
    }
  }
  return false;
})();

if (isMainModule) {
  startServer();
}
