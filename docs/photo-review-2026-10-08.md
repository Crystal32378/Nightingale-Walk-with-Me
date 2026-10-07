# Human-reviewed trip 2: replay and acceptance preparation

Prepared 2026-10-08 (Taipei). Human review exported 2026-10-07. Deployment is pending an independent reviewer; this report does not authorize deployment.

## Outcome

All 57 second-trip rows were imported from Crystal's completed review. Fifteen rows change visible text; two of those also change location (`IMG_5595.jpg` and `IMG_5596.jpg`: `lane` to `fuxing_west`). The original first-trip 42 rows, route fixture, engine and validator are unchanged. Original photos and video remain local and ignored by Git.

The current deterministic engine was replayed against 495 saved model readings: 99 images, five image conditions, two location modes. There were **zero reachable false arrivals in these first-step replay cases**, but **seven reachable early checkpoint confirmations** and **three false recovery outcomes** across the two modes. These counts describe image/variant/location/checkpoint cases, not independent people or field incidents.

The early-confirmation and false-recovery counts are unchanged before versus after the human corrections under the same scoring projection. The corrections improve the evaluation ground truth; they do not fix the route engine or the historical model readings.

## Reproducible inputs

Evidence directory: `eval/reviews/trip2-2026-10-07/`.

- `human-review.json`: byte-for-byte copy of Crystal's export; 57/57 rows marked reviewed. SHA-256 `d010f80aa660d250078c0ca8be13a4578ccd95f46558977eba4a1886801e7135`.
- `labels-before.json`: exact original labels. Its SHA-256 matches the export's source hash: `28e928558d77d54945270b1a33d0c08a3b1db99974203d649c8f99f78773e85b`.
- `eval/photo-labels.json`: current approved human wording, optional wording and location, plus review provenance.
- `import-audit.json`: all 15 changed rows and the unchanged route hash.
- `labels-before.route-terms.json` and `labels-after.route-terms.json`: derived scoring inputs. The same projection is applied to both sides of the comparison.
- `term-projection-before.json` and `term-projection-after.json`: each original text fragment and its registered-term matches.
- `saved-readings.json`: historical observations from run `2026-09-28T13-45-15-303Z`, preserved once. `saved-readings-provenance.json` records the original full output hash and the selected fields.
- `before-projected.json`, `after-projected.json`, `trip2-projected.json`, `after-verbatim.json`, and `summary.json`: replay results, source hashes, failures and limitations.

Route SHA-256 remains `3c0ca31f831c4254d82b2cc7a66233f39f0ab308099a6d111c2f25e9411152f8`.

## Human text and the grading vocabulary

The model is instructed to return a closed set of registered route terms. Crystal's new labels also contain useful verbatim text outside that set, including `FamilyMart`, `復興南路一段219巷`, and long sign phrases. Counting those entire phrases as required model output would penalize the model for following its closed vocabulary.

Human input is therefore preserved **verbatim** in the main label file and original export. Separate scoring labels select only exact, case-insensitive, longest non-overlapping registered substrings. There is no synonym mapping, spelling correction, new route evidence, or fixture change. For example, `急診 右車道 左車道` projects to `急診`; `FamilyMart` remains in the original text but contributes no registered-term recall requirement. The unusual entered string `急診室哭` is preserved unchanged; this process does not guess an intended replacement.

The raw-text replay is also preserved in `after-verbatim.json`. Its recall and home-hit denominators are not comparable to a closed-vocabulary score. No projection is used at runtime.

## Results and cases to review

For all 99 images, the reachable outcomes across all five conditions are:

- `none` (no location): 4 early confirmations, 0 false arrivals, 3 false recoveries.
- `place` (synthetic zone derived from the human place label): 3 early confirmations, 0 false arrivals, 0 false recoveries.

For the 57 second-trip images only:

- Original images: 0 early confirmations, 0 false arrivals, 0 false recoveries in either mode.
- Small images: `IMG_5591.jpg` is falsely confirmed at cp2 in both modes. The stored reading says `仁愛路三段123巷13弄`; Crystal's reviewed text instead includes `復興南路一段219巷`.
- Cropped images: `IMG_5600_f1.jpg`, labelled exit2, is falsely confirmed at cp2 without location. The synthetic exit2 zone vetoes it in `place` mode.
- Blur and dark variants: no reachable early confirmations or false arrivals in this replay.

The first-trip `S__121634854_0.jpg` still falsely confirms cp3 in original and small conditions, in both modes, from a stored `瀚群骨科` reading. Three first-trip indoor directory cases (`865`, `867`, `868`) falsely recover toward the emergency entrance without location; their synthetic lobby zone vetoes the recovery.

Registered-term recall on original images is 26/28 after correction (21/21 before correction). These are different human-labelled denominators, **not** an improvement or deterioration of the model: the model outputs are identical. Second-trip original-image recall is 8/10. The detail files retain the other variants and every failure.

## What this evaluation does not establish

- No fresh model calls were made. Recorded latency and timeouts are from 2026-09-28, not current performance measurements.
- The historical reading vocabulary contains eight terms since removed from the current route. There are no newly added route terms, but this is still a vocabulary mismatch. Every result records `vocabularyMatches: false` and both vocabularies. Replaying a replay preserves the original reading vocabulary rather than relabelling it as current.
- `place` uses a synthetic zone from the label, not an observed phone fix. Both Fuxing-side labels map to `unknown`; it is incorrect to describe every `place` case as having reliable GPS.
- `judge()` uses `questionCount: 0` and one engine step. Zero first-step false arrivals does not prove repeated-question or complete-walk arrival safety.
- The failed original-image call is excluded from scores; timed-out calls are empty observations. They remain in the preserved source and per-variant counts.
- No iPhone Safari, live photo upload, outdoor sound or mobile-network field acceptance was performed in this replay.

## Commands

Import is guarded by source hash, completed status, the exact 57 filenames, unique rows and known places. It defaults to dry run and refuses to overwrite a previously imported source:

```bash
python3 scripts/import-trip2-review.py --review /path/to/nightingale-trip2-review-2026-10-07.json
python3 scripts/import-trip2-review.py --review /path/to/nightingale-trip2-review-2026-10-07.json --apply
```

The committed current labels already contain the import; do not apply it twice. Reproduce the scored result without any cloud call:

```bash
npx tsx eval/photo-eval.ts --replay eval/reviews/trip2-2026-10-07/saved-readings.json --labels eval/reviews/trip2-2026-10-07/labels-after.route-terms.json --out eval/out/verify-review
```

Add `--trip 2` for the second-trip subset; substitute `labels-before.route-terms.json` for the comparable baseline. Source and route hashes are emitted with each result.

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_import_trip2_review.py'
npm test
npm run typecheck
```

## Independent acceptance request

Preparation checks: 84 backend tests and TypeScript checks passed; five importer tests cover exact preservation, dry-run behavior, source mismatch, incomplete/duplicate rows, invalid place identifiers (including the `places.about` metadata key), and repeat-import refusal. The frontend's 267 tests and Firebase-target build are checked separately. Passing these engineering checks does not remove the replay failures above.

Review the data import and original-media custody, the projection's limitations, cached-reading provenance, remaining unsafe transitions, and frontend fixed-audio integration. Recording acceptance by Crystal is complete; it is separate from navigation acceptance. Record preparation acceptance and deployment acceptance separately. A deployment PASS must explain why the reachable unsafe transitions and stale-reading limitations are resolved or legitimately excluded from the proposed deployment scope. Do not silently change route truth or treat this report as that approval.
