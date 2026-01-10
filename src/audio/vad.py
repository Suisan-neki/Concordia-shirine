from typing import Optional

import numpy as np

from src.util.logging import get_logger

try:
    import webrtcvad  # type: ignore
except ImportError:  # pragma: no cover
    webrtcvad = None


class VoiceActivityDetector:
    """Wrapper over WebRTC VAD with a tiny energy fallback."""

    def __init__(self, aggressiveness: int = 2, energy_threshold: int = 500):
        self.aggressiveness = aggressiveness
        self.energy_threshold = energy_threshold
        self._log = get_logger("audio.vad")
        self._vad: Optional[object] = None
        if webrtcvad:
            self._vad = webrtcvad.Vad(aggressiveness)
            self._log.info("WebRTC VAD initialized (aggressiveness=%s)", aggressiveness)
        else:
            self._log.warning("webrtcvad not installed; using simple energy VAD fallback")

    def is_speech(self, frame: bytes, sample_rate: int) -> bool:
        if self._vad:
            try:
                return bool(self._vad.is_speech(frame, sample_rate))
            except Exception as exc:  # pragma: no cover
                self._log.error("VAD error, falling back to energy detection: %s", exc)
        # Fallback: simple RMS threshold.
        pcm = np.frombuffer(frame, dtype=np.int16)
        energy = np.sqrt(np.mean(np.square(pcm.astype(np.float32))))
        return energy > self.energy_threshold
