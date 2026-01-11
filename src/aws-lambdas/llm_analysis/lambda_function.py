"""
LLMAnalysis Lambda Function

OpenAI API (gpt-5-mini) を使用して文字起こし結果を分析する。
Structured Outputs を使用して HEMS インタビューデータを構造化抽出。

Version: 3.0 - Structured Outputs 対応
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3
import openai
from tenacity import retry, stop_after_attempt, wait_exponential

from models import ConcordiaAnalysisData
from progress import update_progress

# ロガー設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS クライアント
s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")

# 環境変数
OUTPUT_BUCKET = os.environ.get("OUTPUT_BUCKET", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5-mini")
TABLE_NAME = os.environ.get("TABLE_NAME", "")

# グローバル変数（コールドスタート対策）
_openai_client = None

# コンコルディア インタビュー分析用システムプロンプト
CONCORDIA_SYSTEM_PROMPT = """あなたはコミュニケーション分析の専門家です。
「Concordia（調和）」の観点から、会議や対話のログを分析し、心理的安全性、関与度、そして目的達成度を評価してください。

以下の原則を守ってください：
1. 発言内容だけでなく、文脈や雰囲気（肯定的なフィードバック、建設的な議論など）を読み取ってください。
2. 批判的なスコアリングではなく、改善のための建設的な評価を行ってください。
3. 具体的な事実に基づいて要約してください。

スコアリング基準:
【調和度 (Harmony)】
- 互いの意見を尊重し、建設的に積み上げているか。
- 否定的な言葉遣いが少なく、受容的か。

【関与度 (Engagement)】
- 参加者が偏りなく発言しているか。
- 質問や応答が活発か。

