import queue
from typing import Generator, Optional

import sounddevice as sd

from src.util.logging import get_logger


class MicStream:
    """Push microphone frames into an internal queue for pull-based consumption."""

    def __init__(self, sample_rate: int, frame_duration_sec: float, device_index: Optional[int] = None):
        self.sample_rate = sample_rate
        self.frame_duration_sec = frame_duration_sec
        self.frame_size = int(sample_rate * frame_duration_sec)
        self.device_index = device_index
        self._queue: "queue.Queue[bytes]" = queue.Queue(maxsize=20)
        self._stream: Optional[sd.RawInputStream] = None
        self._log = get_logger("audio.mic_stream")

    def _callback(self, indata, frames, time_info, status):
        if status:
            self._log.debug("Stream status: %s", status)
        try:
            self._queue.put_nowait(bytes(indata))
        except queue.Full:
            # Drop frames if consumer is slow.
            pass

    def __enter__(self):
        self._stream = sd.RawInputStream(
            samplerate=self.sample_rate,
            blocksize=self.frame_size,
            dtype="int16",
            channels=1,
            callback=self._callback,
            device=self.device_index,
        )
        self._stream.start()
        self._log.info("Mic stream started (rate=%s, frame_size=%s, device=%s)", self.sample_rate, self.frame_size, self.device_index)
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._log.info("Mic stream stopped")

    def frames(self) -> Generator[bytes, None, None]:
        """Yield audio frames as bytes (PCM 16-bit mono)."""
        while True:
            frame = self._queue.get()
            yield frame

    def get_frame(self, timeout: Optional[float] = None) -> Optional[bytes]:
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            return None
