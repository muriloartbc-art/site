import serverless from "serverless-http";
import express from "express";
import { configureApp } from "./server";

const lambdaApp = express();

let configured = false;

// Precisamos inicializar o app assincronamente porque o configureApp() usa await (pro Vite local/dist)
lambdaApp.use(async (req, res, next) => {
  if (!configured) {
    const app = await configureApp();
    lambdaApp.use(app);
    configured = true;
  }
  next();
});

export const handler = serverless(lambdaApp);
