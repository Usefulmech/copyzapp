/**
 * Vercel Serverless Entry Point
 * Handles all /api/* routes via the shared Express app.
 */
import { createApp } from "../lib/app.js";

const app = createApp();
export default app;
