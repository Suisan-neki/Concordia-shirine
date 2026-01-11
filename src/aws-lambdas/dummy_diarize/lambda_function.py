
import json
import logging
import os
import boto3

# ロガー設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# S3 クライアント
s3 = boto3.client("s3")

# 環境変数
OUTPUT_BUCKET = os.environ.get("OUTPUT_BUCKET", "")

def lambda_handler(event, context):
    """
    Dummy Diarize Lambda
    Returns a single speaker segment for the entire chunk duration.
    """
    logger.info(f"Event: {event}")
    
    bucket = event["bucket"]
    chunk = event["chunk"]
    
    # chunk info
    chunk_index = chunk["chunk_index"]
    offset = chunk["offset"]
    duration = chunk["duration"]
    chunk_key = chunk.get("chunk_key") or f"chunks/unknown_chunk_{chunk_index}.wav"
    
    # Create a dummy segment covering the whole duration
    # Speaker is fixed to "SPEAKER_00" to simulate a single speaker
    dummy_segments = [
        {
            "local_start": 0.0,
            "local_end": duration,
            "local_speaker": "SPEAKER_00",
            "confidence": 1.0
        }
    ]
    
    # Prepare result data in the format expected by MergeSpeakers
    result_data = {
        "chunk_index": chunk_index,
        "offset": offset,
        "effective_start": chunk["effective_start"],
        "effective_end": chunk["effective_end"],
        "segments": dummy_segments,
        "speakers": {
            "SPEAKER_00": {
                "total_duration": duration,
                # Dummy embedding (vector of zeros/ones)
                # Size 192 is typical for pyannote, checking MergeSpeakers clustering
                "embedding": [0.1] * 192 
            }
        }
    }
    
    # Upload result to S3
    output_bucket = OUTPUT_BUCKET if OUTPUT_BUCKET else bucket
    base_name = chunk_key.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    result_key = f"diarization/{base_name}.json"
    
    logger.info(f"Uploading dummy result to s3://{output_bucket}/{result_key}")
    s3.put_object(
        Bucket=output_bucket,
        Key=result_key,
        Body=json.dumps(result_data, ensure_ascii=False),
        ContentType="application/json"
    )
    
    # Return metadata to Step Functions
    result = {
        "chunk": chunk,
        "bucket": output_bucket,
        "result_key": result_key
    }
    
    return result
