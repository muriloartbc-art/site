import express from "express";
import "dotenv/config";
import path from "path";
import fs from "fs";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";

if (!process.env.AWS_ACCESS_KEY_ID && process.env.REMOTION_AWS_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
}

if (!process.env.AWS_SECRET_ACCESS_KEY && process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
  process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
}

const awsRenderMap = new Map<string, { renderId: string; bucketName: string; percent: number; error: string | null; complete: boolean; lastUpdatedAt: number; outUrl?: string }>();

export const createApiApp = () => {
  const app = express();
  app.use(express.json());

  const framesPerLambda = Number(process.env.REMOTION_FRAMES_PER_LAMBDA || 100);

  app.get("/templates", (req, res) => {
    try {
      const templatesDir = [
        path.join(process.cwd(), "dist", "templates"),
        path.join(process.cwd(), "public", "templates"),
      ].find((dir) => fs.existsSync(dir));

      if (!templatesDir) {
        return res.json({ templates: [] });
      }

      const files = fs.readdirSync(templatesDir);
      const videos = files.filter((f) => {
        if (!f.toLowerCase().endsWith(".mp4") && !f.toLowerCase().endsWith(".webm")) return false;
        try {
          const stats = fs.statSync(path.join(templatesDir, f));
          return stats.size > 0;
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

  app.get("/render/progress", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "No id provided" });

    const lambdaRenderId = req.query.renderId as string | undefined;
    const queryBucketName = req.query.bucketName as string | undefined;
    const data = awsRenderMap.get(id) ?? (
      lambdaRenderId && queryBucketName
        ? {
            renderId: lambdaRenderId,
            bucketName: queryBucketName,
            percent: 0.01,
            error: null,
            complete: false,
            lastUpdatedAt: Date.now(),
          }
        : null
    );

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
        region: process.env.REMOTION_AWS_REGION as any,
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
      res.json({ percent: data.percent, complete: false, error: null });
    }
  });

  app.post("/render/start", async (req, res) => {
    try {
      const { name, phone, renderId: clientRenderId, templateFilename } = req.body;

      if (!name || !phone || !clientRenderId) {
        return res.status(400).json({ error: "Name, phone, and renderId are required" });
      }

      if (!process.env.REMOTION_AWS_REGION || !process.env.REMOTION_FUNCTION_NAME || !process.env.REMOTION_SERVE_URL) {
        return res.status(500).json({ error: "AWS Lambda config missing in .env (REMOTION_AWS_REGION, REMOTION_FUNCTION_NAME, REMOTION_SERVE_URL)" });
      }

      awsRenderMap.set(clientRenderId, { renderId: "", bucketName: "", percent: 0.01, error: null, complete: false, lastUpdatedAt: Date.now() });
      console.log("Starting remote lambda render for", name, phone, "id:", clientRenderId);

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
          fileName: `Campanha_Namorados_${name.replace(/\s+/g, "_")}.mp4`,
        },
      });

      awsRenderMap.set(clientRenderId, {
        renderId: lambdaRender.renderId,
        bucketName: lambdaRender.bucketName,
        percent: 0.05,
        error: null,
        complete: false,
        lastUpdatedAt: Date.now(),
      });

      setTimeout(() => {
        awsRenderMap.delete(clientRenderId);
      }, 60 * 60 * 1000);

      res.json({
        success: true,
        renderId: clientRenderId,
        awsRenderId: lambdaRender.renderId,
        bucketName: lambdaRender.bucketName,
      });
    } catch (error) {
      console.error("Render start failed:", error);
      res.status(500).json({ error: "Failed to start render", details: String(error) });
    }
  });

  app.get("/render/download", (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "No id provided" });

    const data = awsRenderMap.get(id);
    if (!data) return res.status(404).json({ error: "Not found" });
    if (!data.complete || !data.outUrl) return res.status(400).json({ error: "Render not complete yet" });

    res.redirect(data.outUrl);
  });

  return app;
};
