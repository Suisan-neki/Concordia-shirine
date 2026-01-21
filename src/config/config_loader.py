import copy
import json
import pathlib
from typing import Any, Dict, Optional

import yaml

DEFAULT_CONFIG: Dict[str, Any] = {
    "audio": {
        "device_index": None,
        "sample_rate": 16000,
        "frame_duration_sec": 0.02,
    },
    "vad": {
        "aggressiveness": 2,
    },
    "events": {
        "silence_long_sec": 12.0,
        "monologue_long_sec": 30.0,
        "overlap_window_sec": 5.0,
        "overlap_switch_threshold": 8,
        "stable_min_duration_sec": 15.0,
    },
    "effects": {
        "cooldown_sec": 10.0,
    },
    "visuals": {
        "base_color_calm": "#66ccff",
        "base_color_tense": "#ffcc66",
    },
    "sound": {
        "enabled": False,
        "base_dir": "sounds",
    },
}


def deep_update(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    result = copy.deepcopy(base)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_update(result[key], value)
        else:
            result[key] = value
    return result


def load_config(path: Optional[str] = None) -> Dict[str, Any]:
    config_path = pathlib.Path(path or "config.yaml")
    if not config_path.exists():
        return DEFAULT_CONFIG
    with config_path.open("r", encoding="utf-8") as f:
        if config_path.suffix.lower() in {".yaml", ".yml"}:
            loaded = yaml.safe_load(f) or {}
        else:
            loaded = json.load(f)
    return deep_update(DEFAULT_CONFIG, loaded)
