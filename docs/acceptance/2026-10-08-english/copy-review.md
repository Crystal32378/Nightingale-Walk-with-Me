# English fixed voice script — independent copy review

Date: 2026-10-08. Reviewer: `voice_independent_review`, using `design:ux-copy`. This reviewer did not implement English presentation, alter the script, generate TTS, or change Chinese copy/audio.

**Latest text verdict: PASS_REVISED_FIXED_COPY.** All four initial copy findings below are resolved in the revised script and synchronized backend inventory. Crystal has accepted the four revised Leda/Puck sample clips with **「這版可以，全部用正常語速」**, as recorded in `voice-feedback.json`; batch generation using that style may proceed. This is not individual human acceptance of all 44 resulting files.

Recheck: English script SHA-256 `e3b39643e75a3d0c6a7b916de61bb969dba0244347ea5692faf815943144b6e1`; all 22 strings match `docs/english-copy-review.md`. The accepted alternatives explicitly say Chinese hospital name / Chinese characters for Emergency, and use singular FamilyMart. The revised board line does not reference a screen that might not yet contain the text. The original suggested wording below is historical review material, not an additional recording source.

Crystal's voice feedback: Leda/Puck timbre was acceptable, but the first samples were too slow and over-enunciated. The accepted revised instruction is **normal conversational pace and relaxed articulation**. This reviewer verified the acceptance receipt, did not independently listen to or accept those samples, and did not generate TTS. Updating the script status to `approved_for_recording` changes the full JSON hash to `a1579077950ff8a82d1ed5c781ad0320520114be1099b66bc8d9d6dff0d2fe5e`; reviewed words are unchanged.

## Reviewed sources

- Backend: `docs/english-preparation.md`, `docs/english-copy-review.md`, `docs/superpowers/specs/2026-10-08-english-design.md`, and `fixtures/route-renai-001.json`.
- Frontend: `src/remote/outdoor-en-script.json` and accepted `docs/tts-outdoor-script.md`.
- Reviewed English draft SHA-256: `6932277f7379bdab40b4fa08d8fc8be82e680a1c04dd6e95e86f465d74b4a5fd` (uncommitted draft at initial review).
- Machine check: **22 English keys, 22 matching Chinese keys, identical key order**. This is a text review, not audio or runtime acceptance.

## Initial narrow findings — resolved in revised copy

Line references below are to the reviewed frontend JSON. Apply matching changes to the backend copy inventory so both fixed-script sources agree before generation.

| Key / line | Issue | Recommended fixed words |
|---|---|---|
| `cp1.board` / 6 | “It lists Taipei City Hospital, Renai Branch” can be heard as the literal wording printed on the board. The accepted field wording is Chinese. | **At Exit 2, look at the notice board nearby. It lists the hospital's Chinese name, shown on your screen.** |
| `cp2.water` / 12 | “There are FamilyMart stores” adds a multiple-store assertion not established by the source sentence 「沿路有全家」. | **There's a FamilyMart along the way if you need water. Take your time.** |
| `cp4.driveway` / 15 | “the red Emergency sign” leaves an English-speaking walker looking for the English word rather than the actual red 「急診」. | **The driveway with the red Chinese characters for Emergency and the letter P is for vehicles. The lobby entrance is a little farther ahead.** |
| `ask.entrance` / 16 | “Does the sign ... say Emergency?” can likewise imply that the English word is printed there. | **Does the sign above the door show the Chinese word for Emergency? For outpatient visits, use the automatic glass doors to the lobby.** |

The display must retain **「聯合醫院仁愛院區」** when showing a board cue and **「急診」** beside its English explanation at the driveway/entrance question. This visible recognition aid remains an implementation check even though the accepted board alternative does not explicitly say “shown on your screen.” Keep `Taipei City Hospital, Renai Branch` in the reviewed destination/English explanation; it need not be misrepresented as an English sign quotation.

A general note in a preparation document saying that audio “does not assert every sign is English” cannot by itself correct a literal sign-reading question heard by the walker. The four edits above address that issue without adding a turn, distance, landmark, or route transition.

## All 22 lines checked

