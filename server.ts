import express from "express";
import "dotenv/config";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import os from "os";

if (!process.env.AWS_ACCESS_KEY_ID && process.env.REMOTION_AWS_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
}

if (!process.env.AWS_SECRET_ACCESS_KEY && process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
  process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
}

const awsRenderMap = new Map<string, { renderId: string; bucketName: string; percent: number; error: string | null; complete: boolean; lastUpdatedAt: number; outUrl?: string }>();

const app = express();
export const configureApp = async () => {
  app.use(express.json());

  const framesPerLambda = Number(process.env.REMOTION_FRAMES_PER_LAMBDA || 100);

  app.get("/api/templates", (req, res) => {
    try {
      const templatesDir = path.join(process.cwd(), "public", "templates");
      if (!fs.existsSync(templatesDir)) {
        return res.json({ templates: [] });
      }
      const files = fs.readdirSync(templatesDir);
      const videos = files.filter(f => {
        if (!f.toLowerCase().endsWith(".mp4") && !f.toLowerCase().endsWith(".webm")) return false;
        try {
          const stats = fs.statSync(path.join(templatesDir, f));
          return stats.size > 0; // Ignore empty files
        } catch {
          return false;
        }
      });
      res.json({ templates: videos });
    } catch (error) {
      console.error("Failed to list templates", error);
      res.status(500).json({ error: "Failed to list templates" });
    }
  });

  app.get("/api/render/progress", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "No id provided" });
    const data = awsRenderMap.get(id);
    if (!data) return res.status(404).json({ error: "Not found" });
    
    if (data.error) return res.json({ error: data.error });
    if (data.complete) return res.json(data);
    
    if (!data.renderId || !data.bucketName) {
      return res.json({ percent: data.percent, complete: false, error: null });
    }

    try {
      const progress = await getRenderProgress({
        renderId: data.renderId,
        bucketName: data.bucketName,
        region: process.env.REMOTION_AWS_REGION as any || "us-east-1",
        functionName: process.env.REMOTION_FUNCTION_NAME!,
      });

      if (progress.fatalErrorEncountered) {
         data.error = progress.errors[0]?.message || "AWS Lambda error occurred";
         return res.json({ error: data.error });
      }
      
      data.percent = Math.max(0.05, progress.overallProgress);
      
      if (progress.done && progress.outputFile) {
         data.complete = true;
         data.outUrl = progress.outputFile;
      }
      
      awsRenderMap.set(id, data);
      res.json(data);
    } catch (err) {
      // Suppress error for polling
      res.json({ percent: data.percent, complete: false, error: null });
    }
  });

  app.post("/api/render/start", async (req, res) => {
    try {
      const { name, phone, renderId, templateFilename } = req.body;
      
      if (!name || !phone || !renderId) {
        return res.status(400).json({ error: "Name, phone, and renderId are required" });
      }
      
      if (!process.env.REMOTION_AWS_REGION || !process.env.REMOTION_FUNCTION_NAME || !process.env.REMOTION_SERVE_URL) {
        return res.status(500).json({ error: "AWS Lambda config missing in .env (REMOTION_AWS_REGION, REMOTION_FUNCTION_NAME, REMOTION_SERVE_URL)" });
      }

      awsRenderMap.set(renderId, { renderId: "", bucketName: "", percent: 0.01, error: null, complete: false, lastUpdatedAt: Date.now() });
      console.log("Starting remote lambda render for", name, phone, "id:", renderId);
      
      // Respond immediately
      res.json({ success: true, renderId });

      // Continue in background
      (async () => {
        try {
          const lambdaRender = await renderMediaOnLambda({
            region: process.env.REMOTION_AWS_REGION as any,
            functionName: process.env.REMOTION_FUNCTION_NAME!,
            serveUrl: process.env.REMOTION_SERVE_URL!,
            composition: "CampaignVideo",
            inputProps: { name, phone, templateFilename },
            codec: "h264",
            framesPerLambda,
            downloadBehavior: {
              type: "download",
              fileName: `Campanha_Namorados_${name.replace(/\s+/g, "_")}.mp4`
            }
          });
          
          awsRenderMap.set(renderId, { 
             renderId: lambdaRender.renderId, 
             bucketName: lambdaRender.bucketName,
             percent: 0.05,
             error: null,
             complete: false,
             lastUpdatedAt: Date.now()
          });

          // Cleanup map memory after 1 hour
          setTimeout(() => {
            awsRenderMap.delete(renderId);
          }, 60 * 60 * 1000); 

        } catch (bgError) {
          console.error("Background lambda render failed:", bgError);
          const current = awsRenderMap.get(renderId);
          if (current) {
            current.error = String(bgError);
            current.percent = 0;
            awsRenderMap.set(renderId, current);
          }
        }
      })();

    } catch (error) {
      console.error("Render start failed:", error);
      res.status(500).json({ error: "Failed to start render", details: String(error) });
    }
  });

  app.get("/api/render/download", (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "No id provided" });
    const data = awsRenderMap.get(id);
    if (!data) return res.status(404).json({ error: "Not found" });
    if (!data.complete || !data.outUrl) return res.status(400).json({ error: "Render not complete yet" });
    
    // Redirect to the S3 Presigned URL that Lambda gives us
    res.redirect(data.outUrl);
  });

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
