#!/usr/bin/env python3
"""Record only the approved 新錄 rows. Credentials stay inside gcloud.

Dry run by default; --record makes the explicitly selected API calls.
Existing recordings are reused only when their text, voice, and hash match.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request
import wave
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
MODEL = "gemini-2.5-flash-tts"
STYLE = (
    "Speak Mandarin gently and unhurried, "
    "like a grandchild walking an elder. Use a calm, warm, conversational voice. "
    "Read only the following text verbatim, without adding any words: "
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--voice", choices=["Leda", "Puck"])
    parser.add_argument("--key")
    parser.add_argument("--record", action="store_true")
    args = parser.parse_args()
    rows = []
    for line in (ROOT / "docs/tts-outdoor-script.md").read_text().splitlines():
        cells = [c.strip() for c in line.split("|")]
        if len(cells) == 6 and "**新錄**" in cells[4]:
            rows.append({"key": cells[1], "text": cells[3]})
    if args.key:
        rows = [row for row in rows if row["key"] == args.key]
        if not rows:
            parser.error("key is not an approved 新錄 row")
    voices = [args.voice] if args.voice else ["Leda", "Puck"]
    print(json.dumps({"record": args.record, "voices": voices, "lines": rows}, ensure_ascii=False), flush=True)
    if not args.record:
        return
    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "recordings.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {
        "model": MODEL, "project": "nightingale-walk-with-me", "location": "us-central1",
        "script": "docs/tts-outdoor-script.md", "style": STYLE, "recordings": {},
    }
    if manifest.get("style") != STYLE or manifest.get("model") != MODEL:
        raise RuntimeError("Generation settings changed; use a new output folder to preserve the previous recordings.")
    token = subprocess.run(
        ["gcloud", "auth", "print-access-token"], check=True, capture_output=True, text=True,
    ).stdout.strip()
    url = "https://us-central1-aiplatform.googleapis.com/v1/projects/nightingale-walk-with-me/locations/us-central1/publishers/google/models/" + MODEL + ":generateContent"
    for voice in voices:
        (args.output / voice).mkdir(exist_ok=True)
        for row in rows:
            key, text = row["key"], row["text"]
            dest = args.output / voice / (key + ".wav")
            entry_id = voice + ":" + key
            previous = manifest["recordings"].get(entry_id)
            if dest.exists():
                if previous and previous["text"] == text and previous["sha256"] == hashlib.sha256(dest.read_bytes()).hexdigest():
                    print("REUSE", entry_id, flush=True)
                    continue
                raise RuntimeError("Existing file has no matching provenance: " + str(dest))
            body = {"contents": [{"role": "user", "parts": [{"text": STYLE + text}]}],
                    "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {
                        "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
            request = urllib.request.Request(url, data=json.dumps(body).encode(), headers={
                "Authorization": "Bearer " + token, "Content-Type": "application/json",
            })
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    result = json.load(response)
            except urllib.error.HTTPError as error:
                detail = json.loads(error.read()).get("error", {})
                raise RuntimeError(f"TTS HTTP {error.code}: {detail.get('status')} {detail.get('message')}") from None
            parts = result.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            audio = next((p["inlineData"] for p in parts if p.get("inlineData", {}).get("mimeType", "").startswith("audio/")), None)
            if not audio or not audio.get("data"):
                raise RuntimeError("No audio returned for " + entry_id)
            mime = audio["mimeType"]
            if not mime.startswith("audio/L16"):
                raise RuntimeError("Unexpected audio format: " + mime)
            rate = int(re.search(r"rate=(\d+)", mime).group(1))
            pcm = base64.b64decode(audio["data"], validate=True)
            if len(pcm) < rate or len(pcm) % 2:
                raise RuntimeError("Invalid or implausibly short PCM for " + entry_id)
            with wave.open(str(dest), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(rate)
                wav.writeframes(pcm)
            entry = {"key": key, "voice": voice, "text": text,
                     "file": str(dest.relative_to(args.output)), "mimeType": mime,
                     "seconds": len(pcm) / (rate * 2), "bytes": dest.stat().st_size,
                     "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
                     "generatedAt": datetime.now(timezone.utc).isoformat(),
                     "listeningReview": "pending", "usage": result.get("usageMetadata", {})}
            manifest["recordings"][entry_id] = entry
            temp = manifest_path.with_suffix(".tmp")
            temp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
            temp.replace(manifest_path)
            print("RECORDED", entry_id, round(entry["seconds"], 2), "seconds", flush=True)


if __name__ == "__main__":
    main()
