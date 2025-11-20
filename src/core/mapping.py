from dataclasses import dataclass
from typing import Optional

from src.audio.event_detector import ConcordiaEvent
from src.output.sound_player import SoundEffect, SoundPlayer
from src.output.visuals import VisualAdapter


@dataclass
class Effect:
    visual: Optional[str]
    sound: Optional[SoundEffect]


def map_event_to_effect(event: ConcordiaEvent) -> Effect:
    if event.type == "SilenceLong":
        return Effect("silence_long", SoundEffect("wind_soft.ogg", 0.7))
    if event.type == "MonologueLong":
        return Effect("monologue_long", SoundEffect("drip_double.ogg", 0.8))
    if event.type == "OverlapBurst":
        return Effect("overlap_burst", SoundEffect("wood_creak.ogg", 0.65))
    if event.type == "StableCalm":
        return Effect("stable_calm", None)
    return Effect(None, None)


class EffectOutput:
    def __init__(self, visual: VisualAdapter, sound_player: SoundPlayer):
        self.visual = visual
        self.sound_player = sound_player

    def apply_effect(self, event: ConcordiaEvent) -> None:
        effect = map_event_to_effect(event)
        if effect.visual:
            self.visual.trigger_effect(event, effect.visual)
        if effect.sound:
            self.sound_player.play(effect.sound)
