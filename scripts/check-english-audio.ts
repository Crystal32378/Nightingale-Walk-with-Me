/** Bounded verification of fixed synthetic speech, never a human recording. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createVertexTranscriber } from '../src/transcription.js';
import { decodeAudio } from '../src/audio.js';
const root = process.env.ENGLISH_RECORDINGS!;
if (!root) throw new Error('ENGLISH_RECORDINGS is required');
const receiptPath = 'docs/acceptance/2026-10-08-english/audio-content-check.json';
const manifest = JSON.parse(readFileSync(join(root, 'recordings.json'), 'utf8'));
const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : { scope: 'Machine transcription cross-check of fixed synthetic English TTS; not human listening, voice-identity or field acceptance.', results: {} };
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/1/g, 'one').replace(/letus/g, 'lets').replace(/iam/g, 'im').replace(/thereis/g, 'theres').replace(/thatis/g, 'thats');
const client = createVertexTranscriber();
for (const [key, value] of Object.entries(manifest.recordings) as Array<[string, any]>) {
  if (receipt.results[key]?.status === 'PASS' && receipt.results[key].sha256 === value.sha256) continue;
  const bytes = readFileSync(join(root, value.file));
  if (createHash('sha256').update(bytes).digest('hex') !== value.sha256) throw new Error('hash mismatch');
  try {
    const signal = new AbortController().signal;
    const wav = await decodeAudio(bytes, 'audio/wav', signal);
    const text = await client.transcribe(wav, signal);
    const status = normalize(text) === normalize(value.text) ? 'PASS' : 'REVIEW_DIFFERENCE';
    receipt.results[key] = { status, expected: value.text, transcribed: text, sha256: value.sha256 };
    console.log(key, status);
  } catch (error) {
    receipt.results[key] = { status: 'UNVERIFIED', error: (error as { code?: string }).code ?? 'failure', sha256: value.sha256 };
    console.log(key, 'UNVERIFIED');
  }
  receipt.checkedAt = new Date().toISOString();
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify({ checked: Object.keys(receipt.results).length, differences: Object.entries(receipt.results).filter(([, v]: any) => v.status !== 'PASS').map(([k]) => k) }));
