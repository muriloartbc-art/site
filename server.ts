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
};

async function startServer() {
  const configuredApp = await configureApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  
  configuredApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

const entrypoint = process.argv[1] || "";

if (entrypoint.endsWith("server.ts") || entrypoint.endsWith("server.cjs")) {
  startServer();
}
