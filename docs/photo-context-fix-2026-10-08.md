# Narrow photo-context fix and re-acceptance request

This revision addresses the two P1 classes in `docs/acceptance/2026-10-08/fu-review.md`. The reviewed baseline is backend `83639dd` (runtime same as `2bdf76d`) and frontend `f4016ba`. No route, human labels, frontend implementation, or approved recording changes are part of this fix.

## Behavior change

Two guards are added in `src/engine.ts`, with diagnostic reasons in `VerdictResult.photoHold`:

1. A photo matching a checkpoint that leads into a walker-confirmed crossing cannot emit GUIDE when that checkpoint has zone rules and the phone's zone is absent or `unknown`. It returns REANCHOR at the same checkpoint. A known inconsistent zone remains vetoed as before; a compatible zone still needs actual matching landmark evidence.
2. A photo matching a zone-specific conflict cannot emit RECOVER without a known zone. It returns REANCHOR without consuming the entrance-question budget. Known inconsistent zones retain the existing veto; compatible recovery zones retain recovery behavior.

These rules do not identify filenames or hard-code the failed photos. Repeated photos cannot exhaust a question budget to bypass a hold. The fixture graph/vocabulary, engine arrival branch, text observations, and explicit walker confirmations are unchanged. In particular, existing text-only recovery remains possible without GPS. This is **not** a general proof that all free-text/model interpretations or all phone fixes are correct.

Usability tradeoff: without a usable zone, the person must add a textual observation at a crossing or recovery rather than progress automatically from a photo. The existing “跟我說你看到什麼” flow remains available. Historical no-location original/crop home-hit counts each fall from 3/8 to 2/8; synthetic-place home hits are unchanged. This limitation must be visible in field acceptance.

## Evidence

`eval/reviews/narrow-fix-2026-10-08/` stores the results. Human labels and the scorer are unchanged.

- Historical replay: all 495 observations, 99 images, five variants, both modes. The 7 reachable early confirmations and 3 false recoveries become **0 / 0**; reachable false arrivals remain **0** in this first-step evaluation. The recorded-vocabulary mismatch remains explicit.
- Current-model narrow probe: seven previously failing image/variant pairs, current `buildPhotoPrompt` and `createVertexClient`, `gemini-2.5-flash`, `nightingale-walk-with-me`, global. Eight interpreter calls across two preserved attempt logs: seven successful pairs and one 429. No quota or billing change. The SDK may manage lower-level transport retries; eight counts interpreter calls, not a measured HTTP attempt count.
- Fresh observations still include `急診` from an indoor directory and `瀚群骨科` from the wrong location. The new deterministic guards hold these; the fix does not depend on assuming the model became accurate.
- Scoring the seven successful current observations with the new engine yields no reachable early confirmations, false arrivals or false recoveries in the tested modes. This small selected sample is not a new 99-image model benchmark.
- Eleven new regression tests cover repeated saved failures, known/unknown zones, unchanged text follow-up, walker-only crossing completion, and retention of the entrance-question budget. Eight assertions failed before the implementation; all eleven now pass.
- All 95 backend tests and typecheck pass. The older six assertions that expected unsafe unlocated-photo behavior were updated to the new contract, retaining known-zone positive cases and scorer checks that still identify unsafe text outcomes.
- Browser sequence: unchanged real frontend → actual local Hono API → saved observations injected only at the photo-interpreter seam. Six problem uploads across cp2/cp3/cp5 remain at their checkpoints; neither crossing clip is requested prematurely. Text follow-up and both walker confirmations complete the route through an ASK and then arrival. This browser sequence does not call a cloud model or claim real GPS.
- All 44 WAV SHA-256 values remain identical to frontend `f4016ba`. Original photos are read locally for the authorized current-model probe, not added to Git.

Live attempt files contain only structured observations, timing and input hashes—no raw or encoded photographs. `live-seven.json` identifies the complete selected sample; `historical-after.json`, `current-seven-after.json`, `browser-sequence.json` and `audio-unchanged.json` preserve check results.

## Reproduce without cloud calls

```bash
npm test
npm run typecheck
npx tsx eval/photo-eval.ts --replay eval/reviews/trip2-2026-10-07/saved-readings.json --labels eval/reviews/trip2-2026-10-07/labels-after.route-terms.json --out eval/out/recheck-photo-guard
npx tsx eval/photo-eval.ts --replay eval/reviews/narrow-fix-2026-10-08/live-seven.json --labels eval/reviews/trip2-2026-10-07/labels-after.route-terms.json --out eval/out/recheck-current-seven
```

For the browser sequence, start a fresh `npx tsx eval/guard-browser-server.ts` at port 8788 and the existing frontend dev service at 5178 configured for 8787. Run `PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-photo-context-browser.cjs`; the harness redirects only its own 8787 requests to the replay server at 8788. The server deliberately returns two bad observations per checkpoint for one test run and never calls Gemini. Restart it before each run. The production entrypoint remains `src/index.ts`.

`eval/narrow-photo-probe.ts` is dry-run by default. `--live` explicitly performs the selected current-model calls; `--start-at` permits resuming a partial run without resending successful earlier pairs. Any additional live run must preserve its attempt log rather than overwrite a failed observation.

## Proposed deployment scope for independent review

The requested next step is a **temporary phone-test preview**, not promotion of the new version to the existing public site's live channel:

- Use a clean Git archive of the accepted backend commit to create a tagged Cloud Run revision of the existing `nightingale` service in asia-east1, with `--no-traffic`, minimum instances 0 and revision maximum 1. Keep the existing `nightingale-00010-ff2` serving the existing URL; verify traffic after creation. No IAM, billing, route configuration or Firestore schema change.
- Keep the current project/service account and Firestore session behavior. Test sessions use their normal new UUIDs; no existing session is reused. The revision tag is a separate HTTPS API URL, not an authentication boundary.
- Build the exact frontend `f4016ba` with `VITE_LAST300M_API` set to that tagged HTTPS API. Deploy only a Firebase Hosting preview channel with a 7-day expiry. Its preview-only configuration has no `/api` rewrite to the live backend, so a mistaken empty API base fails instead of silently testing the old service. Do not deploy the live Hosting channel or move production Cloud Run traffic.
- After a preview-deployment PASS, verify the actual hosted bundle/API pairing, WAV hashes, stored-observation regressions, both walker-confirmed crossings, unknown-location holds, and one narrowly selected real photo upload. A failed pairing or premature instruction stops the test and the preview is withdrawn.
- Give Crystal the preview URL for iPhone permission/camera/audio/network checks, then a supervised walk of the already human-verified route. Actual GPS, iPhone Safari behavior, outdoor audibility and complete physical-route acceptance remain to be measured on that phone; do not claim them from Chrome emulation.
- If the preview fails, delete its Hosting channel and remove the new Cloud Run revision tag while retaining the existing live traffic target. A later general/live rollout requires a separate accepted field result.

This proposal follows the documented [Cloud Run no-traffic revision tags](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration) and [Firebase preview channels](https://firebase.google.com/docs/hosting/test-preview-deploy). It is submitted to the independent reviewer as a concrete scope, not self-approved. Existing unrestricted/live deployment remains on HOLD unless separately released.
