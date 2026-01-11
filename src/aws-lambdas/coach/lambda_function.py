import json
import os
import boto3
from openai import OpenAI
from typing import List, Optional

# OpenAI クライアントの初期化（遅延ロード）
client = None

def get_allowed_origins() -> List[str]:
    """環境変数から許可されたCORSオリジンを取得"""
    allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "")
    if not allowed_origins_str:
        # 環境変数が設定されていない場合は空リストを返す（CORSヘッダーを設定しない）
        print("ALLOWED_ORIGINS not set, CORS headers will not be set")
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

def get_openai_client():
    global client
    if client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            client = OpenAI(api_key=api_key)
        else:
            print("OPENAI_API_KEY environment variable not set")
    return client

SYSTEM_PROMPT = """
あなたは会話の聖域を守る「Guardian AI」です。目標は「心理的安全性」を確保することです。
提供された文字起こしと会話の状態を分析してください。
以下のリスクを特定してください：
- 支配的（単純な「一方的」状態）
- 関与不足（長い沈黙）
- 緊張/対立（否定的な感情）
- 共感の欠如

以下のJSONオブジェクトを出力してください：
- "advice": 短く、穏やかで、実行可能なコーチングのヒント（日本語、最大40文字）。
- "analysis_label": 現在の状態の短いラベル（例：「ヒートアップ」、「フリーズ」、「良好なフロー」）。
- "urgency": "low" または "high"。

フローが良好な場合は、肯定的なフィードバックを与えるか、アドバイスをnullにしてください。
トーンは落ち着いていて、保護的で、最小限にしてください。
"""

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))
    
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
        body = json.loads(event.get("body", "{}"))
        transcript_recent = body.get("transcript_recent", "")
        conversation_state = body.get("conversation_state", "Unknown")
        
        if not transcript_recent:
            return {
                "statusCode": 200,
                "headers": cors_headers,
                "body": json.dumps({
                    "advice": None,
                    "analysis_label": "Listening...",
                    "urgency": "low"
                })
            }

        client = get_openai_client()
        if not client:
            return {
                "statusCode": 500,
                "headers": cors_headers,
                "body": json.dumps({"error": "OpenAI client not initialized"})
            }

        user_message = f"State: {conversation_state}\nTranscript: {transcript_recent}"

        response = client.chat.completions.create(
            model="gpt-4o", # コストが懸念される場合は gpt-3.5-turbo、ただしニュアンスには 4o がベター
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=150
        )

        result_json = response.choices[0].message.content
        print("OpenAI Result:", result_json)
        
        result = json.loads(result_json)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers,
            },
            "body": json.dumps(result)
        }

    except Exception as e:
        print(f"Error: {e}")
        error_cors_headers = get_cors_headers(request_origin)
        return {
            "statusCode": 500,
            "headers": error_cors_headers,
            "body": json.dumps({"error": str(e)})
        }
