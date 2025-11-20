FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

# System deps for pygame (SDL2) and sounddevice (PortAudio).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc pkg-config \
    libasound2 libasound2-dev \
    libportaudio2 portaudio19-dev \
    libsdl2-2.0-0 libsdl2-dev \
    libsdl2-mixer-2.0-0 libsdl2-mixer-dev \
    libsdl2-image-2.0-0 libsdl2-image-dev \
    libsdl2-ttf-2.0-0 libsdl2-ttf-dev \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV SDL_AUDIODRIVER=pulseaudio \
    PYTHONPATH=/app

CMD ["python", "-m", "src.main"]
