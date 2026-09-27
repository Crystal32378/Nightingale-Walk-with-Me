import { serve } from "@hono/node-server";
import fixtureJson from "../fixtures/fixture-hospital-001.json" with { type: "json" };
import renaiJson from "../fixtures/route-renai-001.json" with { type: "json" };
import { createVertexClient, GeminiInterpreter } from "./gemini.js";
import { KeywordInterpreter, type Interpreter } from "./interpreter.js";
import { createApp } from "./server.js";
import { Firestore } from "@google-cloud/firestore";
import { FirestoreSessionStore, InMemorySessionStore, type SessionStore } from "./store.js";
import type { Route } from "./types.js";

const fallback = new KeywordInterpreter();
// Without a GCP project we run fully deterministic — same app, no AI layer.
const interpreter: Interpreter = process.env.GOOGLE_CLOUD_PROJECT
  ? new GeminiInterpreter(createVertexClient(), fallback)
  : fallback;

// Firestore whenever we run against a GCP project; SESSION_STORE=memory opts out for local runs.
const store: SessionStore =
  process.env.GOOGLE_CLOUD_PROJECT && process.env.SESSION_STORE !== "memory"
    ? new FirestoreSessionStore(new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT }).collection("sessions"))
    : new InMemorySessionStore();

const app = createApp({
  routes: [renaiJson as Route, fixtureJson as Route],
  store,
  interpreter,
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`nightingale listening on :${port}`);
});
