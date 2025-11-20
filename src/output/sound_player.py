import pathlib
from dataclasses import dataclass
from typing import Dict

from src.util.logging import get_logger

try:
    import pygame
except ImportError:  # pragma: no cover
    pygame = None


@dataclass
class SoundEffect:
    file: str
    volume: float = 1.0


class SoundPlayer:
    def __init__(self, base_dir: str, enabled: bool = True):
        self.base_dir = pathlib.Path(base_dir)
        self.enabled_flag = enabled
        self._log = get_logger("output.sound")
        self._sounds: Dict[str, object] = {}
        self._enabled = False
        if not enabled:
            self._log.info("Sound disabled via config")
            return
        if pygame:
            pygame.mixer.init()
            self._enabled = True
            self._log.info("pygame.mixer initialized (base_dir=%s)", self.base_dir)
        else:
            self._log.warning("pygame not installed; audio playback disabled")

    def _load(self, filename: str):
        if filename in self._sounds:
            return self._sounds[filename]
        path = self.base_dir / filename
        if not path.exists():
            self._log.warning("Sound file missing: %s", path)
            return None
        sound = pygame.mixer.Sound(str(path)) if pygame and self._enabled else None
        if sound:
            self._sounds[filename] = sound
        return sound

    def play(self, effect: SoundEffect) -> None:
        if not self._enabled or not pygame:
            return
        sound = self._load(effect.file)
        if not sound:
            return
        sound.set_volume(effect.volume)
        sound.play()


def build_sound_player(settings: Dict) -> SoundPlayer:
    enabled = bool(settings.get("enabled", True))
    base_dir = settings.get("base_dir", "sounds")
    return SoundPlayer(base_dir, enabled=enabled)
