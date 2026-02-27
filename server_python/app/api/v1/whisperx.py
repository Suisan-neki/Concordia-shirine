
import asyncio
import logging
import os
import tempfile
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whisperx", tags=["whisperx"])

class SpeakerItem(BaseModel):
    speaker: str
    content: str
    start_time: float
    end_time: float

class DiarizationResult(BaseModel):
    text: str
    speaker_items: List[SpeakerItem]

@router.post("/diarize", response_model=DiarizationResult)
async def diarize_audio(audio_file: UploadFile = File(...)):
    """
    WhisperX を使用して音声ファイルの話者分離と文字起こしを実行します。
    """
    if not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only audio files are supported.")

    try:
        import whisperx
        import torch
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="WhisperX is not installed. Install with: pip install whisperx",
        ) from exc

    # 一時ファイルに音声を保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_audio_file:
        contents = await audio_file.read()
        tmp_audio_file.write(contents)
        tmp_audio_file_path = tmp_audio_file.name

    try:
        # WhisperX のモデルをロード
        # デバイスは自動判別 (CPU/GPU/MPS)
        device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        batch_size = 16 # reduce if low on GPU mem
        compute_type = "float16" if device == "cuda" else "int8" # change to "int8" if low on GPU mem (may reduce accuracy)

        model = whisperx.load_model("large-v2", device, compute_type=compute_type)

        # 音声のロード
        audio = whisperx.load_audio(tmp_audio_file_path)

        # 文字起こし
        result = model.transcribe(audio, batch_size=batch_size)

        # アライメント
        model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
        result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)

        # 話者分離
        diarize_model = whisperx.DiarizationPipeline(use_auth_token=None, device=device)
        diarize_segments = diarize_model(audio)
        result = whisperx.assign_word_speakers(diarize_segments, result)

        full_transcript = ""
        speaker_items = []

        for segment in result["segments"]:
            if "speaker" in segment:
                full_transcript += f"[{segment['speaker']}] {segment['text']}\n"
                speaker_items.append(
                    SpeakerItem(
                        speaker=segment["speaker"],
                        content=segment["text"],
                        start_time=segment["start"],
                        end_time=segment["end"],
                    )
                )
            else:
                full_transcript += f"{segment['text']}\n"
                speaker_items.append(
                    SpeakerItem(
                        speaker="UNKNOWN", # 話者情報がない場合
                        content=segment["text"],
                        start_time=segment["start"],
                        end_time=segment["end"],
                    )
                )

        return DiarizationResult(text=full_transcript, speaker_items=speaker_items)

    except Exception as e:
        logger.error(f"WhisperX diarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"WhisperX diarization failed: {e}")
    finally:
        # 一時ファイルを削除
        os.remove(tmp_audio_file_path)

