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
- 47 tests (engine, validator, Gemini fallbacks, HTTP API, and an end-to-end walk of the real route).

```
npm install
npm test
npm run typecheck
```

## The route

**MRT Zhongxiao Fuxing Exit 2 (elevator) → Taipei City Hospital Renai Branch lobby entrance (step-free).**
Walked and photographed on 2026-09-26 by the route author; every landmark string is copied from real signage. The route *is* the accessible route: the only exit with both an elevator and a ramp, the side of the street that has a wheelchair lane, an 80-second crossing, and an entrance where rehab buses and accessible taxis stop at the door. Field notes: `docs/route-renai-field-notes.md`. Verified in daylight and dusk only — night-time sign visibility is not yet verified.

## Voice: Gemini TTS

Route guidance is spoken by **Gemini TTS** (`gemini-2.5-flash-tts`) in two voices the user can switch between: Leda (female) and Puck (male).

What made Gemini TTS the right fit is that accent and manner are steered in plain language. One style instruction — *speak Mandarin with a natural Taiwanese accent, gently and unhurried, like a grandchild walking an elder* — produced voices a native Taiwanese listener judged as warm and local. No voice training and no audio engineering were needed.

Only human-written, verified lines are recorded (`docs/tts-outdoor-script.md`, 16 lines, all passing the product's register lint). Live server text and anything the user says are never sent to speech generation.

## Adding a new hospital

A route is a slice of a real walk, not a map inference, so a new location is added by walking it:

1. Someone local walks the route once — the transit exit to the entrance — photographing each sign they would use to find their way, plus the sights that mean "walked too far".
2. The signage text becomes the route vocabulary; the walker's own way of giving directions becomes the instructions.
3. The spoken lines are written, checked, and recorded — in a voice the hospital chooses for its community.

Our one field run suggests roughly **30 to 60 minutes of walking and photographing per route** (estimate from a single route; authoring and recording time come on top). A hospital can author its own entrances, and can swap in whatever voice best fits the people it serves.
