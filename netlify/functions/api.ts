import serverless from "serverless-http";
import express from "express";
import { createApiApp } from "../../api";

const lambdaApp = express();
const apiApp = createApiApp();

lambdaApp.use((req, _res, next) => {
  req.url = req.url
    .replace(/^\/\.netlify\/functions\/api/, "")
    .replace(/^\/api/, "");
  next();
});

lambdaApp.use(apiApp);

export const handler = serverless(lambdaApp);
