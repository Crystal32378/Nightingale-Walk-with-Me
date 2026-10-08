# English implementation — independent review draft

**DRAFT / NOT A RELEASE ACCEPTANCE.** Review started on 2026-10-08 against backend working changes after `1d952f1` and frontend working changes after `540279b`. Source is still changing; final accepted SHAs, English audio inventory and deployment evidence are not frozen.

**Current disposition: INITIAL_CODE_CHECKS_PASS / FINAL_REVIEW_PENDING.** All four findings below have been fixed and independently rechecked in the working tree. No open implementation blocker from this initial review remains; complete English audio and frozen-commit review are still required before a release verdict.

Reviewer: `voice_independent_review`, independent of implementation. Applied `engineering:code-review`; inspected source and ran local tests / intercepted-API browser checks. No implementation edits, TTS generation, paid model calls, deployment or push by this reviewer.

Current copy status: all four previous script corrections pass text recheck. The synchronized 22-line draft had SHA-256 `e3b39643e75a3d0c6a7b916de61bb969dba0244347ea5692faf815943144b6e1`; changing its status to `approved_for_recording` gives current file SHA-256 `a1579077950ff8a82d1ed5c781ad0320520114be1099b66bc8d9d6dff0d2fe5e`, with the same reviewed words. Reviewer read `voice-feedback.json`: Crystal's revised-sample response is **「這版可以，全部用正常語速」**. The four Leda/Puck sample clips plus text/style are accepted; **this does not establish individual human acceptance of all 44 files**. Batch generation is in progress. At the latest read, the English manifest still has 0 imported utterances; this is explicitly unfinished, not proof that English playback works.

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
| Missing English audio | English manifest is empty and missing files fail silent, with no fallback to Chinese recordings or server-text TTS. This validates the missing-audio behavior only. |

## Checks executed by reviewer

- Initial current-tree full regression: backend **186 / 186**, frontend **348 / 348**, both typechecks PASS. The frontend count observed by this reviewer was 348, not the earlier reported 347.
- After E1/E2 changes: backend English-input + presentation-identity **32 / 32**, typecheck PASS; frontend English + outdoorVoice + textContinuation **46 / 46**, typecheck PASS. This targeted count reflects additional tests present when the commands ran; it is not a final frozen full-suite count.
- Chromium **154.0.8037.98** and desktop WebKit **26.5**, viewport 390×844: full English mocked-API path **17 requests per engine**, correct locale switching without new requests, help focus / speech language, pending-confirmation cancel, both crossings, all three recoveries and arrival; no page errors / horizontal overflow.
- English input-browser check using real desktop MediaRecorder / synthetic oscillator and intercepted transcription API: editable unconfirmed text, one explicit send, no microphone before press, cancel/help/pagehide cleanup, both crossings / pending confirmation hide recording, permission-denial English message and usable text fallback PASS. Reviewer added the locale-switch-while-recording assertions above; WebM **5156 bytes**, MP4 **2966 bytes** in that run.
- No test in this draft establishes real English model comprehension, accepted English audio, hosted English version, iPhone English operation or full outdoor navigation.

## Work still required before final review

1. Implementing agent completes generation/import of the normal-speed English set and verifies all 44 files/text hashes without touching Chinese assets. Sample/style acceptance is recorded; batch machine checks and any additional human listening must be labeled separately.
2. Freeze both implementation SHAs; reviewer checks final diff, complete audio manifest and final regression/build/browser receipts. Real English playback cancellation and complete-phrase sequencing require the actual files.
3. Paired limited deployment / hosted acceptance follows separately, retaining production HOLD and Chinese baseline. This draft grants no deployment or final-release PASS.
