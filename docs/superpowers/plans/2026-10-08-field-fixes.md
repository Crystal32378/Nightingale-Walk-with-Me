# Nightingale Field Fixes Implementation Plan

> For agentic workers: execute each bounded task with test-driven development. Use the available collaboration tools for the isolated photo task and independent review; do not deploy or push as part of implementation.

**Goal:** Fix the reproduced browser photo rejection and give the reported text inputs a safe continuation path.

**Architecture:** Keep the route engine, authored route and accepted recordings. Clean browser-generated JPEG metadata before the existing privacy check. Add a narrow server-authored text follow-up at Renai cp2, with an explicit walker confirmation before restoring later progress; photo observations cannot use that path.

**Tech Stack:** TypeScript, Vitest, React, Hono, desktop Chromium and Playwright WebKit.

**Spec:** `docs/field-report-2026-10-08.md`, `docs/route-renai-field-notes.md`, and Crystal's approval in the current conversation.

## Global Constraints

- Frontend: `/Users/crystalchang/Desktop/Opus Chamber/Nightingale`.
- Backend: `/Users/crystalchang/Desktop/Fable Suite/nightingale`.
- Preserve the 44 accepted WAV files, route geography, photo guards, and walker confirmation for road crossings.
- No speech input, LINE card builder, production deployment, traffic changes, or cloud model evaluations in this patch.
- Browser automation proves desktop browser behavior; iPhone X / iOS 16.7.16 / LINE 15.7.2 acceptance remains separate.
- Preserve unrelated files; add only explicit paths to Git if creating local commits. No push without the intended publication step.

## Task 1: Browser-generated JPEG metadata

**Files:** frontend `src/remote/photo.ts`, `src/remote/photo.test.ts`, and a reproducible browser check under frontend `scripts/`.

**Interface:** retain `preparePhoto(file: Blob): Promise<PreparedPhoto>` and `hasJpegMetadata(bytes: Uint8Array): boolean`; any new byte cleaner is called only after canvas encoding.

- [x] Add a real-browser regression: a generated 320×240 PNG passed to the unmodified `preparePhoto` must return a decodable JPEG without APP1 metadata in WebKit and Chromium. Observe the existing WebKit rejection.
- [x] Add byte-level cases for APP1 / APP13 / comment removal, preservation of image data and color profiles, and malformed/truncated JPEG rejection; use the actual WebKit APP1 receipt as a fixture.
- [x] Implement bounded marker parsing/removal after canvas encoding; keep a final metadata check and reject malformed output.
- [x] Run `npm test -- src/remote/photo.test.ts`, the real-browser check, typecheck and build. Verify decoded dimensions, image pixels and metadata removal.

## Task 2: Text follow-up and explicit progress recovery

**Files:** backend `src/textFollowUp.ts` (new), `src/types.ts`, `src/server.ts`, `src/store.ts`, `test/text-follow-up.test.ts`; frontend client, hook, outdoor page and protocol tests.

**Interfaces:** server-authored `ASK` may carry a typed confirmation object; a separate confirmation payload is required. Keep ordinary `confirm: "done"` unchanged. Store a bounded pending continuation with the session, clear it on another observation, and refuse absent, stale or mismatched confirmations.

- [x] Add failing API tests using the real Hono app and session store, with `KeywordInterpreter`: `youbike站` stays at cp2 and asks for existing street evidence; `仁愛復興路口` stays at cp2 and requests an explicit side/crossing confirmation.
- [x] Include cases preventing photo-triggered recovery, ordinary done bypass, forged/replayed confirmation, wrong-zone advancement, expired pending state, and stale pending state after new input.
- [x] Implement the narrow Renai adapter. YouBike alone never confirms a location. Later-stage text first creates a follow-up. Its confirmed continuation must preserve crossing and arrival rules, and the accepted transition uses an explicit three-part crossing-history confirmation before re-running cp3 evidence/location rules. No unverified landmark-side assertion is made.
- [x] Add frontend protocol tests for known and malformed confirmation payloads. Render separate confirm/cancel controls, keep unknown/new question audio silent, and cancel old audio on interaction.
- [x] Reproduce the user's sequence through the real local frontend/API with both browsers; confirm visible question changes, progress after explicit evidence/confirmation, no pending controls during a crossing, and no arrival shortcuts.

## Task 3: Review and custody

- [x] Run backend tests/typecheck, frontend tests/typecheck/build, the existing photo guard unit regressions, and the new full local browser replay.
- [x] Compare accepted audio hashes and route fixture against the frozen baseline.
- [x] Obtain a new independent review of the actual diff and safety tests; address actionable findings.
- [x] Update handoff and receipts to distinguish local fixed behavior, independent review, and pending iPhone LINE verification. Preserve the current deployed preview until the deployment stage is explicitly in scope.

Execution outcome: backend 130 tests and frontend 313 tests passed; full local Chromium/WebKit replay and independent review passed. Root completed the authorized implementation inline while specialist agents handled photo cleanup, transaction storage, frontend integration and independent review. No deployment or push occurred.
