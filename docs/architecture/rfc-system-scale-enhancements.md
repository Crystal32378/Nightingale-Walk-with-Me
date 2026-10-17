# RFC: Reviewed route data, volunteer evidence and cached assistance

**Status: future proposal; not implemented or an outdoor acceptance claim.**

Original architectural contribution: **Anish Chandak (@anishchandak7)**, October 2026, [PR #1](https://github.com/Crystal32378/Nightingale-Walk-with-Me/pull/1). This corrected RFC retains the useful route-authoring and cached-assistance ideas while narrowing unsupported claims. It concerns the outdoor Google Cloud project only.

## Existing baseline

The limited preview uses route fixtures with reviewed vocabulary, text/photo observations and deterministic route decisions. `src/gemini.ts` validates model OUTPUT against the observation schema before it reaches the engine; request validation is a separate boundary. `src/validator.ts` is a pure function accepting route, checkpoint and observation: no database calls, model calls or clock. Firestore already stores sessions; dynamic route storage is the proposed addition.

Playback uses fixed accepted Leda/Puck recordings selected by route/checkpoint/action, not newly generated speech from arbitrary server prose. Voice capture is press-to-record, followed by transcription into an editable draft. Only explicit Send submits text as an observation; transcription does not advance a route. See the [implemented architecture and evidence limits](README.md).

Family preparation and volunteer route development are already a [roadmap](../../README.md#next-steps-families-and-hospital-volunteers), not new implemented interfaces. This RFC suggests evidence organization and reviewed dynamic data within that roadmap. The current limited preview is not full outdoor acceptance; production release remains HOLD.

## Proposed additions and release requirements

1. **Volunteer evidence organization.** With informed consent, volunteers could submit selected route evidence for AI-assisted indexing and draft checkpoint descriptions. This does not assume continuous patient recording. AI drafts remain unpublished candidates. A named local reviewer must personally field-verify step-free access, signage, entrances, crossings and ambiguity/recovery rules, record the date and responsibility, and approve each version. A local maintainer must recheck changes and withdraw stale or unsafe routes. A one-click approval is not evidence of field verification.
2. **Reviewed dynamic route data.** A separate loader could read a versioned, approved Firestore route snapshot and validate its schema/provenance before session use. Pin a reviewed version per session; do not hot-swap it mid-walk. Keep the deterministic validator pure and retain model output validation in `src/gemini.ts`. Missing, expired, revoked or invalid route data must prevent new guidance/advancement and offer reviewed help. Design migration and revocation behavior before release; existing fixture behavior is unchanged by this documentation.
3. **Cached assistance only.** A future PWA cache could hold approved fixed audio, reviewed route instructions and help cards, with version/expiry checks and a visible offline state. Offline reading/playback is not proof of current position. There is no guarantee of live visual interpretation, checkpoint advancement or arrival advancement offline. Hold route state on lost connectivity; offer cached help and reconnect/reanchor before resuming validated navigation. Do not turn a cached route graph into an autonomous offline navigation engine.
4. **Optional individual-image screening study.** Model Armor supports configured individual image screening/redaction; it does not support audio/video streams. It cannot be represented as a continuous media firewall or a guarantee that every face, license plate or injected sign will be removed. Evaluate supported formats, configured detectors, regional limits and false positives/negatives before any integration. Retain model output schema validation regardless of screening. If a future required screening step fails, times out or returns an unusable result, block that media from onward model processing; preserve state and offer text/help. Never silently bypass screening.
5. **Sensor research only.** GPS/BLE may supply a conservative veto or supporting proximity evidence after field testing. BLE must never be the sole arrival proof. Reviewed route evidence, deterministic validation and explicit crossing confirmations remain authoritative. Continuous Live streaming, AR, haptics, ADK/Agent Engine and analytics are speculative research options, not committed dependencies, deployed services or submission features. Do not remove existing limits to accommodate them.

## Privacy requirements before any media pilot

These are design and release requirements, not implemented compliance assurances. Specify informed, revocable consent for each capture purpose, a visible capture indicator and stop/cancel controls; minimize capture and avoid patients/bystanders and unnecessary raw media. No background or continuous patient recording is assumed. Prefer selected volunteer evidence over whole walks.

Before collecting media, document where raw audio/images/video may exist (device memory/cache, transport, model provider and any evidence store), authorized access, encryption, provider retention, a concrete retention/deletion schedule and consent withdrawal handling. Do not write raw media/transcripts to ordinary logs or session documents or reuse them for training/analytics by default. Any separate evidence storage needs explicit purpose, authorization and bounded retention. Redaction does not establish anonymity or permission. If consent, retention policy, screening or reviewed-route availability is unresolved, do not start the pilot or advance a route. Keep cached assistance available without claiming fresh interpretation.

## Hypothetical expansion and evaluation

AIIMS Delhi, NIMHANS Bengaluru and Siriraj Bangkok are hypothetical examples only: no deployment, partnership, validated route, language coverage or institutional endorsement is claimed. Every new location requires actual local field verification and a responsible reviewer. Translation drafts and help cards also need local review.

A possible sequence is: define consent/retention and route-review ownership; prototype versioned route loading while preserving the pure validator; evaluate volunteer evidence drafts; test bounded cached assistance; separately assess individual-image screening and sensors. Before release, exercise stale/revoked routes, invalid model output, missing connectivity, screening failures, ambiguous landmarks, crossings and BLE false positives. This PR adds documentation only and does not satisfy these gates.

## Corrected diagram and sources

[HTML overview](nightingale-rfc-flow.html) · [diagram data](nightingale-rfc-flow.json) · [Mermaid](rfc-system-scale-enhancements.mmd) · [light PNG](nightingale-rfc-flow.png) · [dark PNG](nightingale-rfc-flow.dark.png).

Google references checked 2026-10-17: [Model Armor limitations](https://docs.cloud.google.com/model-armor/overview#limitations) and [configured image redaction](https://docs.cloud.google.com/model-armor/sanitize-prompts-responses#redact-images). These service capabilities do not mean this project has integrated them.
