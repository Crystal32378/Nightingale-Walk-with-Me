# Voice input local evidence — 2026-10-08

Implementation scope: short explicit recording -> unconfirmed editable text -> existing explicit observation send. Both repositories remain on their existing feature branches. Production promotion remains HOLD.

- Backend baseline: 130 tests and typecheck passed before edits. After implementation: 157 tests and typecheck passed.
- Frontend baseline reported in prior handoff: 319 tests. Current code: 337 tests, typecheck and explicit tagged-API build passed.
- New tests were run red against minimal interface stubs before behavior was implemented. The browser UI test failed on the absent 說一句 control before integration.
- A test initially attempted transcription at cp1; the actual route fixture marks cp1 as walker confirmation. Corrected the test setup to explicitly confirm the exit and reach cp2; no route or eligibility rule was weakened.
- Browser receipt and screenshots: frontend `docs/qa/voice-input-2026-10-08/`. Chromium 154.0.8037.98 and desktop WebKit 26.5, 390x844. Real MediaRecorder with a synthetic oscillator; API responses intercepted. WebKit MIME list was restricted to native MP4 to exercise the iOS-compatible transport. This is not iPhone LINE acceptance.
- Real browser blobs were separately decoded by the actual backend FFmpeg path: Chromium WebM 5156 bytes -> 0.60-second mono PCM WAV, WebKit MP4 2837 bytes -> 0.66-second mono PCM WAV. Raw synthetic fixtures are temporary local files, not committed.
- Assertions: no mic before press; tracks ended before transcription; no observation on transcript arrival; editable text; one explicit send; cancellation preserves typed draft; cancel/help/pagehide release all tracks; both crossings and pending confirmation omit recording controls; no page errors or horizontal overflow.
- Existing route truth and 44 accepted Chinese recordings are unchanged.

Local FFmpeg for tests: `FFMPEG_PATH=$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())') npm test`. Runtime image installs distribution FFmpeg and runs Node as a non-root user. Local tests do not establish the Cloud Run container or provider response.

Pending: independent review, tagged preview build/deploy, real hosted Vertex transcription, one short iPhone X/LINE recording/edit/send check. No claims of full outdoor acceptance.
