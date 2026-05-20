import serverless from "serverless-http";
import { createApiApp } from "../../api";

const lambdaApp = createApiApp();

export const handler = serverless(lambdaApp);
