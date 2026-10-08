# English presentation design

Scope authorized by `docs/english-preparation.md` after the accepted Chinese voice-input milestone. Preserve Chinese defaults, route facts, session transitions and the 44 accepted WAV hashes.

## Language boundary

A visible language control and `?lang=en` select English for the last-300m page only. Switching stops playback/recording and changes presentation without creating a session, submitting an observation, clearing a pending confirmation or resetting question counts. The current language is read at async result time. The entire page, voice input/status/error text, origin/destination, both walker controls, photo disclosure, full step wording, help card, volume accessibility labels and speech language are localized. Chinese sign strings remain alongside explanatory English.

Known route-authored question/recovery keys are additive metadata, not directions inferred from runtime prose. Add `messageKey` to ambiguity/conflict authoring and emitted ASK/RECOVER actions. Known keys map to reviewed English content. Unknown or missing identities stay generic and silent; no Chinese-only server prose fallback in English. Chinese keeps its current rendering and silent ambiguous recovery behavior.

English input uses a narrow allowlisted mapping into existing Chinese canonical terms. Match complete affirmative phrases; do not substring-match a generic street inside a more specific lane. Negation/uncertainty and a generic YouBike station yield no geographic evidence. The cp2 English YouBike and Renai/Fuxing intersection paths reuse the existing follow-up and explicit crossing-history confirmation. The fixture's facts/coordinates/instructions remain identical after removing additive message keys.

## Audio

English fixed script is separate from the Chinese manifest. Draft all 22 English lines, independently review the wording, then audition representative Leda/Puck samples for Crystal before batch generation. Recordings and hashes use `public/audio/outdoor/renai-001-en/` and `outdoor-manifest.en.json`; no Chinese file is replaced. Missing English files stay quiet. Locale changes cancel the queue. Route identities select fixed English playback; no server/user text goes to TTS. Stable recovery IDs select English recovery recordings only; Chinese behavior is preserved.

## Acceptance and delivery

TDD covers English aliases and negative cases, message identity safety, complete English fallback and route equivalence, language switching without network/state mutation, help-card focus/language and silent missing audio. Use real browser checks for long labels/mobile layout and supported flows. An independent non-implementing reviewer checks implementation before paired limited deployment. Recheck production traffic and preserve old preview/tag baselines. Hosted evidence and phone/teammate evidence remain separate. Update the same architecture/README and preserve both GitHub repositories again. Only then record an English demo under three minutes and prepare English deck/PDF; final media/submission remain Crystal's gate.
