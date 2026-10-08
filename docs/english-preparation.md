# English version status — 2026-10-08

The English phase is now implemented, independently reviewed and deployed as a limited preview. See [the runtime/deployment receipt](deployment/2026-10-08-english-preview/README.md), [fixed-copy review](english-copy-review.md) and [independent implementation review](acceptance/2026-10-08-english/independent-review.md). Runtime source pair: backend34bc9be / frontendcdb9da5. The original Chinese tags/audio remain fixed. English voice style is normal conversational pace at Crystal's request; 6 clips have individual listening acceptance and all44 have content/hash evidence.

Next: preserve the English source/evidence on GitHub, record this fixed deployed version as an English demo under3 minutes, and prepare the English deck/PDF. Final media/publication/submission remain Crystal's gate. Full outdoor software acceptance is separate and still incomplete.

The plan below is retained as the phase's original acceptance checklist, not a statement that the English UI is still absent.

---

# English version preparation — next phase

Status: planning only. The Chinese voice and route baseline is preserved at `zh-tw-preview-2026-10-08` in both repositories. The current hosted preview still speaks and displays Chinese. Crystal has now reported that iPhone LINE no longer shows the photo decoding error and reaches the landmark follow-up; matching backend records accepted three photos. Full route field acceptance remains incomplete. She chose to freeze this photo/text baseline, add reviewed voice input first, then prepare English. See `docs/voice-input-next.md`.

## Purpose and first deliverable

Enable the teammate in India and English-speaking reviewers to understand and operate the same verified Taipei route. This does not create a verified route in another country or hospital.

First prepare a reviewed copy inventory, a stable identity mapping and the language-switch design. Do not overwrite approved Chinese copy or recordings while doing this. A first English text prototype can be reviewed before generating a full English voice set.

## Surfaces that need coverage

- Start page, route origin/destination, concise step labels, full wording, and the two different walker confirmations (exit reached versus crossing completed).
- Observation entry, photo reminder/consent wording, waiting states, unreadable image, rate limit, offline errors, and unknown-location re-anchor.
- The new cp2 YouBike follow-up, explicit crossing-history confirmation/cancel, expired confirmation state, and any voice-input controls/errors added in the next phase.
- Clarifying questions, recovery text, entrance confirmation, arrival and the service-desk handoff.
- “Help me ask” card, its own controls, speech language, focus return, and screen-reader labels. This currently reuses the indoor AskCard with Chinese defaults; do not assume translating outdoor buttons covers it.
- Voice choice, mute, replay and optional bike/water reminders.
- English text input and deterministic fallback: test what happens when Gemini is unavailable. The current fallback matches registered Chinese route strings; it is not automatically a bilingual parser.

Frontend entry points: `src/remote/strings.ts`, `stepCard.ts`, `RemoteGuidanceText.tsx`, `remoteGuidance.ts`, `Last300mPage.tsx`, `outdoorVoice.ts`, and the reused `src/ui/AskCard.tsx` / speech helpers. Backend route facts remain in `fixtures/route-renai-001.json`.

## Identity and route-truth rules

- Language changes presentation, not route progression, source provenance, location vetoes, photo holds, or arrival authority. Compare identical inputs in both languages and require identical engine actions.
- Keep Chinese sign wording visible where the person needs to recognize the real sign; provide reviewed English explanation alongside it. Verify official proper names before using them in public copy.
- Never translate the canonical evidence vocabulary in place or let an LLM write a new route. English aliases, if needed for input, require an explicit reviewed mapping and negative tests.
- Known design decision: `RECOVER:cp5` represents three distinct recoveries. Route/action/checkpoint alone cannot select a unique English recovery message or recording. Introduce a stable route-authored recovery identity if approved for this phase; do not infer it by matching server prose or translating arbitrary runtime text.
- Preserve silence when the key or recording is missing. Preserve queue cancellation and walker-only crossing completion.
- Route-independent data such as raw photos, exact coordinates and retained information must keep the existing privacy boundary.

## Voice preparation

Use a separate English manifest and audio directory while retaining every Chinese path and SHA-256. Keep the same fixed-script discipline: draft and review the English wording, then audition one or two representative lines with Leda/Puck before batch generation. The teammate can review English comprehension; Crystal retains acceptance of the product voice.

The Chinese work showed that an explicit accent instruction made those samples less natural; do not introduce a regional English accent just because of the teammate's nationality. Treat this as a reason to audition, not a universal claim about the model. The Chinese Puck photo-wait retake needed an explicit adult-male instruction; verify voice consistency in samples rather than assuming a voice ID guarantees every output.

All 44 Chinese recordings remain approved and untouched. No new English TTS calls have been made in this handoff/publication task.

## Validation before wider use

- English and Chinese produce identical route actions for matching observations and walker confirmations.
- Existing repeated-photo/unknown-zone regressions still hold; switching language cannot reset session safety state or question budgets.
- Every visible/actionable surface and error has an English counterpart; no unexpected Chinese-only fallback in the English presentation.
- Verify narrow/mobile layouts, long road names, keyboard focus, screen readers and the ask card.
- English voice files match the reviewed text; both voice profiles share it; wrong/missing audio stays silent.
- Separate teammate remote walkthrough evidence from Crystal's actual Taipei field evidence.

## Submission materials and dates

The official requirements checked on 2026-10-08 require submission materials, including code, documentation and presentations, in English. The FAQ asks for a deployed working link, public GitHub repository, a demo under three minutes, and a deck. The English product interface is a practical recommendation for teammate/judge operation; do not misquote the materials-language clause as explicitly banning a Chinese user experience.

Prepare an English README entry, architecture/evidence summary, honest limitations, deck PDF and English narration/subtitles. Explain the native Chinese field experience and its source evidence; do not imply the UI is English before it is implemented, or that the complete field route passed before receiving Crystal's report.

The official timeline lists team formation by **October 11** and submission by **October 18, 2026**. Confirm exact cutoff time/timezone in the registration dashboard. Team-invitation completion was not checked in this session.

Sources: [requirements and language](https://aibuildercup.com/themes.html), [submission FAQ](https://aibuildercup.com/Faqs.html), [timeline](https://aibuildercup.com/). Recheck before submission because program pages can change.
