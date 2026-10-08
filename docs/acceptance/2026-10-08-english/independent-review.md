# English implementation — final independent review

**PASS_CODE_REVIEW_FOR_LIMITED_ENGLISH_PREVIEW.** Final independent review completed on 2026-10-08. No open implementation blocker remains for the authorized paired limited preview. This is a code/assets/local-runtime gate, not hosted acceptance or production promotion. **Full outdoor navigation and production remain HOLD.**

Accepted frozen source pair:

- Backend `34bc9be7c27e996eb789ba9c1f0f2240b608d1b8`; runtime code equals `690f62b` for src/fixtures/Dockerfile/package inputs. Comparison baseline: Chinese `1d952f1`.
- Frontend **`cdb9da550b0b7b039380ca52505a1bd193e26b52`**. Full tests/build/playback were run on `47ef838b6b087e44834c249fc7ceb5a32a389488`; reviewer then inspected the complete `47ef838..cdb9da5` diff: only the two visible English voice labels changed from Leda/Puck to Female/Male in `locale.ts`. Option values, voice IDs, logic and audio are unchanged, so that narrow copy change does not require repeating the complete checks. `47ef838` runtime code/audio equal `71ad52a` except two listening-acceptance metadata entries. Comparison baseline: Chinese `540279b`.

All four findings below are resolved in this frozen pair. The final missing-key check also verifies that `OutdoorSequence.play(['constructor'], ...)` stays silent; inherited properties are not treated as recordings.

Reviewer: `voice_independent_review`, independent of implementation. Applied `engineering:code-review`; inspected source and ran local tests / intercepted-API browser checks. No implementation edits, TTS generation, paid model calls, deployment or push by this reviewer.

Current copy status: all four previous script corrections pass text recheck. The synchronized 22-line draft had SHA-256 `e3b39643e75a3d0c6a7b916de61bb969dba0244347ea5692faf815943144b6e1`; changing its status to `approved_for_recording` gives accepted file SHA-256 `a1579077950ff8a82d1ed5c781ad0320520114be1099b66bc8d9d6dff0d2fe5e`, with the same reviewed words. All **22 × 2 = 44 English recordings are now imported and independently hash/format checked**. Reviewer read `voice-feedback.json`: **「這版可以，全部用正常語速」** accepts the revised style/four samples; **「兩句地名都可以」** accepts the two flagged Puck place-name clips. **Individual human listening covers 6 clips, not all 44.** The other 38 retain that narrower human-review status; their machine/content/hash evidence is described below.

## Final frozen-version verification

| Check | Independent result |
|---|---|
| English inventory / provenance | **44 / 44** bytes match frozen Git blobs, English manifest SHA-256 and machine-content receipt hashes; 22 texts match the approved script and the backend inventory; manifest script hash matches the complete approved JSON. Every clip stays under `audio/outdoor/renai-001-en/{leda,puck}/`. |
| WAV format | **44 / 44** open as mono PCM16 at 24,000 Hz, positive frame count, duration equal to manifest. Range **1.570958–12.570958 seconds**. |
| Normal-speed generation setting | Both recorder source and manifest specify normal conversational pace, relaxed/effortless articulation and warm/calm tone. Import provenance rejects mismatched script/voice/hash. This verifies configuration lineage; actual acoustic acceptance remains the stated six clips / machine evidence, not a claim of 44 human approvals. |
| Content check recomputation | Recomputed existing receipt normalization: **36 matches**, **6 numeric equivalents** (spoken one/two versus 1/2). Raw Puck `Ren I Road` and `Don Road` ASR differences remain unchanged and linked to Crystal's two spot-listening acceptances. No new ASR/model calls were made. |
| Chinese preservation | **44 / 44 Chinese WAVs plus the entire Chinese manifest** equal baseline `540279b` byte-for-byte; hashes match. |
| Route preservation | Frozen fixture equals `1d952f1` after removing only additive messageKey metadata. Earlier E1/E2 independent adversarial reproductions rerun against the frozen code pass. |
| Complete regression | Backend **193 / 193**, frontend **354 / 354**, both typechecks PASS, independently rerun on `34bc9be` / `47ef838`; subsequent two-label-only `cdb9da5` diff independently inspected as described above. |
| Build | Production frontend build PASS with explicit `VITE_LAST300M_API=https://review.invalid` and isolated `/tmp` output. It validates compilation/bundling only and is deliberately **not** the deployable paired API build. |
| Real English playback | Chromium **154.0.8037.98** and desktop WebKit **26.5** fetched/decoded/started the actual local English WAVs; **11 audio requests per engine**. Puck `cp2.after` completed before `cp2.along` began. All requested files were English paths; no Chinese fallback. |
| Playback cancellation | Actual source.stop observed for locale switch, help, mute, beginning microphone input, new route action and player.dispose. The interrupted queues did not fetch their pending next clip. Locale switch caused no route API call. After the crossing prompt completed, no further automatic audio started while waiting for the walker. |
| Unknown identity | A protocol-accepted unknown `constructor` recovery rendered generic text, made no new audio request and did not render a replay control or raise a page error. |

