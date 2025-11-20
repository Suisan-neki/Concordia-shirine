#!/usr/bin/env bash
set -euo pipefail

# Simple helper to run the container on Linux with X11 + ALSA.

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH." >&2
  exit 1
fi

# Allow local docker to access X server (Linux/X11)
if command -v xhost >/dev/null 2>&1; then
  xhost +local:docker >/dev/null
else
  echo "xhost command not found; please install (e.g., 'sudo apt install x11-xserver-utils')." >&2
  exit 1
fi

docker build -t concordia-shrine .
docker run --rm -it \
  --env DISPLAY="$DISPLAY" \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  --device /dev/snd \
  concordia-shrine