| Key | Copy result | Meaning / boundary |
|---|---|---|
| `cp1.guide` | PASS | “street level” conveys the accepted 一樓 destination without another country's floor-number convention. Elevator 1 remains the accepted field-script identifier. |
| `cp1.board` | EDIT | Preserve the hospital-name clue and explicitly identify Chinese lettering. |
| `cp1.exit` | PASS | Right turn remains after the walker confirms reaching Exit 2. |
| `cp2.cross` | PASS | Fuxing South Road; pedestrian green signal; no seconds or crossing-time promise. |
| `cp2.after` | PASS | Right turn remains after crossing completion, not during the crossing. |
| `cp2.along` | PASS / SAMPLE | “Continue straight along Fuxing South Road.” Same direction and road, no pace promise. |
| `cp2.bike` | PASS | Preserves bicycle-sharing and inner-side advice. “Inner side” is a literal spatial cue; do not add an unverified left/right instruction to clarify it. |
| `cp2.water` | EDIT | Preserve optional water / unhurried tone; remove unsupported plural store count. |
| `cp3.cross` | PASS | Renai Road remains the second crossing; no timer is introduced. |
| `cp3.after` | PASS | Left turn and hospital-on-this-side meaning preserved. |
| `cp4.driveway` | EDIT | Vehicle entrance remains distinct from lobby; identify red Chinese characters and P. |
| `ask.entrance` | EDIT | Retains a question, not inferred arrival; identify the Chinese emergency word. |
| `cp5.lobby` | PASS | Describes the row of automatic glass doors; does not add a new arrival criterion or indoor route. |
| `recover.er` | PASS | Emergency driveway is not the lobby; entrance remains farther ahead. |
| `recover.daan.a` | PASS | Da'an Road / turn around preserved; no invented turn direction. “Let us” is slightly formal but acceptable, not a required rewrite. |
| `recover.daan.b` | PASS | Follow the hospital wall back to the automatic glass doors; same recovery sequence. |
| `recover.canopy` | PASS | Side passage, left turn and Renai Road preserved. Omitting the two-minute estimate is appropriate for varied walking/wheelchair pace. |
| `arrived` | PASS | Entrance and service desk on the left inside preserved; “help ... next step” does not promise new indoor navigation. |
| `reanchor` | PASS / SAMPLE | “What can you see nearby? Just tell me.” Open observation request; no pressure to guess a landmark. “Just” should sound permissive, not impatient, in audition. |
| `photo.remind` | PASS | Sign-only framing, face/plate/patient privacy, Google recipient and Nightingale's own non-retention claim preserved. It does not promise Google's non-retention. |
| `photo.wait` | PASS | Calm, short explanation of the ongoing photo review. |
| `photo.wait2` | PASS | “I am still looking.” Avoids an unsupported almost-finished promise. |

Overall text tone is calm and respectful; no blame, praise-for-performance, urgency, cute characterization, or guessed completion time was added. `number plates` is understandable English and does not require a regional-accent choice. For audio, use Crystal's requested normal conversational pace and relaxed articulation, with natural pauses; do not impose the earlier deliberately slow delivery.

## Proper-name and evidence checks

Primary sources were checked on 2026-10-08 for names, not used to replace the field-verified route:

- Taipei Metro lists **Zhongxiao Fuxing** and the accessible elevator at **Exit 2**. Its page confirms that exit association; the listed item number “1.” is not independent proof that the elevator's displayed identifier is “Elevator 1.” That numeral remains sourced from the accepted Chinese field script. [Taipei Metro station information](https://web.metro.taipei/pages2026/WebStation/010)
- **Taipei City Hospital / Renai Branch** is supported by the hospital's own page; the current municipal branch directory uses **Renai Rd.** for the branch address. “Renai Road” is a consistent spoken expansion. [Hospital branch page](https://english.tch.gov.taipei/News_Content.aspx?n=7CFFF52251AD7D0D&s=39BB2BE4093D9A5E) · [Municipal branch directory](https://english.gov.taipei/News_Content.aspx?n=C0DC89E2D264B498&s=63614FA8AD520DFC)
- The Taipei City Office of Commerce uses **Fuxing South Road**; its page also uses Ren'ai, an apostrophe variant. Retain the script's consistent `Renai` spelling rather than treating apostrophe variants as different geography. [City Office of Commerce](https://english.tcooc.gov.taipei/cp.aspx?n=6E1BBACE8915FD6F&s=AF8B1115191B7CFA)
- The city's tourism directory uses **Da’an Rd.**, including the registered Lane 116 address; `Da'an Road` is an acceptable spoken/full-word form. This verifies naming, not new walking instructions. [Taipei City tourism directory](https://www.travel.taipei/en/attraction/all-regions/art-and-cultural-centers%2Cpublic-art%2Cthemed-shopping-areas?location=99&mode=list&page=2&sortby=Location)
- The hotel's own material supports **The Howard Plaza Hotel Taipei**. This name is relevant to the broader English UI inventory, not an extra landmark added to the 22 spoken lines. Do not adopt the hotel's generic walking-time claims into this accessibility route. [Howard official material](https://taipei.howard-hotels.com.tw/zh_TW/Promo/1501)
- The brand's own site supports **FamilyMart / 全家**; it does not establish the number of shops on this particular short route. [FamilyMart official site](https://www.family.com.tw/Marketing/zh/)

The two lane signs, 「急診」, hospital name, 「福華飯店」 and 「瀚群骨科」 must stay visible in Chinese when used for recognition. “Orthopedic clinic” may explain 「瀚群骨科」, but must not turn every orthopedic clinic into an accepted route landmark or an invented official English proper name.

## Audition and remaining gates

The planned four audition clips can use the two unchanged lines:

1. `cp2.along`: **Continue straight along Fuxing South Road.**
2. `reanchor`: **What can you see nearby? Just tell me.**

Each was produced in Leda and Puck under the approved recording procedure. For subsequent verification, retain clear road naming, normal conversational pace with relaxed articulation, a permissive reanchor question and consistent adult voice quality. This text review itself does not certify pronunciation, acoustic comfort or voice-ID consistency of every generated file.

The four copy edits and inventory synchronization have passed text recheck; Crystal's revised-sample acceptance is recorded. Preserve all 44 Chinese paths and hashes; English remains a separate manifest/directory. Runtime mapping, language-switch cancellation, crossing silence, known recovery identities, English input aliases and source/route equivalence require the independent code review. No program or field acceptance is granted by this copy report.
