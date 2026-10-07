# Nightingale

**Public transit gets you near the hospital. Nightingale gets you to the right door.**

A fresh build for **AI Builder Cup 2026** (Hack2Skill × Google Cloud). It guides one journey: transit exit → verified hospital entrance — the last 300 meters where maps say "arrived" but the person is standing between three buildings, two entrances, and a parking ramp.

## Architecture principle

> **AI interprets. Verified data decides.**

- **Route truth** is a human-authored, field-verified checkpoint graph (`fixtures/*.json`). No LLM ever writes it.
- **Gemini** (Vertex AI) translates in both directions only: messy human observations (text or photo) → typed evidence, and engine decisions → calm natural language.
- **Validator** (`src/validator.ts`) is a pure function comparing evidence against route truth. Fail-closed: landmarks not registered in the route never count as evidence.
- **Engine** (`src/engine.ts`) is a deterministic state machine: `AT_CHECKPOINT → AMBIGUOUS → RECOVERING → ARRIVED`. It owns the question budget (one clarifying question, then re-anchor), recovery pointers, and arrival — which requires specific entrance evidence, never GPS proximity.
- LLM output is untrusted structured input: schema-validated (`zod`), with deterministic fallback. A failed Gemini call can never invent a route.

## Status

Live: **https://nightingale-walk-with-me.web.app/?flow=last300m**

- Frontend on Firebase Hosting; `/api/**` rewrites to Cloud Run (`nightingale`, asia-east1) — one origin for page and API.
- Gemini 2.5 Flash on Vertex AI maps free-text observations onto the route vocabulary; every failure mode falls back to deterministic matching.
- 84 tests (engine, validator, Gemini text and photo fallbacks, photo gates and scoring, Firestore session store, HTTP API, and end-to-end walks of the real route), plus 5 Python review-import checks.

```
npm install
npm test
npm run typecheck
```

## The route

**MRT Zhongxiao Fuxing Exit 2, ground level (step-free passage) → Taipei City Hospital Renai Branch lobby entrance (step-free).**
Walked twice by the route author (2026-09-26 and 2026-09-28); every landmark string is copied from real signage. The second walk corrected the first: Fuxing S. Rd has a shared bike-and-pedestrian path, not a wheelchair lane, and the corner stores are FamilyMart. The route is step-free end to end: exit 2 is the only exit with both an elevator and a ramp, both crossings have signals and ramps at each end, and rehab buses and accessible taxis stop at the lobby door. Signal timings were observed once and are kept as unstable field notes — never spoken, never shown. Field notes: `docs/route-renai-field-notes.md`. Verified in daylight and dusk only — night-time sign visibility is not yet verified.

**Location only vetoes.** The phone turns its position into a coarse route zone on the device; raw coordinates are never sent. A zone can stop a checkpoint the walker cannot have reached yet from being confirmed; it never confirms anything by itself. Arrival still needs the lobby's own evidence (the rehab-bus sign, the taxi-rank sign, the vertical yellow plaque), because the hospital's name is printed on signs all the way from Fuxing S. Rd to the Daan Rd corner.

## Voice: Gemini TTS

Route guidance uses pre-recorded **Gemini TTS** (`gemini-2.5-flash-tts`) in two voices — Leda (female) and Puck (male). On 2026-10-07, the 11 revised lines were generated for both voices, including `cp2.along`. The local frontend now selects fixed recordings by route, checkpoint, and action, supports voice switching and mute, and plays `cp2.after` followed by `cp2.along` only after the walker presses「過完了」. Crystal has accepted all 22 revised recordings, including a final single-line Puck `photo.wait` retake with an explicit adult-male voice instruction. This continuation has not been deployed; phone field acceptance remains separate.

The current style instruction is *speak Mandarin gently and unhurried, like a grandchild walking an elder*. In the 2026-10-07 comparison, Crystal approved the Leda/Puck samples after removing the explicit Taiwanese-accent instruction: the Mandarin sounded natural while the pace and warmth remained suitable. The model, voices, wording and other generation settings were held constant. This records a listening decision for these samples, not a general claim about accent prompting.

Only human-written, verified lines are recorded (`docs/tts-outdoor-script.md`, 22 lines, all passing the product's register lint). Live server text and anything the user says are never sent to speech generation. Missing recordings stay silent. The three recoveries currently share `RECOVER:cp5`, so they remain text-only until the protocol can identify each recovery without matching server prose.

For local generation, `scripts/record-outdoor.py` previews the marked「新錄」rows by default; `--record` calls the existing Vertex AI project and preserves a hash and generation record for each file. Existing matching files are reused. On this Mac, run with `SSL_CERT_FILE=/etc/ssl/cert.pem` so Python uses the system CA bundle. No quota, billing, or service configuration changes are needed by the script.

`python3 scripts/make-trip2-review.py` builds the private second-trip review sheet at `field trip photos/第二趟/標註核對.html`. It loads the existing 57 image drafts, keeps all rows unreviewed until the human marks them, stores changes in the local browser, and exports a separate JSON. It never updates the evaluation labels, route truth, or original media.

The completed 57-row human review was imported in the 2026-10-08 acceptance preparation. Human wording, the prior labels, and the scoring projection are preserved in `eval/reviews/trip2-2026-10-07/` (the folder date is the human export date). The replay report is `docs/photo-review-2026-10-08.md`. Saved readings still produce early checkpoint confirmations; zero first-step false arrivals is not a deployment approval.

## Adding a new hospital

A route is a slice of a real walk, not a map inference, so a new location is added by walking it:

1. Someone local walks the route once — the transit exit to the entrance — photographing each sign they would use to find their way, plus the sights that mean "walked too far".
2. The signage text becomes the route vocabulary; the walker's own way of giving directions becomes the instructions.
3. The spoken lines are written, checked, and recorded — in a voice the hospital chooses for its community.

Our one field run took **30 to 60 minutes per route**, covering:

- walking from a transit stop about 10 minutes from the hospital;
- walking the route twice (there and back), photographing 8 to 10 points to confirm landmarks and directions;
- putting the photos and notes into a folder for an agent to organise and analyse.

That is one route's experience, not a benchmark; writing and recording the spoken lines comes on top. A hospital can author its own entrances, and can swap in whatever voice best fits the people it serves.
