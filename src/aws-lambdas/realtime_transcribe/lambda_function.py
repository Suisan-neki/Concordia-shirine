"""
Realtime Transcribe Lambda (OpenAI API 版)

API Gateway からのリクエストを処理し、OpenAI Audio API を使用してリアルタイム文字起こしを行います。
Dockerレス化を実現するため、ローカルの faster-whisper 推論を廃止しました。
"""

import base64
import json
import logging
import os
import time
from typing import Any, List, Optional

from openai import OpenAI

# ロガーの初期化
logger = logging.getLogger()
logger.setLevel(logging.INFO)

WHISPER_MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR", "/opt/whisper-models")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "medium")

def get_allowed_origins() -> List[str]:
    """環境変数から許可されたCORSオリジンを取得"""
    allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "")
    if not allowed_origins_str:
        # 環境変数が設定されていない場合は空リストを返す（CORSヘッダーを設定しない）
        logger.warning("ALLOWED_ORIGINS not set, CORS headers will not be set")
        return []
    return [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

def get_cors_headers(request_origin: Optional[str] = None) -> dict:
    """CORSヘッダーを生成（リクエストのOriginに基づいて許可/拒否）"""
    allowed_origins = get_allowed_origins()
    if not allowed_origins:
        # 許可されたオリジンが設定されていない場合はCORSヘッダーを返さない
        return {}
    
    if request_origin and request_origin in allowed_origins:
        return {
            "Access-Control-Allow-Origin": request_origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "3600",
        }
    # リクエストのOriginが許可リストにない場合はCORSヘッダーを返さない
    return {}

# ウォームスタート用のグローバルモデルインスタンス
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
        
        # /tmp（または設定されたディレクトリ）を確認
        # 注意: Lambda Zip では /opt は読み取り専用（Layer）。/tmp は書き込み可能。
        # WHISPER_MODEL_DIR が /opt/... の場合、Layer から提供されるか、ローカルで /tmp に上書きすると想定。
        # ここでは、設定されたディレクトリにない場合、強制的に /tmp/whisper-models を確認します。
        
        model_name = WHISPER_MODEL
        model_root = "/tmp/whisper-models" 
        model_path = os.path.join(model_root, model_name)
        
        # 設定されたディレクトリが存在する場合（例: Layer から）、それを使用
        if os.path.exists(os.path.join(WHISPER_MODEL_DIR, model_name)):
            final_model_path = os.path.join(WHISPER_MODEL_DIR, model_name)
            logger.info(f"Using pre-existing model at {final_model_path}")
        else:
             # それ以外の場合は /tmp を使用し、必要に応じてダウンロード
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
            local_files_only=True,  # ダウンロード済みモデルの使用を強制
        )
        logger.info(f"Model loaded in {time.time() - start_time:.2f}s")
    return _model


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    API Gateway からのリアルタイム文字起こしリクエストを処理します。
    期待されるボディ: {"audio_data": "base64_string"} を含む JSON
    """
    # CORSヘッダーを取得（リクエストのOriginに基づく）
    headers = event.get("headers", {}) or {}
    request_origin = headers.get("Origin") or headers.get("origin")
    cors_headers = get_cors_headers(request_origin)
    
    # OPTIONSリクエスト（プリフライト）の処理
    if event.get("httpMethod") == "OPTIONS" or event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                **cors_headers,
                "Content-Type": "application/json",
            },
            "body": json.dumps({"message": "OK"}),
        }
    
    try:
        model = get_model()

        # ボディの解析
        body = event.get("body")
        if not body:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "Missing request body"}),
            }

        try:
            # JSON文字列と直接的な辞書（CMD起動 vs API Gateway）の両方を処理
            if isinstance(body, str):
                body_data = json.loads(body)
            else:
                body_data = body
            
            audio_b64 = body_data.get("audio_data")
            if not audio_b64:
                 return {
                    "statusCode": 400,
                    "headers": cors_headers,
                    "body": json.dumps({"error": "Missing audio_data field"}),
                }
        except json.JSONDecodeError:
             return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "Invalid JSON body"}),
            }

        # 音声のデコード
        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception as e:
            logger.error(f"Failed to decode base64: {e}")
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "Invalid base64 audio data"}),
            }

        # 一時ストレージへの保存
        input_path = "/tmp/input.wav"
        with open(input_path, "wb") as f:
            f.write(audio_bytes)

        # 文字起こし実行
        logger.info("Starting transcription...")
        start_time = time.time()
        
        segments, info = model.transcribe(
            input_path,
            beam_size=5,
            language="ja", # 日本語ユーザー向けに速度優先で固定
            vad_filter=True, # 無音を除去
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        # ジェネレータを反復処理して結果を取得
        result_segments = []
        for segment in segments:
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
                "confidence": segment.avg_logprob # 近似値
            })

        duration = time.time() - start_time
        logger.info(f"Transcription completed in {duration:.2f}s")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers,
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
        # エラー時もCORSヘッダーを設定
        error_cors_headers = get_cors_headers(request_origin)
        return {
            "statusCode": 500,
            "headers": error_cors_headers,
            "body": json.dumps({"error": f"Internal Server Error: {str(e)}"}),
        }
