import base64
import json
import logging
import os
import time
from typing import Any

from faster_whisper import WhisperModel

# Initialize logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
WHISPER_MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR", "/opt/whisper-models")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "medium")

# Global model instance for warm starts
_model = None


def get_model():
    global _model
    if _model is None:
        logger.info(f"Loading Whisper model: {WHISPER_MODEL} from {WHISPER_MODEL_DIR}")
        start_time = time.time()
        _model = WhisperModel(
            WHISPER_MODEL,
            device="cpu",
            compute_type="int8",
            download_root=WHISPER_MODEL_DIR,
            local_files_only=True,  # Ensure we use the pre-downloaded model
        )
        logger.info(f"Model loaded in {time.time() - start_time:.2f}s")
    return _model


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Handles API Gateway requests for real-time transcription.
    Expected Body: JSON with {"audio_data": "base64_string"}
    """
    try:
        model = get_model()

        # Parse body
        body = event.get("body")
        if not body:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing request body"}),
            }

        try:
            # Handle both JSON string and direct dict (CMD invocation vs API Gateway)
            if isinstance(body, str):
                body_data = json.loads(body)
            else:
                body_data = body
            
            audio_b64 = body_data.get("audio_data")
            if not audio_b64:
                 return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "Missing audio_data field"}),
                }
        except json.JSONDecodeError:
             return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid JSON body"}),
            }

        # Decode audio
        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception as e:
            logger.error(f"Failed to decode base64: {e}")
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid base64 audio data"}),
            }

        # Save to ephemeral storage
        input_path = "/tmp/input.wav"
        with open(input_path, "wb") as f:
            f.write(audio_bytes)

        # Transcribe
        logger.info("Starting transcription...")
        start_time = time.time()
        
        segments, info = model.transcribe(
            input_path,
            beam_size=5,
            language="ja", # Default to Japanese or detect? Let's fix to Japanese for speed if targeting Japanese users
            vad_filter=True, # Filter silence
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        # Iterate generator to get results
        result_segments = []
        for segment in segments:
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
                "confidence": segment.avg_logprob # Approximation
            })

        duration = time.time() - start_time
        logger.info(f"Transcription completed in {duration:.2f}s")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", # Enable CORS
            },
            "body": json.dumps({
                "segments": result_segments,
                "language": info.language,
                "language_probability": info.language_probability,
                "duration": duration
            }),
        }

    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Internal Server Error: {str(e)}"}),
        }
