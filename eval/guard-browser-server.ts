/** Local-only replay seam for the real frontend's photo upload flow. Never calls a model. */
import { serve } from "@hono/node-server";
import routeJson from "../fixtures/route-renai-001.json" with { type: "json" };
import saved from "./reviews/trip2-2026-10-07/saved-readings.json" with { type: "json" };
import { createApp } from "../src/server.js";
import { KeywordInterpreter } from "../src/interpreter.js";
import { InMemorySessionStore } from "../src/store.js";
import type { Observation, Route } from "../src/types.js";

const text = new KeywordInterpreter();
let photoIndex = 0;
const pairs = [
  ["第二趟/jpg/IMG_5591.jpg", "small"],
  ["S__121634854_0.jpg", "orig"],
  ["S__121634867_0.jpg", "orig"],
] as const;
const app = createApp({ routes: [routeJson as Route], store: new InMemorySessionStore(), interpreter: {
  interpret: (input, route) => text.interpret(input, route),
  interpretPhoto: async () => {
    const [file, variant] = pairs[Math.min(Math.floor(photoIndex++ / 2), 2)]!;
    const reading = saved.readings.find(r => r.file === file && r.variant === variant)!;
    return reading.observation as Observation;
  },
} });
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 8788 }, () => console.log("Local photo regression replay on 127.0.0.1:8788; no cloud model"));
