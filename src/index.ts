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
function createSessionStore(): SessionStore {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId || process.env.SESSION_STORE === "memory") return new InMemorySessionStore();
  const firestore = new Firestore({ projectId });
  const collection = firestore.collection("sessions");
  return new FirestoreSessionStore(collection, operation => firestore.runTransaction(transaction => operation({
    get: id => transaction.get(collection.doc(id)),
    set: (id, data) => { transaction.set(collection.doc(id), data); },
  })));
}

const store = createSessionStore();

const app = createApp({
  routes: [renaiJson as Route, fixtureJson as Route],
  store,
  interpreter,
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`nightingale listening on :${port}`);
});
