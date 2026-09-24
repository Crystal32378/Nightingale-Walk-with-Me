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

Route engine + validator + full-verdict test suite (21 tests: progression, fail-closed evidence, ambiguity budget, conflict/recovery, true arrival, malformed LLM output, route integrity).

```
npm install
npm test
npm run typecheck
```

## Planned stack

Firebase Hosting (mobile web, one state · one instruction · one decision) → Cloud Run (session + engine) → Vertex AI Gemini 2.5 Flash. Demo route: MRT Zhongxiao Dunhua → Taipei City Hospital Renai Branch outpatient entrance (field-verified).
