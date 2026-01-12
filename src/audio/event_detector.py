import collections
from dataclasses import dataclass
from typing import Deque, Dict, List, Tuple

from src.util.logging import get_logger

WindowEntry = Tuple[float, bool]


@dataclass
class ConcordiaEvent:
    type: str  # "SilenceLong" | "MonologueLong" | "OverlapBurst" | "StableCalm"
    timestamp: float
    metadata: Dict


class EventDetector:
    def __init__(self, params: Dict[str, float]):
        self.params = params
        self.speech_run_length = 0.0
        self.silence_run_length = 0.0
        self.switch_count_recent = 0
        self.window_buffer: Deque[WindowEntry] = collections.deque()
        self._log = get_logger("audio.event_detector")

    def process(self, is_speech: bool, now: float) -> List[ConcordiaEvent]:
        frame_duration = self.params.get("frame_duration_sec", 0.02)
        self._update_run_lengths(is_speech, frame_duration)
        self._update_window(is_speech, now)

        events = self._detect_events(now)
        if not events and self._is_stable_calm(now):
            events.append(ConcordiaEvent("StableCalm", now, {}))
        return events

    def _update_run_lengths(self, is_speech: bool, frame_duration: float) -> None:
        if is_speech:
            self.speech_run_length += frame_duration
            self.silence_run_length = 0.0
            return
        self.silence_run_length += frame_duration
        self.speech_run_length = 0.0

    def _update_window(self, is_speech: bool, now: float) -> None:
        self.window_buffer.append((now, is_speech))
        window_sec = self.params["overlap_window_sec"]
        while self.window_buffer and now - self.window_buffer[0][0] > window_sec:
            self.window_buffer.popleft()
        self.switch_count_recent = sum(
            1
            for idx in range(1, len(self.window_buffer))
            if self.window_buffer[idx][1] != self.window_buffer[idx - 1][1]
        )

    def _detect_events(self, now: float) -> List[ConcordiaEvent]:
        events: List[ConcordiaEvent] = []
        if self.silence_run_length >= self.params["silence_long_sec"]:
            events.append(ConcordiaEvent("SilenceLong", now, {"duration": self.silence_run_length}))
        if self.speech_run_length >= self.params["monologue_long_sec"]:
            events.append(ConcordiaEvent("MonologueLong", now, {"duration": self.speech_run_length}))
        if self.switch_count_recent >= self.params["overlap_switch_threshold"]:
            events.append(ConcordiaEvent("OverlapBurst", now, {"switches": self.switch_count_recent}))
        return events

    def _is_stable_calm(self, now: float) -> bool:
        if now < self.params["stable_min_duration_sec"]:
            return False
        if not (1 <= self.switch_count_recent <= self.params["overlap_switch_threshold"] // 2):
            return False
        if self.speech_run_length >= self.params["monologue_long_sec"]:
            return False
        return self.silence_run_length < self.params["silence_long_sec"]
