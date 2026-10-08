# Short Voice Input Implementation Plan

> **For agentic workers:** Execute inline with TDD; reserve a separate, non-implementing agent for independent review as explicitly requested in the handoff.

**Goal:** Add short, user-initiated speech transcription into the existing editable text flow.

**Architecture:** MediaRecorder -> bounded binary transcription endpoint -> validated unconfirmed text -> explicit existing observation submission. Deterministic navigation remains unchanged.

**Tech Stack:** React/TypeScript, Hono, FFmpeg pipe decoding, existing Google Gen AI SDK/Vertex, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-voice-input-design.md`

## Global Constraints

- 15-second browser recording; 2 MiB upload; backend decoded duration <=16 seconds.
- Existing routes/photos/44 Chinese WAVs preserved; no production promotion.
- No raw audio or unconfirmed transcript persistence/logging.
- No observation before explicit user send; no recording during walker confirmation.
- Both repos retain branches, authors, history and original baseline tag; no `git add -A`.

### 1. Backend isolated transcription

Files: create `src/audio.ts`, `src/transcription.ts`, `src/transcriptionRoutes.ts`, `test/audio.test.ts`, `test/transcription.test.ts`, `test/transcription-routes.test.ts`, `Dockerfile`; modify `src/server.ts`, `src/index.ts`, `src/store.ts` and store tests.

Interfaces: `decodeAudio(bytes, mimeType, signal): Promise<Buffer>` returns normalized WAV. `Transcriber.transcribe(wav, signal): Promise<string>` returns bounded text. `registerTranscriptions(app, deps)` installs the binary endpoint without calling the route engine.

- [x] Write failing tests using a generated mono PCM WAV and Hono requests: signature mismatch/empty/long audio, no route changes, pending confirmation retained, crossing denial, empty output/timeout/429 and limits.
- [x] Run `npm test -- test/audio.test.ts test/transcription.test.ts test/transcription-routes.test.ts`; observe missing behavior.
- [x] Implement bounded pipe decoding, Vertex-only transcription and session-scoped endpoint; preserve quota in store serialization.
- [x] Run backend tests/typecheck; use in-memory store and injected external model for deterministic checks.

### 2. Frontend capture and explicit confirmation

Files: create `src/remote/voiceCapture.ts`, `src/remote/voiceCapture.test.ts`, `src/remote/voiceInputClient.ts`, `src/remote/voiceInputClient.test.ts`, `src/remote/VoiceInput.tsx`; modify `Last300mPage.tsx`, `useLast300m.ts`, `last300m.css`.

Interfaces: `VoiceCapture.start/stop/cancel`, status callback with requesting/recording/processing/review/error; injectable getUserMedia/MediaRecorder/transcribe boundaries. Successful transcript is a callback into draft state, never observe. Hook exposes session ID only for scoped transcription.

- [x] Write lifecycle tests: denied permission, late stream after cancel, duplicate start/stop, stop timeout, 15-second cap, recorder failure, empty and oversize blobs, stale transcription after cancel.
- [x] Observe failures; implement lifecycle/transport and meaningful error mapping.
- [x] Integrate into existing form with synchronous playback suppression and cancellation before help/photo/replay/action changes.
- [x] Run frontend tests/typecheck/build. Browser checks assert editable transcript with zero observations, one explicit send, cancellation and background cleanup, hidden controls during both crossings, unchanged text/photo confirmations.

### 3. Independent review and paired preview

- [x] Freeze implementation commits and ask independent non-implementing agent to inspect both diffs/tests; store evidence limits and findings.
- [x] Fix blockers and rerun the affected tests/review.
- [x] Read current Cloud Run traffic, service configuration, Hosting release/channel state.
- [x] Build clean Git archives using an explicit tagged API; deploy tagged backend at zero production traffic/min0/max1 and a new expiring Hosting preview.
- [x] Verify deployed JS/audio hashes, model transcription of a permitted fixed synthetic sample, error gates, and full existing navigation. Keep desktop/hosted evidence separate from physical iPhone evidence.
- [x] Give Crystal one short iPhone LINE recording/edit/send/cancel check when the ready preview exists.

### 4. Architecture and GitHub

- [x] Diagram real endpoint/data flows as editable Mermaid source and rendered SVG/PNG; update README with boundaries and source/runtime commit mapping.
- [x] Read remotes, preserve existing histories and push reviewed work to both existing repos without force or moving baseline tags.
- [ ] Continue with `docs/english-preparation.md` after this stage; do not record final demo from a moving version.
