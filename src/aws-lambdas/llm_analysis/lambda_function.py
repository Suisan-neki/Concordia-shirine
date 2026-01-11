"""
LLMAnalysis Lambda Function

OpenAI API (gpt-4o-mini) を使用して文字起こし結果を分析する。
Structured Outputs を使用して Concordia インタビューデータを構造化抽出。

Class-based implementation for better state management and testing.

Version: 4.0 - OOP Refactoring
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import boto3
import openai
from tenacity import retry, stop_after_attempt, wait_exponential

from models import ConcordiaAnalysisData
from progress import update_progress

# ロガー設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class ConcordiaAnalyzer:
    """
    Concordia 分析ロジックをカプセル化するクラス
    """
    def __init__(self):
        self.output_bucket = os.environ.get("OUTPUT_BUCKET", "")
        self.openai_api_key = os.environ.get("OPENAI_API_KEY", "")
        self.openai_model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.table_name = os.environ.get("TABLE_NAME", "")
        
        # AWS Clients (Lazy initialization could be better but straightforward here)
        self.s3 = boto3.client("s3")
        self.dynamodb = boto3.client("dynamodb")
        
        self._openai_client: Optional[openai.OpenAI] = None
        
        # システムプロンプト定義
        self.CONCORDIA_SYSTEM_PROMPT = """あなたはコミュニケーション分析の専門家です。
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

    @property
    def openai_client(self) -> openai.OpenAI:
        """OpenAI クライアントを取得（シングルトン）"""
        if self._openai_client is None:
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self._openai_client = openai.OpenAI(api_key=self.openai_api_key)
            logger.info("OpenAI client initialized")
        return self._openai_client

    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(3),
    )
    def analyze_structured(self, transcript: list[dict]) -> ConcordiaAnalysisData:
        """
        文字起こしを構造化分析（Structured Outputs 使用）
        """
        # 話者ごとの発言を整形
        full_text = "\n".join([f"[{t['speaker']}] {t['text']}" for t in transcript])
        logger.info(f"Analyzing transcript with {len(transcript)} segments (structured)...")

        completion = self.openai_client.beta.chat.completions.parse(
            model=self.openai_model,
            messages=[
                {"role": "system", "content": self.CONCORDIA_SYSTEM_PROMPT},
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
    def analyze_text(self, transcript: list[dict], prompt: str) -> str:
        """
        文字起こしをテキスト分析（従来方式）
        """
        full_text = "\n".join([f"[{t['speaker']}] {t['text']}" for t in transcript])
        logger.info(f"Analyzing transcript with {len(transcript)} segments (text)...")

        response = self.openai_client.chat.completions.create(
            model=self.openai_model,
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
        self,
        interview_id: str,
        analysis_key: str,
        transcript_key: str,
        total_score: Optional[int] = None,
        diarization_key: Optional[str] = None,
    ) -> None:
        """
        分析結果を DynamoDB に更新
        """
        if not self.table_name:
            logger.info("TABLE_NAME not configured, skipping DynamoDB save")
            return

        updated_at = datetime.now(timezone.utc).isoformat()

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

        if total_score is not None:
            update_parts.append("total_score = :total_score")
            expression_values[":total_score"] = {"N": str(total_score)}

        if diarization_key:
            update_parts.append("diarization_key = :diarization_key")
            expression_values[":diarization_key"] = {"S": diarization_key}

        update_expression = "SET " + ", ".join(update_parts)

        logger.info(f"Updating DynamoDB table {self.table_name}: interview_id={interview_id}")
        self.dynamodb.update_item(
            TableName=self.table_name,
            Key={"interview_id": {"S": interview_id}},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ExpressionAttributeNames=expression_names,
        )
        logger.info("Successfully updated DynamoDB")

    def process_event(self, event: dict[str, Any], context: Any) -> dict[str, Any]:
        """
        イベント処理のメインロジック
        """
        logger.info(f"Event: {event}")

        bucket = event["bucket"]
        transcript_key = event["transcript_key"]
        prompt = event.get("prompt", "以下の会議の文字起こしを分析し、コンコルディア分析フォーマットで出力してください。")
        use_structured = event.get("structured", True)
        
        # オプションパラメータ
        interview_id = event.get("interview_id")
        video_key = event.get("video_key") # 未使用だが互換性のため維持
        diarization_key = event.get("diarization_key")

        # 進捗更新
        if interview_id:
            update_progress(interview_id, "analyzing")

        # S3 から文字起こしを取得
        logger.info(f"Getting transcript from s3://{bucket}/{transcript_key}")
        response = self.s3.get_object(Bucket=bucket, Key=transcript_key)
        transcript = json.loads(response["Body"].read().decode("utf-8"))

        # 出力バケット
        output_bucket = self.output_bucket if self.output_bucket else bucket
        
        # 出力キーのベース名
        base_key = transcript_key.rsplit("/", 1)[-1].rsplit(".", 1)[0]

        if use_structured:
            # 構造化分析
            structured_data = self.analyze_structured(transcript)
            
            # JSON 保存
            analysis_key = f"analysis/{base_key.replace('_transcript', '')}_structured.json"
            json_content = structured_data.model_dump_json(indent=2, ensure_ascii=False)
            
            logger.info(f"Uploading structured analysis to s3://{output_bucket}/{analysis_key}")
            self.s3.put_object(
                Bucket=output_bucket,
                Key=analysis_key,
                Body=json_content.encode("utf-8"),
                ContentType="application/json; charset=utf-8",
            )
            
            # DynamoDB 更新
            if interview_id:
                self.save_to_dynamodb(
                    interview_id=interview_id,
                    analysis_key=analysis_key,
                    transcript_key=transcript_key,
                    total_score=structured_data.scoring.total_score,
                    diarization_key=diarization_key
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
            # テキスト分析
            result = self.analyze_text(transcript, prompt)
            
            analysis_key = f"analysis/{base_key.replace('_transcript', '')}_analysis.txt"
            
            logger.info(f"Uploading analysis to s3://{output_bucket}/{analysis_key}")
            self.s3.put_object(
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

# Global Instance (Lambda Cold Start Optimization)
analyzer = ConcordiaAnalyzer()

def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    AWS Lambda Entry point
    """
    return analyzer.process_event(event, context)
