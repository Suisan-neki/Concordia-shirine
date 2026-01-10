import collections
from dataclasses import dataclass
from typing import Deque, Dict, List, Optional

from src.util.logging import get_logger


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
        self.window_buffer: Deque = collections.deque()
        self.last_label: Optional[bool] = None
        self._log = get_logger("audio.event_detector")

    def process(self, is_speech: bool, now: float) -> List[ConcordiaEvent]:
        events: List[ConcordiaEvent] = []

        # Update run lengths.
        frame_duration = self.params.get("frame_duration_sec", 0.02)
        if is_speech:
            self.speech_run_length += frame_duration
            self.silence_run_length = 0.0
        else:
            self.silence_run_length += frame_duration
            self.speech_run_length = 0.0

        # Track switches in the recent window.
        if self.last_label is not None and self.last_label != is_speech:
            self.switch_count_recent += 1
        self.last_label = is_speech
        self.window_buffer.append((now, is_speech))

        # Drop old entries.
        window_sec = self.params["overlap_window_sec"]
        while self.window_buffer and now - self.window_buffer[0][0] > window_sec:
            old_label = self.window_buffer.popleft()[1]
            # When removing an edge, we cannot accurately decrement switches; conservative approach keeps count from new window.
        # Recompute switch_count_recent from window_buffer for accuracy.
        self.switch_count_recent = sum(
            1 for i in range(1, len(self.window_buffer)) if self.window_buffer[i][1] != self.window_buffer[i - 1][1]
        )

        # Detect events.
        if self.silence_run_length >= self.params["silence_long_sec"]:
            events.append(ConcordiaEvent("SilenceLong", now, {"duration": self.silence_run_length}))
        if self.speech_run_length >= self.params["monologue_long_sec"]:
            events.append(ConcordiaEvent("MonologueLong", now, {"duration": self.speech_run_length}))
        if self.switch_count_recent >= self.params["overlap_switch_threshold"]:
            events.append(ConcordiaEvent("OverlapBurst", now, {"switches": self.switch_count_recent}))

        # StableCalm: sustained balanced interaction without the other triggers.
        if not events and now >= self.params["stable_min_duration_sec"]:
            # Only emit when last change was calm window without triggering others.
            # A lightweight heuristic: minimal switches but not zero, and shorter run lengths.
            if 1 <= self.switch_count_recent <= self.params["overlap_switch_threshold"] // 2:
                if self.speech_run_length < self.params["monologue_long_sec"] and self.silence_run_length < self.params["silence_long_sec"]:
                    events.append(ConcordiaEvent("StableCalm", now, {}))

        return events
