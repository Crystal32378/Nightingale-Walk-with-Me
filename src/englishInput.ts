import type { Observation, Route } from "./types.js";
import { routeVocabulary } from "./validator.js";

const empty = (): Observation => ({ landmarks: [], signage: [], confidence: "low", source: "text" });
const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, "").replace(/[.,?!]/g, " ").replace(/\s+/g, " ").trim();
const phrase = (text: string) => normalize(text).replace(/^(?:i (?:can )?see |i am at |im at |there is |there are )/, "").replace(/^(?:a |an |the )/, "");

/** These are reviewed language aliases, not additional landmarks. Match the
 * complete affirmative phrase; a lane must never become the wider road. */
export const ENGLISH_ALIASES: Readonly<Record<string, string>> = {
  "lane 116 section 1 daan road": "大安路一段116巷",
  "alley 13 lane 123 section 3 renai road": "仁愛路三段123巷13弄",
  "renai road": "仁愛路",
  "howard plaza": "福華飯店",
  "howard plaza hotel": "福華飯店",
  "howard plaza hotel taipei": "福華飯店",
  "emergency": "急診",
  "emergency department": "急診",
  "emergency driveway": "急診",
  "er": "急診",
  "parking lot": "停車場",
  "ambulance": "救護車",
  "hospital building": "醫院大樓",
  "hospital": "醫院",
  "glass doors": "玻璃門",
  "taipei city hospital": "臺北市立聯合醫院",
  "renai branch": "仁愛院區",
  "lobby entrance": "大廳入口",
  "temporary parking area": "臨時停車區",
  "rehabilitation bus": "復康巴士",
  "queued taxis": "排班計程車",
  "taxi stand": "排班計程車",
  "yellow vertical plaque": "黃色直式掛牌",
  "yellow vertical sign": "黃色直式掛牌",
  "daan road": "大安路",
  "green-roofed corridor": "綠色頂棚走廊",
  "green canopy corridor": "綠色頂棚走廊",
  "intersection of renai road and fuxing south road": "仁愛路",
  "intersection of fuxing south road and renai road": "仁愛路",
  "renai fuxing intersection": "仁愛路",
};

export function isEnglishCaution(text: string): boolean {
  if (!/[a-z]/i.test(text)) return false;
  // Preserve question punctuation before normalization removes it. A request
  // for directions or a guessed sign is not a positive location report.
  if (/[?？]/.test(text)) return true;
  const normalized = normalize(text);
  return /\b(?:not|no|never|without|cannot|cant|dont|doesnt|didnt|isnt|arent|wasnt|werent|havent|hasnt|hadnt|wont|wouldnt|shouldnt|couldnt|unsure|uncertain|maybe|perhaps|might|possibly|probably|guess|think)\b/.test(normalized)
    || /^(?:is|are|am|was|were|do|does|did|can|could|would|should|will|where|which|what|how|why)\b/.test(normalized)
    || /\b(?:looking for|look for|trying to find|want to go|need to find|want to reach)\b/.test(normalized)
    || /\b(?:crossed|across)\s+(?:the\s+)?renai\b/.test(normalized);
}

export function isEnglishBike(text: string): boolean {
  return !isEnglishCaution(text) && /^(?:youbike|ubike)(?: station)?$/.test(phrase(text));
}

export function englishObservation(text: string, route: Route): Observation | undefined {
  if (route.routeId !== "renai-001") return undefined;
  if (isEnglishCaution(text) || isEnglishBike(text)) return empty();
  const key = phrase(text);
  const term = Object.prototype.hasOwnProperty.call(ENGLISH_ALIASES, key) ? ENGLISH_ALIASES[key] : undefined;
  if (!term || !routeVocabulary(route).has(term)) return undefined;
  return { landmarks: [term], signage: [], confidence: "medium", source: "text" };
}
