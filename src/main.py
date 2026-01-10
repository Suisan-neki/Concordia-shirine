import sys
import time

from src.audio.event_detector import EventDetector
from src.audio.mic_stream import MicStream
from src.audio.vad import VoiceActivityDetector
from src.config.config_loader import load_config
from src.core.mapping import EffectOutput
from src.core.state_manager import StateManager
from src.output.sound_player import build_sound_player
from src.output.visuals import build_visual_adapter
from src.util.logging import setup_logging, get_logger


def main() -> int:
    setup_logging()
    log = get_logger("main")
    config = load_config()
    log.info("Config loaded")

    sample_rate = config["audio"]["sample_rate"]
    frame_duration = config["audio"]["frame_duration_sec"]
    aggressiveness = config["vad"]["aggressiveness"]
    cooldown = config["effects"]["cooldown_sec"]

    vad = VoiceActivityDetector(aggressiveness=aggressiveness)
    detector_params = dict(config["events"])
    detector_params["frame_duration_sec"] = frame_duration
    detector = EventDetector(detector_params)
    state = StateManager(cooldown)

    visual = build_visual_adapter(config["visuals"]["base_color_calm"], config["visuals"]["base_color_tense"])
    sound_player = build_sound_player(config["sound"])
    effect_output = EffectOutput(visual, sound_player)

    with MicStream(sample_rate, frame_duration, config["audio"]["device_index"]) as mic:
        start = time.time()
        last_is_speech = False
        while visual.is_running():
            now = time.time() - start
            frame = mic.get_frame(timeout=0.01)
            if frame:
                is_speech = vad.is_speech(frame, sample_rate)
                last_is_speech = is_speech
                events = detector.process(is_speech, now)
                for event in events:
                    if state.allow(event.timestamp):
                        effect_output.apply_effect(event)
                        state.mark(event.timestamp)
            visual.update_base_state(last_is_speech, now)
            visual.render(now)
    log.info("Exiting Concordia Shrine prototype")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
