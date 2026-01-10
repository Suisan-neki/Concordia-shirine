import math
from typing import Tuple

from src.util.logging import get_logger

try:
    import pygame
except ImportError:  # pragma: no cover
    pygame = None


class VisualAdapter:
    def update_base_state(self, is_speech: bool, now: float) -> None:
        raise NotImplementedError

    def trigger_effect(self, event, effect_name: str) -> None:
        raise NotImplementedError

    def render(self, now: float) -> None:
        raise NotImplementedError

    def is_running(self) -> bool:
        raise NotImplementedError


class NullVisualAdapter(VisualAdapter):
    def __init__(self):
        self._running = True
        self._log = get_logger("output.visuals")
        self._log.warning("pygame not installed; visual output disabled")

    def update_base_state(self, is_speech: bool, now: float) -> None:
        pass

    def trigger_effect(self, event, effect_name: str) -> None:
        self._log.info("Effect: %s @%.2fs", effect_name, event.timestamp)

    def render(self, now: float) -> None:
        pass

    def is_running(self) -> bool:
        return self._running


class PygameVisualAdapter(VisualAdapter):
    def __init__(self, width: int = 900, height: int = 560, base_calm: str = "#66ccff", base_tense: str = "#ffcc66"):
        self.width = width
        self.height = height
        self.base_calm = self._parse_hex(base_calm)
        self.base_tense = self._parse_hex(base_tense)
        self.base_mix = 0.2  # 0 calm, 1 tense
        self.speech_energy = 0.0
        self.pulse_strength = 0.0
        self.pulse_color = (255, 255, 255)
        self.pulse_decay = 1.0
        self.flash_strength = 0.0
        self.flash_decay = 1.0
        self.running = True
        self._log = get_logger("output.visuals")

        pygame.init()
        self.screen = pygame.display.set_mode((self.width, self.height))
        pygame.display.set_caption("Concordia Shrine Prototype")
        self.clock = pygame.time.Clock()

    @staticmethod
    def _parse_hex(hex_str: str) -> Tuple[int, int, int]:
        hex_str = hex_str.lstrip("#")
        return tuple(int(hex_str[i : i + 2], 16) for i in (0, 2, 4))

    @staticmethod
    def _lerp_color(a: Tuple[int, int, int], b: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
        t = max(0.0, min(1.0, t))
        return tuple(int(x + (y - x) * t) for x, y in zip(a, b))

    def update_base_state(self, is_speech: bool, now: float) -> None:
        target = 0.7 if is_speech else 0.15
        # ease towards target
        self.base_mix = self.base_mix * 0.9 + target * 0.1
        # speech energy drives wave distortion
        if is_speech:
            self.speech_energy = min(1.0, self.speech_energy + 0.15)
        else:
            self.speech_energy *= 0.92

    def trigger_effect(self, event, effect_name: str) -> None:
        if effect_name == "silence_long":
            self.pulse_strength = 1.0
            self.pulse_color = (220, 240, 255)
            self.pulse_decay = 1.5
        elif effect_name == "monologue_long":
            self.pulse_strength = 1.0
            self.pulse_color = (180, 120, 220)
            self.pulse_decay = 1.0
        elif effect_name == "overlap_burst":
            self.flash_strength = 1.0
            self.flash_decay = 0.8
        elif effect_name == "stable_calm":
            self.base_mix = 0.2

    def render(self, now: float) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                self.running = False

        # Base color
        base_color = self._lerp_color(self.base_calm, self.base_tense, self.base_mix)
        self.screen.fill(base_color)

        # Breathing circle
        breath = (math.sin(now * 0.8) + 1) / 2  # 0..1
        radius = int(130 + 30 * breath + 25 * self.speech_energy)
        center = (self.width // 2, self.height // 2)
        pygame.draw.circle(self.screen, self._lerp_color(base_color, (255, 255, 255), 0.1), center, radius)

        # Speech reactive wave ring
        if self.speech_energy > 0.02:
            wave_phase = (math.sin(now * 3.0) + 1) / 2
            ring_radius = radius + int(40 * wave_phase * self.speech_energy)
            ring_alpha = int(120 * self.speech_energy)
            ring_surface = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
            pygame.draw.circle(ring_surface, (255, 255, 255, ring_alpha), center, ring_radius, width=4)
            self.screen.blit(ring_surface, (0, 0))

        # Pulse overlay
        if self.pulse_strength > 0.01:
            pulse_alpha = int(80 * self.pulse_strength)
            pulse_surface = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
            pygame.draw.circle(pulse_surface, (*self.pulse_color, pulse_alpha), center, radius + 30)
            self.screen.blit(pulse_surface, (0, 0))
            self.pulse_strength *= math.exp(-self.clock.get_time() / 1000.0 / self.pulse_decay)

        # Flash overlay
        if self.flash_strength > 0.01:
            flash_alpha = int(150 * self.flash_strength)
            flash_surface = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
            flash_surface.fill((255, 200, 120, flash_alpha))
            self.screen.blit(flash_surface, (0, 0))
            self.flash_strength *= math.exp(-self.clock.get_time() / 1000.0 / self.flash_decay)

        pygame.display.flip()
        self.clock.tick(60)

    def is_running(self) -> bool:
        return self.running


def build_visual_adapter(base_color_calm: str, base_color_tense: str) -> VisualAdapter:
    if pygame:
        return PygameVisualAdapter(base_calm=base_color_calm, base_tense=base_color_tense)
    return NullVisualAdapter()
