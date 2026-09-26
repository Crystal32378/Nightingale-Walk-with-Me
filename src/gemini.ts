import { GoogleGenAI } from "@google/genai";
import type { Interpreter } from "./interpreter.js";
import { observationSchema, type Observation, type Route } from "./types.js";
import { routeVocabulary } from "./validator.js";

/** Thin seam so tests never need network or credentials. */
export interface LlmClient {
  generate(prompt: string): Promise<string>;
}

export const DEFAULT_MODEL = "gemini-2.5-flash";

export function createVertexClient(opts?: {
  project?: string;
  location?: string;
  model?: string;
}): LlmClient {
  const project = opts?.project ?? process.env.GOOGLE_CLOUD_PROJECT;
  const location = opts?.location ?? process.env.VERTEX_LOCATION ?? "global";
  const model = opts?.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is required for the Vertex client");
  const ai = new GoogleGenAI({ vertexai: true, project, location });
  return {
    async generate(prompt: string): Promise<string> {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0 },
      });
      return res.text ?? "";
    },
  };
}

export function buildObservationPrompt(text: string, route: Route): string {
  const vocab = [...routeVocabulary(route)].sort();
  return [
    "You convert a walker's description of their surroundings into a structured observation.",
    "Canonical landmark vocabulary for this route (the ONLY values allowed in `landmarks` and `signage`):",
    vocab.map((v) => `- ${v}`).join("\n"),
    "",
    "Rules:",
    "- Map the description onto canonical terms only when the person clearly indicates them.",
    "- Every value MUST be copied character-for-character from the vocabulary list above.",
    "  Never translate, rephrase, or normalize a term — if the person's words do not",
    "  correspond to a listed term, leave it out.",
    "- If nothing matches the vocabulary, return empty arrays. Never guess or invent.",
    "- `signage` is for text the person reports reading on a sign; `landmarks` for everything else.",
    "- confidence: high = explicit and unambiguous, medium = probable, low = vague.",
    "",
    "Return ONLY a JSON object, no markdown, exactly this shape:",
    '{"landmarks": string[], "signage": string[], "confidence": "low"|"medium"|"high"}',
    "",
    `Description: """${text}"""`,
  ].join("\n");
}

/**
 * Accepts raw model output; returns a schema-valid observation or null.
 * Untrusted input. `source` is provenance — the server knows how the
 * observation arrived, so the model's opinion about it is discarded.
 */
export function parseObservation(
  raw: string,
  source: Observation["source"] = "text",
): Observation | null {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const result = observationSchema.safeParse({ ...parsed, source });
  return result.success ? result.data : null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`llm timeout after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Primary interpreter. Any failure — network, timeout, malformed JSON, schema
 * violation — falls back to the deterministic interpreter. A failed AI call
 * must never invent a route, and must never take the app down.
 */
export class GeminiInterpreter implements Interpreter {
  constructor(
    private readonly client: LlmClient,
    private readonly fallback: Interpreter,
    private readonly timeoutMs = 8000,
  ) {}

  async interpret(text: string, route: Route): Promise<Observation> {
    try {
      const raw = await withTimeout(
        this.client.generate(buildObservationPrompt(text, route)),
        this.timeoutMs,
      );
      const observation = parseObservation(raw, "text");
      if (observation) return observation;
      console.warn("gemini interpreter: schema-invalid output, using fallback");
    } catch (e) {
      console.warn(
        `gemini interpreter: ${e instanceof Error ? e.message : "call failed"}, using fallback`,
      );
    }
    return this.fallback.interpret(text, route);
  }
}
