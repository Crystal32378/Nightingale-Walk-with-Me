import type { Observation, Route } from "./types.js";
import { routeVocabulary } from "./validator.js";

/**
 * Turns free text into an Observation. Gemini will be the primary
 * implementation; KeywordInterpreter is the deterministic fallback that also
 * runs when Gemini fails — a failed AI call must never invent a route.
 */
export interface Interpreter {
  interpret(text: string, route: Route): Promise<Observation>;
  /** Reads a photo the walker took. Absent = this interpreter cannot see. */
  interpretPhoto?(photo: PhotoInput, route: Route): Promise<Observation>;
}

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface PhotoInput {
  mimeType: (typeof PHOTO_MIME_TYPES)[number];
  /** base64, no data: prefix */
  data: string;
}

/** What an interpreter that cannot see returns for a photo: no evidence. */
export const EMPTY_PHOTO_OBSERVATION: Observation = {
  landmarks: [],
  signage: [],
  confidence: "low",
  source: "photo",
};

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