Playback receipt: [independent-playback.json](independent-playback.json). The test used real local files and native Web Audio, instrumenting source start/stop/ended without replacing playback; only route API responses and microphone permission outcome were controlled. The dispose check directly exercised the same player.dispose called by React cleanup; it was not a physical page-unload measurement. This is **desktop local playback evidence**, not a fresh hosted, iPhone or outdoor acceptance. It also does not mean that the reviewer listened to all 44 clips. Temporary reproduction source: `/tmp/nightingale-english-playback-final-review.cjs`.

The playback harness initially needed its selector aligned to the existing voice select and its standalone test AudioContext unlocked on a real button press before calling play. Those were harness corrections; no runtime source changed during this final review.

## Findings and current disposition

### E1 / P1 — negative or interrogative English could become positive route evidence

Initial location: backend `src/englishInput.ts:5,43-55`, consumed by `src/textFollowUp.ts:13-16`.

The initial caution matcher covered `not` / `cant`, but omitted common contractions such as `don't` and `didn't`. Normalization removed question marks before alias lookup. With a deliberately mistaken model observation `仁愛路`, the independent reproduction showed:

| Input | Initial result at cp3 | Rechecked result after narrow fix |
|---|---|---|
| `I don't see Renai Road` | `GUIDE`, session `cp3x` | `REANCHOR`, session `cp3` |
| `I didn't reach Renai Road` | `GUIDE`, session `cp3x` | `REANCHOR`, session `cp3` |
| `I am looking for Renai Road` | `GUIDE`, session `cp3x` | `REANCHOR`, session `cp3` |
| `Is this Renai Road?` | `GUIDE`, session `cp3x` | `REANCHOR`, session `cp3` |
| `I do not see Renai Road` | already held | remains held |

The punctuation removal also let a bare `Renai Road?` match the positive deterministic alias. This is a text question, not a confirmed location report.

**Current disposition: reproduced, fixed by implementing agent, independently rechecked PASS in working tree.** Current `isEnglishCaution` checks ASCII/full-width question punctuation before normalization, covers the common negations and question/request forms, and returns empty evidence before a model guess can be applied. Reviewer additionally checked `Renai Road?` and `Renai Road？` produce empty evidence while `I see Renai Road` still maps to the canonical term. These are specific guarded cases, not a claim that a regular expression proves all possible English meaning or model accuracy.

Temporary independent reproduction: `/tmp/nightingale-english-initial-review.mts`.

### E2 / P2 — inherited object keys were treated as valid English metadata

Initial locations: frontend `src/remote/last300mClient.ts:97-108`, `englishGuidance.ts:16`, `outdoorVoice.ts:32-37`.

A protocol-valid `RECOVER:cp5` carrying unknown `messageKey: "constructor"` was accepted. Plain-object lookup then returned `Object.constructor`: English guidance's headline became a function, and audio-key selection threw `TypeError: ... is not iterable`. `Last300mPage` calls audio-key selection while rendering the repeat control, so this could break the page instead of retaining generic guidance and silence.

**Current disposition: reproduced, fixed by implementing agent, independently rechecked PASS in working tree.** Recovery, playback, sign and alias lookups now use own-property checks. The original client-level reproduction yields a string headline and an empty playback-key list without throwing. Unknown metadata can remain forward-compatible without being recognized as an inherited object member.

### E3 / P2 — driveway card omitted the actual Chinese emergency sign

Location: frontend `src/remote/Last300mPage.tsx:113-129` and the English `GUIDE:cp4` card in `src/remote/stepCard.ts`.

The specialized step card bypasses `englishGuidance`, so the entrance-question bilingual `lookFor` does not help the driveway card. In both Chromium and WebKit, the reviewer reached “Lobby farther ahead,” expanded Full directions, and read the actual DOM: it said “red Chinese characters for Emergency,” but **「急診」 did not appear anywhere in that step**. A walker who cannot read Chinese needs the literal lettering to compare with the physical sign.

**Current disposition: fixed by implementing agent, independent two-browser recheck PASS.** `StepCard.signs` now provides fixed visible references outside collapsed Full directions: cp4 has `急診 — Emergency`, cp1 has `聯合醫院仁愛院區 — Taipei City Hospital, Renai Branch`, and the road cues retain their Chinese names. Chinese lettering has `lang="zh-TW"`. The reviewer reran the exact step/DOM probe in both engines and observed the cp1 and cp4 references. This is presentation only, not a route transition or arbitrary server-prose translation.

Independent browser probe: `/tmp/nightingale-check-english-signs.cjs`. It waits for the actual step and expands Full directions before reading the DOM; no live observations or model calls.

### E4 / P3 — optional diagnostic prefix can retain the previous locale

Location: frontend `src/remote/useLast300m.ts:75-79,220-221` in the reviewed working tree.

Initially, `noticeDetail` stored a pretranslated `檢查代碼：` / `Check code:` prefix. Changing locale later retranslated `noticeKey`, then appended the old detail unchanged. This could leave Chinese in an otherwise English error when `photoCheck=1` was used; ordinary `photo=1` and route state were unaffected.

