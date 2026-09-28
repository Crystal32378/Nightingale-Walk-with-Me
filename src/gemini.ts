import { GoogleGenAI } from "@google/genai";
import { EMPTY_PHOTO_OBSERVATION, type Interpreter, type PhotoInput } from "./interpreter.js";
import { observationSchema, type Observation, type Route } from "./types.js";
import { routeTerms } from "./validator.js";

/** Thin seam so tests never need network or credentials. */
export interface LlmClient {
  generate(prompt: string): Promise<string>;
  generateWithImage?(prompt: string, image: PhotoInput): Promise<string>;
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
  const budget = process.env.GEMINI_THINKING_BUDGET;
  const config = {
    temperature: 0,
    ...(budget !== undefined && budget !== "" ? { thinkingConfig: { thinkingBudget: Number(budget) } } : {}),
  };
  return {
    async generate(prompt: string): Promise<string> {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      return res.text ?? "";
    },
    async generateWithImage(prompt: string, image: PhotoInput): Promise<string> {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType: image.mimeType, data: image.data } }, { text: prompt }],
          },
        ],
        config,
      });
      return res.text ?? "";
    },
  };
}

export function buildObservationPrompt(text: string, route: Route): string {
  const vocab = routeTerms(route);
  return [
    "You convert a walker's description of their surroundings into a structured observation.",
    "Canonical landmark vocabulary for this route (the ONLY values allowed in `landmarks` and `signage`):",
    vocab.map((v) => `- ${v}`).join("\n"),
    "",
    "Rules:",
    "- The person's words may be informal, partial, or a paraphrase (e.g. a nickname or a",
    "  synonym for a listed term). Your job is to recognize which listed terms they clearly",
    "  indicate.",
    "- Every OUTPUT value MUST be an exact character-for-character copy of a term from the",
    "  list above. Never output your own spelling, translation, or variant of a term.",
    "- If the description does not clearly indicate any listed term, return empty arrays.",
    "  Never guess or invent.",
    "- `signage` is for text the person reports reading on a sign; `landmarks` for everything else.",
    "- confidence: high = explicit and unambiguous, medium = probable, low = vague.",
    "",
    "Return ONLY a JSON object, no markdown, exactly this shape:",
    '{"landmarks": string[], "signage": string[], "confidence": "low"|"medium"|"high"}',
    "",
    `Description: """${text}"""`,
  ].join("\n");
}

export function buildPhotoPrompt(route: Route): string {
  const vocab = routeTerms(route);
  return [
    "A person walking to a hospital took this photo of what is in front of them.",
    "Canonical landmark vocabulary for this route (the ONLY values allowed in `landmarks` and `signage`):",
    vocab.map((v) => `- ${v}`).join("\n"),
    "",
    "Rules:",
    "- `signage`: listed terms whose text you can actually read on a sign in the photo.",
    "- `landmarks`: listed terms for things clearly visible that are not sign text.",
    "- Only report what is visible in THIS photo. Never add a term because the place is",
    "  probably nearby, or because it belongs with what you do see.",
    "- Report only text that names or marks the spot in front of the person: a sign on the",
    "  building, entrance, shop, pole or street right here. Maps, floor directories and boards",
    "  that list several destinations, exits or floors describe OTHER places — do not report",
    "  any term that appears only there. Exception: if such a map or list marks the person's",
    "  own position (「您的位置」/ You are here, or the current floor highlighted), report only",
    "  the name at that marked position.",
    "- A pictogram, poster, advert or illustration is not the thing it depicts (a wheelchair",
    "  symbol is not 復康巴士; a drawn bus is not a bus). Report a term only when its words are",
    "  printed on a sign or the real thing itself is in view.",
    "- Every OUTPUT value MUST be an exact character-for-character copy of a term from the list.",
    "- If text is too blurry, cut off, or too dark to read, do not guess it — leave it out.",
    "- If nothing listed is clearly visible, return empty arrays. Never guess or invent.",
    "- confidence: high = clearly legible, medium = partly legible, low = unclear.",
    "",
    "Return ONLY a JSON object, no markdown, exactly this shape:",
    '{"landmarks": string[], "signage": string[], "confidence": "low"|"medium"|"high"}',
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
    private readonly photoTimeoutMs = 20000,
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

  /**
   * There is no deterministic way to read a photo, so every failure here
   * yields an empty observation — the engine then re-anchors instead of
   * guessing where the person is.
   */
  async interpretPhoto(photo: PhotoInput, route: Route): Promise<Observation> {
    if (!this.client.generateWithImage) return EMPTY_PHOTO_OBSERVATION;
    try {
      const raw = await withTimeout(
        this.client.generateWithImage(buildPhotoPrompt(route), photo),
        this.photoTimeoutMs,
      );
      const observation = parseObservation(raw, "photo");
      if (observation) return observation;
      console.warn("gemini photo interpreter: schema-invalid output, no evidence");
    } catch (e) {
      console.warn(
        `gemini photo interpreter: ${e instanceof Error ? e.message : "call failed"}, no evidence`,
      );
    }
    return EMPTY_PHOTO_OBSERVATION;
  }
}
