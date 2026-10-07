# Reviewed phone-test preview — 2026-10-08

Independent approval is archived at `docs/acceptance/2026-10-08-narrow/fu-review.md`: narrow fix PASS, the specified temporary preview PASS, full/live release HOLD.

Preview: https://nightingale-walk-with-me--photo-guard-20261008-lb1kvmut.web.app/?flow=last300m&photo=1

Expires: **2026-10-15 01:09 Asia/Taipei** (`2026-10-14T17:09:36.107491900Z`).

Backend code: `65de4d86a59f9aaade7d8b44f4342a36f5678efe`, revision `nightingale-guard20261008`. Frontend code: `f4016ba8b0b009aa209cbbcfc72b5487823da913`. Both were built from clean, reviewed Git archives; the backend archive contains only its 16 runtime/package/fixture files. No field photographs, local env files, test server or evaluation inputs were uploaded as backend source.

The tagged backend has revision min instances 0, max 1, and no production traffic. `nightingale-00010-ff2` still has 100% production traffic. Existing IAM, billing settings, service identity and Firestore session schema were kept. Every smoke session was newly created; test operations used the existing real Google resources.

The frontend uses the exact tagged API URL, built through `VITE_LAST300M_API=<tag-url> npm run build`. It was deployed only to `photo-guard-20261008`, with `--expires 7d --no-authorized-domains` and the included preview-only config. The preview `/api/health` returns 404, confirming there is no rewrite to the old live API. The live Hosting channel was not deployed.

## Hosted checks

- Tagged health API: 200.
- Seven saved failing image/variant pairs, each submitted as a structured photo observation at its checkpoint with absent and unknown location: all remain REANCHOR at that checkpoint. These checks inject saved observations and do not claim fresh image recognition.
- Known compatible photo context still advances with matching evidence. Neither crossing can be completed by a photo; only the walker confirmation advances it. Text follow-up reaches the entrance ASK and then arrival.
- One real resized JPEG, `第二趟/jpg/IMG_5593.jpg`, was uploaded through the hosted photo endpoint. The current cloud interpreter returned photo-source signage including `大安路一段116巷`. With no location, the new backend returned `REANCHOR:cp2` and `photoHold: crossing-needs-location`, in about 7.3 seconds. The photo bytes are not included in this receipt.
- All 44 published WAV bodies match the reviewed SHA-256 values. Published JS contains the actual tag URL and neither the placeholder nor the default live API URL.
- Actual hosted frontend, Chrome 390×844, Puck selected: real text API observations, both walker-confirmed crossings, the after→along sequence, entrance question and arrival complete without page errors or horizontal overflow. All API requests went to the tagged backend. This is not iPhone or real-GPS acceptance.

Structured receipts are in this directory. The two `procedures/` files are the executed machine-local validation snapshots; their filesystem paths depend on this checkout and private photo custody, and they are not application entrypoints. UI screenshots contain no uploaded field photos. No audio content changed during the fix or deployment.

## Next human checks

On Crystal's iPhone, first check loading, permission handling, choosing the voice, audio playback and camera/photo input while stationary. Then perform the supervised walk along the already verified route. Observe especially whether actual position accuracy leaves the app in `unknown`; in that case a photo deliberately holds and the existing text input is the fallback. Do not interpret lack of automatic advancement as permission to cross.

Record actual GPS/permission behavior, camera format, mobile waiting, outdoor audibility, the two crossing confirmations and the entrance handoff. Do not claim a full/public release from the current smoke tests.

## Withdrawal and expiry

If a wrong API pairing or premature navigation instruction appears, stop the preview test, delete the Hosting preview channel and remove the Cloud Run tag; retain the existing live revision and traffic. The same cleanup is required when testing ends or the channel expires. **Hosting expiration does not remove the Cloud Run tag automatically.** No automatic cleanup task has been installed; the tag needs explicit removal at that point.

Use the existing authenticated tools for channel deletion and tag removal, after re-reading traffic to avoid changing another operator's work. Do not use `hosting:clone ...:live`, `--to-latest`, or a production traffic shift as cleanup. General/live promotion requires a separate accepted field result.