【明確性 (Clarity)】
- 結論やネクストアクションが明確になっているか。
- 議論が発散したまま終わっていないか。
"""

DEFAULT_PROMPT = """以下の会議の文字起こしを分析し、コンコルディア分析フォーマットで出力してください。"""


def get_openai_client() -> openai.OpenAI:
    """OpenAI クライアントを取得（シングルトン）"""
    global _openai_client

    if _openai_client is None:
        if not OPENAI_API_KEY:
             # Fallback if needed, but should be set
             raise ValueError("OPENAI_API_KEY environment variable not set")

        _openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
        logger.info("OpenAI client initialized")

    return _openai_client


@retry(
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(3),
)
def analyze_transcript_structured(transcript: list[dict]) -> ConcordiaAnalysisData:
    """
    文字起こしを構造化分析（Structured Outputs 使用）

    Args:
        transcript: 文字起こし結果のリスト

    Returns:
        ConcordiaAnalysisData: 構造化された分析データ
    """
    # 話者ごとの発言を整形
    full_text = "\n".join([f"[{t['speaker']}] {t['text']}" for t in transcript])

    logger.info(f"Analyzing transcript with {len(transcript)} segments (structured)...")

    client = get_openai_client()

    # Structured Outputs を使用
    completion = client.beta.chat.completions.parse(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": CONCORDIA_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"以下の文字起こしを分析してください。\n\n文字起こし:\n{full_text}",
            },
        ],
        response_format=ConcordiaAnalysisData,
    )

    message = completion.choices[0].message
    if message.parsed:
        logger.info("Structured output parsed successfully")
        return message.parsed
    elif message.refusal:
        logger.warning(f"Model refused to generate: {message.refusal}")
        raise ValueError(f"Model refused: {message.refusal}")
    else:
        raise ValueError("Failed to parse structured output")



@retry(
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(3),
)
def analyze_transcript_text(transcript: list[dict], prompt: str) -> str:
    """
    文字起こしをテキスト分析（従来方式）

    Args:
        transcript: 文字起こし結果のリスト
        prompt: 分析プロンプト

    Returns:
        分析結果（テキスト）
    """
    # 話者ごとの発言を整形
    full_text = "\n".join([f"[{t['speaker']}] {t['text']}" for t in transcript])

    logger.info(f"Analyzing transcript with {len(transcript)} segments (text)...")

    client = get_openai_client()
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": "あなたは会議分析の専門家です。正確で簡潔な分析を提供してください。",
            },
            {"role": "user", "content": f"{prompt}\n\n文字起こし:\n{full_text}"},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content or ""


def save_to_dynamodb(
    interview_id: str,
    segment: str,
    analysis_key: str,
    transcript_key: str,
    total_score: int | None = None,
    video_key: str | None = None,
    diarization_key: str | None = None,
) -> None:
    """
    分析結果を DynamoDB に更新（既存レコードを保持）

    Args:
        interview_id: インタビュー ID
        segment: セグメント (A/B/C/D)
        analysis_key: 分析結果の S3 キー
        transcript_key: 文字起こしファイルの S3 キー
        total_score: 総合スコア（オプション）
        video_key: 動画ファイルの S3 キー（オプション）
        diarization_key: 話者分離ファイルの S3 キー（オプション）
    """
    if not TABLE_NAME:
        logger.info("TABLE_NAME not configured, skipping DynamoDB save")
        return

    updated_at = datetime.now(timezone.utc).isoformat()

    # UpdateExpression を動的に構築
    update_parts = [
        "analysis_key = :analysis_key",
        "transcript_key = :transcript_key",
        "updated_at = :updated_at",
        "#status = :status",
        "progress = :progress",
        "current_step = :current_step",
    ]
    expression_values: dict[str, Any] = {
        ":analysis_key": {"S": analysis_key},
        ":transcript_key": {"S": transcript_key},
        ":updated_at": {"S": updated_at},
        ":status": {"S": "completed"},
        ":progress": {"N": "100"},
        ":current_step": {"S": "completed"},
    }
    expression_names = {"#status": "status"}

    # セグメントを更新（HEMS からLLM分析結果のセグメントに更新しない - segment は入力時に設定されるため）
    # segment フィールドはユーザー入力のセグメント種別なので更新しない

    if total_score is not None:
        update_parts.append("total_score = :total_score")
        expression_values[":total_score"] = {"N": str(total_score)}

    if diarization_key:
        update_parts.append("diarization_key = :diarization_key")
        expression_values[":diarization_key"] = {"S": diarization_key}

    update_expression = "SET " + ", ".join(update_parts)

    logger.info(f"Updating DynamoDB table {TABLE_NAME}: interview_id={interview_id}")
    dynamodb.update_item(
        TableName=TABLE_NAME,
        Key={"interview_id": {"S": interview_id}},
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_values,
        ExpressionAttributeNames=expression_names,
    )
    logger.info("Successfully updated DynamoDB")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Lambda ハンドラー

    Args:
        event: Lambda イベント
            - bucket: S3 バケット名
            - transcript_key: 文字起こしファイルのキー
            - prompt: 分析プロンプト（オプション）
            - structured: 構造化出力を使用するか（オプション、デフォルト: True）
        context: Lambda コンテキスト

    Returns:
        処理結果
            - bucket: 出力バケット名
            - analysis_key: 分析結果ファイルのキー
            - structured_data: 構造化データ（structured=True の場合）
    """
    logger.info(f"Event: {event}")

    bucket = event["bucket"]
    transcript_key = event["transcript_key"]
    prompt = event.get("prompt", DEFAULT_PROMPT)
    use_structured = event.get("structured", True)  # デフォルトで構造化出力を使用

    # DynamoDB 保存用のオプションパラメータ
    interview_id = event.get("interview_id")
    video_key = event.get("video_key")
    diarization_key = event.get("diarization_key")

    # 進捗更新
    if interview_id:
        update_progress(interview_id, "analyzing")

    # S3 から文字起こしを取得
    logger.info(f"Getting transcript from s3://{bucket}/{transcript_key}")
    response = s3.get_object(Bucket=bucket, Key=transcript_key)
    transcript = json.loads(response["Body"].read().decode("utf-8"))

    # 出力バケットを決定
    output_bucket = OUTPUT_BUCKET if OUTPUT_BUCKET else bucket

    # 出力キーのベース名
    base_key = transcript_key.rsplit("/", 1)[-1].rsplit(".", 1)[0]

    if use_structured:
        # 構造化分析を実行
        structured_data = analyze_transcript_structured(transcript)

        # JSON として保存
        analysis_key = f"analysis/{base_key.replace('_transcript', '')}_structured.json"
        json_content = structured_data.model_dump_json(indent=2, ensure_ascii=False)

        logger.info(f"Uploading structured analysis to s3://{output_bucket}/{analysis_key}")
        s3.put_object(
            Bucket=output_bucket,
            Key=analysis_key,
            Body=json_content.encode("utf-8"),
            ContentType="application/json; charset=utf-8",
        )

        # DynamoDB に更新（interview_id が指定されている場合）
        if interview_id:
            save_to_dynamodb(
                interview_id=interview_id,
                segment=structured_data.scoring.segment,
                analysis_key=analysis_key,
                transcript_key=transcript_key,
                total_score=structured_data.scoring.total_score,
                video_key=video_key,
                diarization_key=diarization_key,
            )

        return {
            "bucket": output_bucket,
            "analysis_key": analysis_key,
            "status": "completed",
            "structured": True,
            "total_score": structured_data.scoring.total_score,
            "segment": structured_data.scoring.segment,
        }
    else:
        # テキスト分析を実行（従来方式）
        result = analyze_transcript_text(transcript, prompt)

        analysis_key = f"analysis/{base_key.replace('_transcript', '')}_analysis.txt"

        logger.info(f"Uploading analysis to s3://{output_bucket}/{analysis_key}")
        s3.put_object(
            Bucket=output_bucket,
            Key=analysis_key,
            Body=result.encode("utf-8"),
            ContentType="text/plain; charset=utf-8",
        )

        return {
            "bucket": output_bucket,
            "analysis_key": analysis_key,
            "status": "completed",
            "structured": False,
        }
