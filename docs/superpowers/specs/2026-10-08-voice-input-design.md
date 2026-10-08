# Short voice input design

Implements the scope already approved in `docs/voice-input-next.md` and the 2026-10-08 continuation request. This is a new input subsystem with an isolated transcription endpoint; existing route interpretation, photos, and the 44 accepted Chinese WAVs remain the baseline.

## Flow and boundaries

The walker presses 說一句 after seeing: 「錄音會傳送給 Google Vertex AI 轉成文字；請先停在安全的地方。你確認並按傳送後，才會用來判斷路線。」 The browser negotiates MediaRecorder audio/mp4 or audio/webm; no browser SpeechRecognition assumption. Record at most 15 seconds. Stop releases microphone tracks immediately, then submits the short recording for transcription. The returned text fills the existing editable text field, with an explicit pending confirmation message. Only the existing 傳送 button sends an observation. A new recording replaces the draft only after success; cancellation preserves any pre-existing typed draft.

The input is absent during walker-confirmed steps, arrival, or a pending location confirmation. Recording cancels on help, a new route action, page hide, background, or unmount. A generation token invalidates late permission grants, recorder events and network results; a late granted stream is stopped. Recording stops existing playback and blocks new playback until it finishes. Unsupported/denied/empty/failed input leaves typing usable. No automatic retry or automatic observation.

## Transport and backend

`POST /api/sessions/:id/transcriptions` accepts a binary body with an allowed audio MIME, maximum 2 MiB. It requires an existing evidence step, and never changes route session/action or pending continuation. Session quota is a separate `audioCount`: 12 per walk; client 6/minute, instance 10/minute, one active decode/transcription per instance. Invalid requests do not call Vertex. Quotas, processing slots and all async work are bounded.

Container signatures must match the declared MIME. FFmpeg is invoked without shell or temporary files, accepts only pipe input, decodes audio to mono 16 kHz PCM, rejects malformed, empty, or >16-second audio (one second allows recorder/codec padding), and has a 5-second execution bound. Re-encode PCM with a minimal WAV header in memory. Add a small Dockerfile with FFmpeg for the tagged backend build; no new cloud service, credential or enabled API.

A separate Vertex transcription client uses the existing gemini-2.5-flash model, temperature 0, bounded output, JSON schema, request abort and 20-second timeout. It transcribes only, without route vocabulary or session/location data. Chinese output uses Traditional Chinese; other spoken language is preserved. Reject invalid, empty or overlong text; distinguish 429 and timeout. Raw recording, decoded PCM, and unconfirmed transcript are not written to Git, Firestore or application logs. Numeric quota is stored with the session. Cloud-provider retention is not claimed.

## Acceptance and sequence

TDD covers recorder lifecycle and cancellation races, transport validation and resource/cost bounds, transcription without session movement, preservation of pending questions, and explicit text send exactly once. Browser checks use real components and synthetic audio with desktop Chromium/WebKit, labeled accordingly. They cannot accept iPhone X/LINE microphone permission, actual speech, or outdoor usability.

After implementation: an independent agent reviews both repositories and reruns meaningful checks. Resolve blocking findings before clean-archive paired preview deployment. Read live Cloud Run traffic/Hosting state immediately before deployment; retain existing production traffic and original tag. Hosted verification precedes a single short iPhone LINE test request. Then architecture source/rendered diagram, README and normal GitHub preservation. English and final demo follow their own handoff stages; final publication/submission remain Crystal's gate.