**Current disposition: fixed, independent two-browser recheck PASS.** The hook now stores raw `diagnosticCode` and formats it with the current locale. Reviewer supplied an intentionally invalid JPEG through the actual file input, waited for the Chinese `P-DECODE` notice, then switched to English: the same code had the English `Check code:` prefix, no leftover Chinese prefix, and no new API request in Chromium or WebKit. Temporary probe: `/tmp/nightingale-english-diagnostic-review.cjs`. No photo or model request was sent.

## Independently checked invariants

| Area | Evidence / result |
|---|---|
| Route truth | Loaded baseline fixture from Git and recursively removed only new `messageKey` fields from the working fixture; deep equality **PASS**. No coordinates, landmarks, recovery pointers, instructions or arrival evidence changed. Engine diff adds metadata without changing transitions. |
| Chinese fixed assets | All **44** current Chinese WAV bytes equal their `540279b` Git blobs and the accepted manifest SHA-256 values. Chinese recovery selection stays silent even when English message IDs are present. |
| Copy consistency | All **22** revised English strings appear verbatim in the backend copy inventory. No extra timer, road or turn added by the four revisions. |
| Locale / session | Language control stops microphone capture / audio / speechSynthesis, changes presentation and query parameter only. The hook retains session ID, checkpoint, pending confirmation and counters. Browser checks show no network requests from language switches, including during pending crossing-history confirmation. |
| Recording during locale switch | Independent extension of the browser test starts real MediaRecorder with a synthetic source, then switches to Chinese and back: **tracks ended, no new transcription upload, draft preserved** in both engines. |
| Async locale | Feedback reads `localeRef.current` at response time; notice text uses a locale ref / key. No locale prop in callback dependencies resets session or creates a new client. E4's optional diagnostic prefix now also re-renders in the current locale. |
| Crossing / confirmation | Both walker crossings omit recording and text input; crossing-history retains all three conditions and the server-issued confirmation ID. Cancel stays within the existing continuation flow. Route authority remains server-side. |
| Presentation identity | English guide cards use route/action/checkpoint identity. Questions and cp5 recoveries use stable route-authored metadata; no English matching of server prose. Unknown recovery stays generic and silent after E2. |
| Input fallback | Alias results are limited to registered Chinese route vocabulary; full phrase matching prevents Lane 116 / wrong section from becoming the broader Da'an Road. Generic YouBike asks for real lane signs at cp2 and gives no location evidence. E1 guards the tested negative / uncertain forms even against a mistaken model response. |
| Ask card | Actual React dialog uses English labels / `lang=en`, `en-US` browser speech for the fixed help sentence, English volume labels; Escape returns focus to Help me ask. Shared indoor defaults stay Chinese. |
| Missing English audio | The complete manifest is now present. Explicit unknown/missing-key tests still fail silent, with no fallback to Chinese recordings or server-text TTS. Actual English-path playback/cancellation is covered by the final verification above. |

## Earlier initial-review checks retained for traceability

- Initial current-tree full regression: backend **186 / 186**, frontend **348 / 348**, both typechecks PASS. The frontend count observed by this reviewer was 348, not the earlier reported 347.
- After E1/E2 changes: backend English-input + presentation-identity **32 / 32**, typecheck PASS; frontend English + outdoorVoice + textContinuation **46 / 46**, typecheck PASS. This targeted count reflects additional tests present when the commands ran; it is not a final frozen full-suite count.
- Chromium **154.0.8037.98** and desktop WebKit **26.5**, viewport 390×844: full English mocked-API path **17 requests per engine**, correct locale switching without new requests, help focus / speech language, pending-confirmation cancel, both crossings, all three recoveries and arrival; no page errors / horizontal overflow.
- English input-browser check using real desktop MediaRecorder / synthetic oscillator and intercepted transcription API: editable unconfirmed text, one explicit send, no microphone before press, cancel/help/pagehide cleanup, both crossings / pending confirmation hide recording, permission-denial English message and usable text fallback PASS. Reviewer added the locale-switch-while-recording assertions above; WebM **5156 bytes**, MP4 **2966 bytes** in that run.
- These initial mocked-API checks do not establish real English model comprehension, a hosted English version, iPhone English operation or full outdoor navigation. Final asset checks and real local English playback above supplement them; human listening remains six clips as recorded.

## Next-stage gates outside this code review

1. Build/deploy the accepted source pair to the already authorized **limited** English preview with its explicit tagged API, preserving original production traffic and the Chinese preview/asset baseline; verify hosted source/image/assets/route behavior separately.
2. Keep English hosted/phone/teammate evidence separate from the earlier Chinese phone report and from complete Taipei field acceptance. Do not call the 44 clips individually human-accepted; only four samples plus two place-name clips have that evidence.
3. Record the fixed-version demo only after deployment and hosted verification. Final demo/submission approval and production navigation remain Crystal's gate. This report permits proceeding through the authorized limited-preview sequence; it does not remove production HOLD.
