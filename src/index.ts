import { serve } from "@hono/node-server";
import routeJson from "../fixtures/fixture-hospital-001.json" with { type: "json" };
import { KeywordInterpreter } from "./interpreter.js";
import { createApp } from "./server.js";
import { InMemorySessionStore } from "./store.js";
import type { Route } from "./types.js";

const app = createApp({
  routes: [routeJson as Route],
  store: new InMemorySessionStore(),
  interpreter: new KeywordInterpreter(),
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`nightingale listening on :${port}`);
});
