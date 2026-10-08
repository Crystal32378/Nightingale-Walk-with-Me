# Chinese voice input — limited preview preparation

Status: **PASS limited hosted preview; PASS user-reported iPhone LINE voice flow. Full outdoor navigation and production promotion remain HOLD.**

[Open the Chinese voice preview](https://nightingale-walk-with-me--voice-input-20261008-oajxumay.web.app/?flow=last300m&photo=1) — expires **2026-10-15 12:17 Asia/Taipei** (`2026-10-15T04:17:32.654066485Z`).

Crystal authorized this paired limited preview in `docs/voice-input-next.md`. [Independent code review](../../acceptance/2026-10-08-voice-input/independent-review.md) passed after correction of the stalled-upload blocker. [Hosted evidence review](../../acceptance/2026-10-08-voice-input/hosted-review.md) independently checks provenance and deployment boundaries.

## Deployed sources and isolation

- Backend runtime: `03bc45e7ce39b39ff2efda829a120f098f9acd6f`; frontend runtime: `5d11a5006d0234443dd730503ab8e40d7a00eddb`.
- Backend revision: `nightingale-voiceinput20261008`; tag / Hosting channel: `voice-input-20261008`.
- API: `https://voice-input-20261008---nightingale-uwker3cn5a-de.a.run.app`.
- Cloud Build `7f641538-b14a-48e6-a215-6c0e8b23a939` succeeded using Dockerfile. Ready image digest: `sha256:030934220f23bb53da1089383a5f1085ea3270678d7e64c2744bdb7f17124f06`.
- Clean Git archives: backend 23 files, frontend 245 source files; no raw field media, credentials or unrelated untracked work. Frontend build contains 89 served files, with an explicit tagged API and no `/api` rewrite.
- Revision min 0 / max 1 and 0% production traffic. Original `nightingale-00010-ff2` retains 100%. Existing Hosting live release and the three prior preview releases are unchanged.
- `reviewed-sha` is an inherited stale service-template label. It is **not** evidence of this release's source. The Git archive, Cloud Build source/provenance, image digest and ready revision establish the runtime linkage; the independent hosted review checks them.
- Later evidence/docs commits do not change these deployed runtime commits. The old `zh-tw-preview-2026-10-08` tags remain fixed.

## Evidence

- Backend 161 tests + typecheck; frontend 337 tests + typecheck/build. Independent reviewer reproduced the fixed upload timeout with actual elapsed time, cancellation, oversized streamed input and delayed database work.
- All 89 hosted files match the clean frontend build. All 44 Chinese WAVs match their accepted manifest hashes. Preview `/api/health` is 404, confirming there is no old production rewrite. See `hosted-assets.json`.
- Desktop Chromium 154.0.8037.98 and WebKit 26.5 used actual MediaRecorder with an accepted synthetic Leda sample replacing the microphone. Native WebM and MP4 reached the deployed decoder and real Vertex/Firestore, both returned 200 and an editable transcript. Session state/action stayed unchanged before Send; editing then double-clicking Send produced one observation; tracks were released. See `hosted-voice.json` and screenshots. This is synthetic microphone evidence, not an agent's physical iPhone test.
- Fourteen structured HTTP observations against real Firestore preserve photo/location holds, both walker-confirmed crossings, recovery, entrance ASK and arrival. No new photo interpretation model calls were needed. See `hosted-guards.json`.
- Crystal's iPhone LINE report: **「錄音、改字、傳送都成功」**. [Receipt](../../acceptance/2026-10-08-voice-input/iphone-receipt.json). This accepts the requested short voice-input flow. It does not establish every permission/error case or full outdoor navigation.

## Rebuild and operating notes

Run `procedures/prepare.py` from the repository. The script defaults to the two recorded runtime commits and accepts explicit `--backend-commit` / `--frontend-commit` overrides; it does not silently rebuild a later HEAD. Build with `VITE_LAST300M_API=https://voice-input-20261008---nightingale-uwker3cn5a-de.a.run.app npm run build`; use `firebase.preview.json`. Do not use `build:hosting`.

The first deployment command stopped before building because the old service carried a buildpack base-image setting. The corrected source deploy used `--clear-base-image` with the reviewed Dockerfile and retained `--no-traffic --min-instances=0 --max-instances=1`. The container includes FFmpeg and runs as non-root. No new cloud API/key was enabled. A subsequent Hosting read was rerun from the frontend directory after the backend cwd lacked firebase.json; this did not modify a release.

## Withdrawal / expiry

If pairing is wrong or a route advances before confirmation, stop using the new preview; remove only this new channel/tag after reading current traffic. No `--to-latest`, no changes to original production traffic. Hosting expiry does not delete the Cloud Run tag. Existing `field-fix-20261008` is also used by photo-check and must remain.

```bash
gcloud run services describe nightingale --project=nightingale-walk-with-me --region=asia-east1 --format='json(status.traffic)'
npx firebase-tools@15.31.0 hosting:channel:delete voice-input-20261008 --site nightingale-walk-with-me --project nightingale-walk-with-me --force
gcloud run services update-traffic nightingale --project=nightingale-walk-with-me --region=asia-east1 --remove-tags=voice-input-20261008
```

Sources checked 2026-10-08: [Cloud Run tagged/no-traffic deployment](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration), [source deployment and Dockerfile](https://docs.cloud.google.com/run/docs/deploying-source-code), [Firebase preview channels](https://firebase.google.com/docs/hosting/test-preview-deploy).
