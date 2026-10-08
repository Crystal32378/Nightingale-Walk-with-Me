# English limited preview — deployment receipt

**PASS limited hosted preview.** [Open in English](https://nightingale-walk-with-me--english-20261008-q4gion1y.web.app/?flow=last300m&photo=1&lang=en). The page can switch to Traditional Chinese without restarting the walk.

Expires **2026-11-07 13:27 Asia/Taipei** (`2026-11-07T05:27:43.895321215Z`). The [currently published competition timeline](https://aibuildercup.com/) lists evaluation through November 6; verify the link and exact submission cutoff again before the final submission. This is an expiring preview, not a production promotion.

## Source and isolation

- Backend runtime `34bc9be7c27e996eb789ba9c1f0f2240b608d1b8`; frontend runtime `cdb9da550b0b7b039380ca52505a1bd193e26b52`.
- Revision `nightingale-english20261008`; tag/channel `english-20261008`.
- API: `https://english-20261008---nightingale-uwker3cn5a-de.a.run.app`.
- Cloud Build `92947d1c-4151-47e1-8a34-55e393fd394f` succeeded. Image: `sha256:461f5f6df44ab15c0b80972afeeb716194b10c55fac66cf0db43efb14d4ec5bd`.
- New revision min 0/max 1, 0% ordinary production traffic. Original `nightingale-00010-ff2` still receives 100%. Original Hosting live release and four existing preview releases remain unchanged.
- Clean archive: 24 backend runtime files; frontend explicitly built with its paired tagged API. No API rewrite, raw field media, microphone recordings or credentials in the deployment archive.
- [Independent code/assets review](../../acceptance/2026-10-08-english/independent-review.md) and [independent hosted/provenance review](../../acceptance/2026-10-08-english/hosted-review.md) separate reviewed source, generated audio, local checks and hosted evidence. Later documentation commits do not change these runtime SHAs.

## Validation and limits

- 193 backend tests and 354 frontend tests, typechecks and clean build passed. The reviewer also exercised actual fixed WAV decoding/playback and queue cancellation in Chromium and desktop WebKit.
- All 133 hosted files match the build. All 44 Chinese and 44 English WAVs match their manifests. The Chinese baseline bytes and route facts remain unchanged; route JSON only adds stable presentation identities.
- English fixed script and normal conversational pace are accepted. Crystal individually heard 4 revised audition clips and 2 Puck place-name clips. The other 38 clips have generation/hash and machine text checks, not individual human listening acceptance. Machine cross-check: 36 normalized matches, 6 numeric spoken equivalents, 2 proper-name spellings resolved by Crystal. Original ASR outputs remain in [the receipt](../../acceptance/2026-10-08-english/audio-content-check.json).
- Seventeen actual English UI/API turns passed: generic YouBike follow-up, negation/question holds, pending confirmation with language switch/cancel, both crossings, three recovery identities, entrance question and arrival. These are **scripted remote descriptions**, not observations from a current outdoor walk. See `hosted-flow.json`.
- Fourteen structured-observation requests preserve prior photo/location and route guards. No new field-photo model evaluation was performed in this phase. See `hosted-guards.json`.
- Actual desktop WebM/MP4 capture of an accepted synthetic English sample reached the deployed decoder, Vertex and Firestore. Returned text stayed editable; session/action did not change before explicit Send; edited text sent once and microphone tracks ended. See `hosted-voice.json`.
- The first synthetic voice check returned `What can you see nearby Just type`, rather than the expected ending. The harness originally started its synthetic source before MediaRecorder initialization. After adding a lead-in, both browser variants returned the intended words. **This does not prove the first discrepancy's sole cause or guarantee transcription accuracy.** Both attempt receipts remain; production behavior was not relaxed to pass the check.
- The Chinese preview's iPhone LINE record/edit/send test passed by Crystal's report. English phone/teammate remote acceptance is not claimed here. Full outdoor software acceptance and production navigation remain HOLD.

## Rebuild / expiry

`procedures/prepare.py` defaults to the recorded source pair. Build with `VITE_LAST300M_API=https://english-20261008---nightingale-uwker3cn5a-de.a.run.app npm run build` and deploy the preview-only config. Never use `build:hosting` for this pair.

Hosting supports [up to 30 days per preview deployment](https://firebase.google.com/docs/hosting/manage-hosting-resources#manage_a_channels_settings). Expiry does not remove the Cloud Run tag. No automatic cleanup is installed. If pairing, route authority or language isolation fails, stop using only this preview and read current traffic before withdrawal:

```bash
gcloud run services describe nightingale --project=nightingale-walk-with-me --region=asia-east1 --format='json(status.traffic)'
npx firebase-tools@15.31.0 hosting:channel:delete english-20261008 --site nightingale-walk-with-me --project nightingale-walk-with-me --force
gcloud run services update-traffic nightingale --project=nightingale-walk-with-me --region=asia-east1 --remove-tags=english-20261008
```

Original tags and preview resources remain available according to their own receipts. The final demo/deck and competition submission require Crystal's final acceptance.
