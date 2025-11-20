from typing import Optional


class StateManager:
    """Tracks cooldown to prevent over-triggering."""

    def __init__(self, cooldown_sec: float):
        self.cooldown_sec = cooldown_sec
        self.last_event_at: Optional[float] = None

    def allow(self, now: float) -> bool:
        if self.last_event_at is None:
            return True
        return (now - self.last_event_at) >= self.cooldown_sec

    def mark(self, now: float) -> None:
        self.last_event_at = now
