import { describe, expect, it } from "vitest";
import routeJson from "../fixtures/fixture-hospital-001.json";
import {
  buildObservationPrompt,
  GeminiInterpreter,
  parseObservation,
  type LlmClient,
} from "../src/gemini.js";
import { KeywordInterpreter } from "../src/interpreter.js";
import type { Route } from "../src/types.js";

const route = routeJson as Route;
const fallback = new KeywordInterpreter();

const clientReturning = (raw: string): LlmClient => ({
  generate: async () => raw,
});

describe("prompt", () => {
  it("carries the full canonical vocabulary and the user text", () => {
    const prompt = buildObservationPrompt("我看到天橋", route);
    expect(prompt).toContain("- footbridge");
    expect(prompt).toContain("- outpatient entrance sign");
    expect(prompt).toContain("我看到天橋");
    expect(prompt).toContain("Never guess or invent");
  });
});

describe("parseObservation", () => {
  it("accepts plain JSON and fenced JSON", () => {
    const json = '{"landmarks":["footbridge"],"signage":[],"confidence":"high","source":"text"}';
    expect(parseObservation(json)?.landmarks).toEqual(["footbridge"]);
    expect(parseObservation("```json\n" + json + "\n```")?.landmarks).toEqual(["footbridge"]);
  });

  it("rejects non-JSON and schema violations", () => {
    expect(parseObservation("Sure! The user sees a footbridge.")).toBeNull();
    expect(parseObservation('{"landmarks":"footbridge"}')).toBeNull();
    expect(
      parseObservation('{"landmarks":[],"signage":[],"confidence":"certain","source":"text"}'),
    ).toBeNull();
  });

  it("stamps provenance itself — a model-mangled source field cannot sink the parse", () => {
    // Live failure 2026-09-26: Gemini echoed the whole description into `source`.
    const mangled =
      '{"landmarks":[],"signage":["2號出口"],"confidence":"high","source":"電梯出來看到黃色的牌子"}';
    const obs = parseObservation(mangled, "text");
    expect(obs?.signage).toEqual(["2號出口"]);
    expect(obs?.source).toBe("text");
    expect(parseObservation(mangled, "photo")?.source).toBe("photo");
  });
});

describe("GeminiInterpreter", () => {
  it("returns the model's schema-valid observation", async () => {
    const interpreter = new GeminiInterpreter(
      clientReturning('{"landmarks":["footbridge"],"signage":[],"confidence":"high","source":"text"}'),
      fallback,
    );
    const obs = await interpreter.interpret("我看到天橋", route);
    expect(obs.landmarks).toEqual(["footbridge"]);
    expect(obs.confidence).toBe("high");
  });

  it("falls back on prose output", async () => {
    const interpreter = new GeminiInterpreter(
      clientReturning("The user appears to be near a footbridge."),
      fallback,
    );
    const obs = await interpreter.interpret("I see the footbridge", route);
    // fallback keyword matcher still finds the canonical term in the text
    expect(obs.landmarks).toEqual(["footbridge"]);
    expect(obs.confidence).toBe("medium");
  });

  it("falls back on schema-violating JSON", async () => {
    const interpreter = new GeminiInterpreter(
      clientReturning('{"landmarks":["footbridge"],"confidence":"extreme"}'),
      fallback,
    );
    const obs = await interpreter.interpret("something vague", route);
    expect(obs.landmarks).toEqual([]);
    expect(obs.confidence).toBe("low");
  });

  it("falls back when the client throws", async () => {
    const interpreter = new GeminiInterpreter(
      { generate: async () => { throw new Error("vertex down"); } },
      fallback,
    );
    const obs = await interpreter.interpret("green pharmacy sign here", route);
    expect(obs.landmarks).toEqual(["green pharmacy sign"]);
  });

  it("falls back on timeout without hanging", async () => {
    const never: LlmClient = { generate: () => new Promise(() => {}) };
    const interpreter = new GeminiInterpreter(never, fallback, 20);
    const obs = await interpreter.interpret("exit 6 sign", route);
    expect(obs.landmarks).toEqual(["exit 6 sign"]);
  });

  it("never lets the model change the source away from text", async () => {
    const interpreter = new GeminiInterpreter(
      clientReturning('{"landmarks":[],"signage":[],"confidence":"low","source":"photo"}'),
      fallback,
    );
    const obs = await interpreter.interpret("hmm", route);
    expect(obs.source).toBe("text");
  });
});
