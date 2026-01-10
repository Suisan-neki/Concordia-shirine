"""
Realtime Transcribe Lambda (OpenAI API Version)

Handles API Gateway requests for real-time transcription using OpenAI Audio API.
Replaces local faster-whisper inference to enable Docker-less deployment.
"""

import base64
import json
import logging
import os
import time
from typing import Any

from openai import OpenAI

# Initialize logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

WHISPER_MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR", "/opt/whisper-models")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "medium")

# Global model instance for warm starts
_model = None

def download_model_from_s3(model_name: str, download_root: str):
    """S3からモデルをダウンロード"""
    deployment_bucket = os.environ.get("DEPLOYMENT_BUCKET")
    if not deployment_bucket:
         logger.warning("DEPLOYMENT_BUCKET not set. Assuming model is present.")
         return

    s3_prefix = f"models/{model_name}"
    
    try:
        paginator = s3.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=deployment_bucket, Prefix=s3_prefix)
        
        found_files = False
        for page in pages:
            for obj in page.get('Contents', []):
                found_files = True
                key = obj['Key']
                rel_path = key[len(s3_prefix):].lstrip('/')
                if not rel_path: continue
                
                local_file_path = os.path.join(download_root, rel_path)
                os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
                
                if not os.path.exists(local_file_path):
                    logger.info(f"Downloading model file: {key} to {local_file_path}")
                    s3.download_file(deployment_bucket, key, local_file_path)
        
        if not found_files:
            logger.error(f"No model files found in s3://{deployment_bucket}/{s3_prefix}")
            raise RuntimeError(f"Model {model_name} not found in S3")
            
    except Exception as e:
        logger.error(f"Failed to download model from S3: {e}")
        raise e

def get_model():
    global _model
    if _model is None:
        logger.info("Importing faster_whisper...")
        from faster_whisper import WhisperModel
        
        # Check /tmp (or configured dir)
        # Note: In Lambda Zip, /opt is read-only (Layer). /tmp is writable.
        # If WHISPER_MODEL_DIR is /opt/..., we assume it comes from a Layer OR we override it to /tmp locally
        # Here, we force check /tmp/whisper-models if not found in configured dir
        
        model_name = WHISPER_MODEL
        model_root = "/tmp/whisper-models" 
        model_path = os.path.join(model_root, model_name)
        
        # If configured dir exists (e.g. from Layer), use it
        if os.path.exists(os.path.join(WHISPER_MODEL_DIR, model_name)):
            final_model_path = os.path.join(WHISPER_MODEL_DIR, model_name)
            logger.info(f"Using pre-existing model at {final_model_path}")
        else:
             # Else use /tmp and download if needed
             if not os.path.exists(model_path):
                 logger.info(f"Model not found at {model_path}. Downloading from S3...")
                 download_model_from_s3(model_name, model_path)
             final_model_path = model_path

        logger.info(f"Loading Whisper model: {WHISPER_MODEL} from {final_model_path}")
        start_time = time.time()
        _model = WhisperModel(
            final_model_path,
            device="cpu",
            compute_type="int8",
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
