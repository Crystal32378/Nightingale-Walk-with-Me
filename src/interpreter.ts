import type { Observation, Route } from "./types.js";
import { routeVocabulary } from "./validator.js";

/**
 * Turns free text into an Observation. Gemini will be the primary
 * implementation; KeywordInterpreter is the deterministic fallback that also
 * runs when Gemini fails — a failed AI call must never invent a route.
 */
export interface Interpreter {
  interpret(text: string, route: Route): Promise<Observation>;
}

/** Matches registered route vocabulary appearing verbatim in the text. Fail-closed. */
export class KeywordInterpreter implements Interpreter {
  async interpret(text: string, route: Route): Promise<Observation> {
    const t = text.trim().toLowerCase();
    const landmarks = [...routeVocabulary(route)].filter((v) => t.includes(v)).slice(0, 10);
    return {
      landmarks,
      signage: [],
      confidence: landmarks.length > 0 ? "medium" : "low",
      source: "text",
    };
  }
}
