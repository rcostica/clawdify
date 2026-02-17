#!/usr/bin/env python3
"""
Transcribe an audio file using faster-whisper.
Usage: transcribe.py <audio_file_path>
Outputs the transcription text to stdout.
"""

import sys
import os

def transcribe(audio_path: str) -> str:
    from faster_whisper import WhisperModel

    # Use small model for good accuracy on CPU. Options: tiny, base, small, medium, large-v3
    model_size = os.environ.get("WHISPER_MODEL", "small")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    segments, info = model.transcribe(audio_path, beam_size=5)

    text_parts = []
    for segment in segments:
        text_parts.append(segment.text.strip())

    return " ".join(text_parts)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: transcribe.py <audio_file>", file=sys.stderr)
        sys.exit(1)

    audio_file = sys.argv[1]
    if not os.path.exists(audio_file):
        print(f"File not found: {audio_file}", file=sys.stderr)
        sys.exit(1)

    result = transcribe(audio_file)
    print(result)
