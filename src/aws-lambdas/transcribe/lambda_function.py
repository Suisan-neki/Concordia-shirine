"""
Transcribe Lambda Function (OpenAI API Version)

OpenAI Audio API (Whisper) を使用して音声セグメントを文字起こしする。
Dockerレス化のため、ローカルモデル推論を廃止してAPI利用に移行。

Version: 4.0 - OpenAI API Migration
"""

import json
import logging
import os
from typing import Any

import boto3
from openai import OpenAI

from progress import update_progress

# ロガー設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# S3 クライアント
s3 = boto3.client("s3")

# OpenAI クライアント
# OPENAI_API_KEY は環境変数から自動読み込み
client = OpenAI()

def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Lambda ハンドラー
    Args:
        event: Lambda イベント
            - bucket: S3 バケット名
            - segment_file: セグメントファイル情報
                - key: S3 キー
                - speaker: 話者ID
                - start: 開始時刻
                - end: 終了時刻
        context: Lambda コンテキスト
    """
    logger.info(f"Event: {event}")

    # 進捗更新
    interview_id = event.get("interview_id")
    if interview_id:
        # Note: progress.py needs to be bundled or available
        try:
            update_progress(interview_id, "transcribing")
        except Exception as e:
            logger.warning(f"Failed to update progress: {e}")

    bucket = event["bucket"]
    segment_file = event["segment_file"]

    segment_key = segment_file["key"]
    speaker = segment_file["speaker"]
    start = segment_file["start"]
    end = segment_file["end"]

    local_path = "/tmp/segment.wav"

    try:
        # S3 から音声セグメントをダウンロード
        logger.info(f"Downloading s3://{bucket}/{segment_key}")
        s3.download_file(bucket, segment_key, local_path)

        # OpenAI API で文字起こし実行
        logger.info("Transcribing audio via OpenAI API...")
        
        with open(local_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="ja",
                response_format="text" # Simple text response for batch is usually enough, but let's conform to standard
            )
        
        # transcript is just text if response_format="text"
        text = str(transcript)
        logger.info(f"Transcription result: {text[:100]}...")

        # 結果をS3に保存
        segment_name = segment_key.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        result_key = f"transcribe_results/{segment_name}.json"

        result_data = {
            "speaker": speaker,
            "start": start,
            "end": end,
            "text": text,
        }

        logger.info(f"Saving result to s3://{bucket}/{result_key}")
        s3.put_object(
            Bucket=bucket,
            Key=result_key,
            Body=json.dumps(result_data, ensure_ascii=False),
            ContentType="application/json",
        )

        # Step Functionsへの戻り値
        result = {
            "bucket": bucket,
            "result_key": result_key,
            "speaker": speaker,
            "start": start,
            "end": end,
        }
        if interview_id:
            result["interview_id"] = interview_id
        return result

    except Exception as e:
        logger.error(f"Error during transcription: {e}", exc_info=True)
        raise e

    finally:
        if os.path.exists(local_path):
            os.remove(local_path)
