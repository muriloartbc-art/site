import serverless from "serverless-http";
import express from "express";
import { configureApp } from "../../server";

const lambdaApp = express();

let configuredAppPromise: Promise<express.Express> | null = null;

lambdaApp.use(async (req, res, next) => {
  try {
    if (!configuredAppPromise) {
      configuredAppPromise = configureApp();
    }

    const configuredApp = await configuredAppPromise;
    return configuredApp(req, res, next);
  } catch (error) {
    next(error);
  }
});

export const handler = serverless(lambdaApp);
