import { serve } from "@hono/node-server";
import fixtureJson from "../fixtures/fixture-hospital-001.json" with { type: "json" };
import renaiJson from "../fixtures/route-renai-001.json" with { type: "json" };
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
  routes: [renaiJson as Route, fixtureJson as Route],
  store: new InMemorySessionStore(),
  interpreter,
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`nightingale listening on :${port}`);
});
