"""Download pyannote models at build time."""
import os
import torch

# PyTorch 2.6+ の weights_only=True デフォルトを無効化
# pyannote の HuggingFace チェックポイントは信頼できるソースなので問題なし
_orig_torch_load = torch.load


def _torch_load_legacy(*args, **kwargs):
    """torch.load を常に weights_only=False で呼び出す"""
    kwargs["weights_only"] = False
    return _orig_torch_load(*args, **kwargs)


torch.load = _torch_load_legacy  # pyannote import 前に適用

from pyannote.audio import Model, Pipeline

hf_token = os.environ.get("HF_TOKEN", "")

print("Downloading speaker-diarization-3.1...")
Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=hf_token)
print("Speaker diarization pipeline downloaded successfully")

print("Downloading pyannote/embedding...")
Model.from_pretrained("pyannote/embedding", token=hf_token)
print("Embedding model downloaded successfully")

print("All models downloaded successfully")
