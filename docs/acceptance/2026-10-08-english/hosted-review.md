# English paired preview — independent hosted evidence review

**PASS_LIMITED_ENGLISH_HOSTED_EVIDENCE_REVIEW.** The deployed source/image, frontend/API pairing and production isolation match the accepted English version. No deployment blocker was identified in this evidence review. English phone/LINE operation is **NOT VERIFIED**; complete outdoor navigation and production promotion remain **HOLD**.

Reviewer: `voice_independent_review`, 2026-10-08; independent live GET checks at approximately **13:34 Asia/Taipei**, plus read-only Cloud Run, Cloud Build, storage-source and Firebase Hosting queries. No sessions, observations, recordings, model calls, deployments or traffic changes were made by this reviewer.

## Version and runtime provenance

| Item | Independently checked result |
|---|---|
| Source pair | Backend `34bc9be7c27e996eb789ba9c1f0f2240b608d1b8`; frontend `cdb9da550b0b7b039380ca52505a1bd193e26b52`, matching prebuild and frontend-build receipts. |
| Cloud Build | `92947d1c-4151-47e1-8a34-55e393fd394f`, live **SUCCESS**, Dockerfile build. |
| Source ZIP | Read generation `1791436891177165`; SHA-256 **`272dfe967a37f5fd00632a60f5d5312bc38d9a4f555649b6214ee7e570cbc2c9`** equals Cloud Build provenance. **24 / 24 source files** equal the backend `34bc9be` Git blobs, including `englishInput.ts`; no unreviewed source difference. |
| Runtime image | **`sha256:461f5f6df44ab15c0b80972afeeb716194b10c55fac66cf0db43efb14d4ec5bd`**, identical in build results, deployment receipt and fresh live revision. |
| Revision | `nightingale-english20261008`; fresh live Ready / ContainerHealthy / ContainerReady are True. `reviewed-sha=34bc9be` is current, and the source ZIP comparison independently verifies that label. |
| Runtime bounds | maxScale 1, 1 CPU, 512 MiB, existing service account and GCP project. |

Source object: `gs://run-sources-nightingale-walk-with-me-asia-east1/services/nightingale/1791436891.039524-b2ce7fedd04343048e338af3f80d270f.zip#1791436891177165`. Git TAR and uploaded ZIP are different formats; provenance is established by the ZIP hash and individual Git-blob comparisons, not by equating different archive hashes.

## Isolation, frontend assets and availability

Fresh live Cloud Run service data still assigns **100%** of ordinary service traffic to `nightingale-00010-ff2`. The new revision has only `english-20261008` tagged access and **0% ordinary service traffic**. Existing field-fix, photo-guard and Chinese voice-input tags remain.

Reviewer independently ran Firebase `hosting:channel:list` from the frontend checkout and compared the full release objects against hosting-before: **all five existing releases are unchanged** (`live`, `voice-input-20261008`, `photo-check-20261008`, `field-fix-20261008`, `photo-guard-20261008`). Production live version remains `cd96c56a42be2957`. The new English channel uses version **`56802b1c91776540`**, without an API rewrite.

Independent network reads:

- [English tagged API health](https://english-20261008---nightingale-uwker3cn5a-de.a.run.app/api/health): **200**, `{"ok":true}`.
- [English preview](https://nightingale-walk-with-me--english-20261008-q4gion1y.web.app/?flow=last300m&photo=1&lang=en): **200**; index hash `782d9311cf7657b1745750a8ea1a8d95e5fbef47e3da5cee4ef03f0694485b53` matches the build/hosted receipts.
- Live `assets/index-DmnkzV_u.js`: **200**, 250620 bytes; hash `7a99eee780149047ce2f07f51b2b226a2b9820a973be8c00f6b06166837eac39` matches, and the bundle contains the correct English tagged API URL.
- Build and hosted asset hash tables match **133 / 133**. Reviewer additionally compared all **88 outdoor WAV receipt hashes** with frontend `cdb9da5` Git bytes: 44 Chinese + 44 English match. The full 133-file network download check is the implementing agent's receipt; the reviewer independently reread index/JS rather than repeating all downloads.

The live Hosting expiry is **2026-11-07 13:27:43 Asia/Taipei**. This remains an expiring preview; it is not a guarantee of availability throughout an unverified judging period. Confirm the submission link's required lifetime before final submission.

## Existing hosted behavior evidence reviewed

The reviewer read the receipts and their procedures, without rerunning paid calls:

- `hosted-flow.json`: **17 real English UI/API turns**, using scripted remote descriptions through the tagged API / Vertex / Firestore. It checks generic YouBike follow-up, negative English hold, crossing-history cancel, question-mark hold at cp3, walker-only crossing completion, all three identified recoveries, entrance ASK and arrival. Language changes during the pending question generate no API requests. No page errors were recorded. This is a scripted remote walkthrough, not a physical walk.
- `hosted-guards.json`: **14 structured synthetic observation turns** over real HTTP/Firestore. It preserves crossing/recovery location holds and entrance/arrival behavior; it does not test fresh photo recognition or actual GPS/location.
- Corrected `hosted-voice.json`: Chromium WebM and desktop WebKit MP4 each return **200** from real hosted transcription. The procedure replaces microphone input with the accepted synthetic Leda reanchor clip, does not intercept API responses, compares session/action before explicit send, verifies audioCount=1 and no unconfirmed text persisted in the record, then edits the draft and sends exactly once. All API requests target the English tag and tracks are released.

## First voice discrepancy remains part of the evidence

`hosted-voice-attempt1.json` records HTTP **200** with **“What can you see nearby Just type”**, rather than the expected **“What can you see nearby? Just tell me.”** The strict sample-text assertion failed. The initial harness began its synthetic source before recorder initialization, and did not retain the failed line's browser variant. This limits attribution: the record does **not** prove whether capture timing, recognition variability, or both caused the differing words.

The corrected harness introduces a **350 ms lead-in** for synthetic speech and waits for the source plus additional recording time. It retains each response before assertions. `hosted-voice-attempt2.json` preserves:

- Chromium: `What can you see nearby? Just tell me.`
- WebKit: `What can you see nearby Just tell me`

Those two responses support the corrected harness's successful run; they do not erase attempt 1, prove perfect ASR, or establish that 350 ms universally guarantees recorder readiness on every device. The application still presents an editable unconfirmed draft and requires explicit Send. No production transcription logic was changed to force the expected phrase.

## Acceptance boundaries and handoff

- The existing user-reported iPhone LINE input PASS is **Chinese**, from the earlier voice-input phase. It is not English phone/LINE evidence.
- Crystal accepted English script/normal-speed style and **six individually heard clips**: four audition clips plus two Puck place-name spot checks. The other 38 English clips have machine/content/hash evidence, not claimed individual human listening acceptance. The two original ASR place-name differences remain in `audio-content-check.json`.
- The approved English source pair and this hosted link can be used for the next fixed-version demo/deck preparation, with remote/scripted/synthetic footage identified accurately. Final media, final submission and production navigation remain Crystal's gates.
- Before GitHub preservation, update the deployment README from its preparation wording and old `47ef838` frontend reference to the deployed `cdb9da5` pair. This is documentation bookkeeping, not a reason to redeploy runtime.

Evidence directory: `docs/deployment/2026-10-08-english-preview/` (`prebuild`, revision/deployment, traffic/Hosting before-after, frontend-build, hosted-assets, hosted-flow, hosted-guards, hosted-voice and both voice attempts, plus procedures). Code/assets/local playback acceptance is documented separately in [independent-review.md](independent-review.md).
