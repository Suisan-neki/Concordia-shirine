"""
AWS Transcribe Streaming WebSocket endpoint

リアルタイム話者分離付き文字起こしAPI。
ブラウザから PCM 16kHz mono 16-bit の音声バイナリを受け取り、
AWS Transcribe Streaming に中継してスピーカーラベル付きの結果を返す。
"""
import asyncio
import json
import logging
import os
from typing import AsyncIterator

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcribe", tags=["transcribe"])

# AWS 設定
AWS_REGION = (
    os.environ.get("AWS_REGION")
    or os.environ.get("AWS_DEFAULT_REGION")
    or os.environ.get("COGNITO_REGION")
    or "ap-northeast-1"
)
SAMPLE_RATE = 16000
LANGUAGE_CODE = "ja-JP"


async def _stream_audio(audio_queue: asyncio.Queue) -> AsyncIterator[bytes]:
    """audio_queue から chunk を取り出してジェネレーターとして返す"""
    while True:
        chunk = await audio_queue.get()
        if chunk is None:
            break
        yield chunk


async def _run_transcribe(websocket: WebSocket, audio_queue: asyncio.Queue) -> None:
    """
    AWS Transcribe Streaming を実行して結果を WebSocket に送信する。
    amazon-transcribe Python SDK を使用。
    """
    try:
        from amazon_transcribe.client import TranscribeStreamingClient
        from amazon_transcribe.handlers import TranscriptResultStreamHandler
        from amazon_transcribe.model import TranscriptEvent
    except ImportError:
        logger.error("amazon-transcribe SDK not installed. Run: pip install amazon-transcribe")
        await websocket.send_json({
            "type": "error",
            "message": "amazon-transcribe SDK not installed on server"
        })
        return

    client = TranscribeStreamingClient(region=AWS_REGION)

    stream = await client.start_stream_transcription(
        language_code=LANGUAGE_CODE,
        media_sample_rate_hz=SAMPLE_RATE,
        media_encoding="pcm",
        enable_speaker_identification=True,
        number_of_speakers=10,  # 最大話者数
        show_speaker_label=True,
    )

    class ConcordiaHandler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, transcript_event: TranscriptEvent):
            transcript = transcript_event.transcript
            for result in transcript.results:
                if not result.alternatives:
                    continue
                alt = result.alternatives[0]

                # スピーカーアイテムを抽出
                speaker_items = []
                if alt.items:
                    for item in alt.items:
                        if item.speaker is not None:
                            speaker_items.append({
                                "speaker": item.speaker,
                                "content": item.content,
                                "type": item.type,
                                "start_time": item.start_time,
                                "end_time": item.end_time,
                            })

                payload = {
                    "type": "transcript",
                    "text": alt.transcript,
                    "is_partial": result.is_partial,
                    "result_id": result.result_id,
                    "speaker_items": speaker_items,
                }
                try:
                    await websocket.send_json(payload)
                except Exception:
                    pass  # WebSocket closed

    handler = ConcordiaHandler(stream.output_stream)

    async def send_audio():
        """audio_queue から AWS Transcribe に音声を送信"""
        async for chunk in _stream_audio(audio_queue):
            await stream.input_stream.send_audio_event(audio_chunk=chunk)
        await stream.input_stream.end_stream()

    # 送信とハンドラーを並行実行
    await asyncio.gather(send_audio(), handler.handle_events())


@router.websocket("/ws")
async def transcribe_ws(websocket: WebSocket):
    """
    WebSocket エンドポイント。

    フロントエンドから PCM 16kHz mono 16-bit バイナリチャンクを受信し、
    AWS Transcribe Streaming に転送してスピーカーラベル付き文字起こし結果を返す。

    送信フォーマット（サーバー → クライアント）:
    {
      "type": "transcript",
      "text": str,
      "is_partial": bool,
      "result_id": str,
      "speaker_items": [
        {"speaker": "spk_0", "content": str, "type": str, "start_time": float, "end_time": float}
      ]
    }
    """
    await websocket.accept()
    logger.info("Transcribe WebSocket connected")

    audio_queue: asyncio.Queue = asyncio.Queue(maxsize=200)

    # AWS Transcribe を別タスクで開始
    transcribe_task = asyncio.create_task(_run_transcribe(websocket, audio_queue))

    try:
        while True:
            data = await websocket.receive()
            if "bytes" in data and data["bytes"]:
                await audio_queue.put(data["bytes"])
            elif "text" in data:
                # JSON コマンドの受信（例: {"type": "stop"}）
                try:
                    msg = json.loads(data["text"])
                    if msg.get("type") == "stop":
                        break
                except json.JSONDecodeError:
                    pass
    except WebSocketDisconnect:
        logger.info("Transcribe WebSocket disconnected")
    finally:
        # ストリーム終了シグナルを送信
        await audio_queue.put(None)
        try:
            await asyncio.wait_for(transcribe_task, timeout=5.0)
        except asyncio.TimeoutError:
            transcribe_task.cancel()
        logger.info("Transcribe WebSocket cleaned up")
