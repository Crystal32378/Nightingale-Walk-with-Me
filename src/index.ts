import { serve } from "@hono/node-server";
import routeJson from "../fixtures/fixture-hospital-001.json" with { type: "json" };
import { createVertexClient, GeminiInterpreter } from "./gemini.js";
import { KeywordInterpreter, type Interpreter } from "./interpreter.js";
import { createApp } from "./server.js";
import { InMemorySessionStore } from "./store.js";
import type { Route } from "./types.js";

const fallback = new KeywordInterpreter();
// Without a GCP project we run fully deterministic — same app, no AI layer.
const interpreter: Interpreter = process.env.GOOGLE_CLOUD_PROJECT
  ? new GeminiInterpreter(createVertexClient(), fallback)
  : fallback;

const app = createApp({
  routes: [routeJson as Route],
  store: new InMemorySessionStore(),
  interpreter,
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`nightingale listening on :${port}`);
});
