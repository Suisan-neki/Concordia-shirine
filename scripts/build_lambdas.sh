#!/bin/bash
set -e

# Configuration
PYTHON_VERSION="3.12"
PLATFORM="manylinux_2_17_aarch64"
LAMBDAS_DIR="src/aws-lambdas"

echo "Building Lambdas for Python $PYTHON_VERSION ($PLATFORM)..."

# Find all directories containing requirements.txt
find "$LAMBDAS_DIR" -name "requirements.txt" | while read requirements_file; do
    lambda_dir=$(dirname "$requirements_file")
    
    # Skip diarize directory as it's disabled/dummied and has heavy deps
    if [[ "$lambda_dir" == *"diarize"* ]]; then
        echo "Skipping $lambda_dir (disabled)..."
        continue
    fi
    
    echo "Processing $lambda_dir..."
    
    # Create dist directory
    DIST_DIR="$lambda_dir/dist"
    rm -rf "$DIST_DIR"
    mkdir -p "$DIST_DIR"
    
    # Copy source code to dist
    cp "$lambda_dir"/*.py "$DIST_DIR/"
    
    # Just standard pip install - dependencies are now lightweight (openai, requests)
    # We install to the DIST directory.
    
    # Prune existing deps in root if any (cleanup legacy)
    # find "$lambda_dir" -mindepth 1 -maxdepth 1 ! -name "lambda_function.py" ! -name "requirements.txt" ! -name "progress.py" ! -name "__init__.py" ! -name "dist" -exec rm -rf {} +
    
    pip3 install \
        --target "$DIST_DIR" \
        --implementation cp \
        --python-version 312 \
        --only-binary=:all: \
        --upgrade \
        -r "$requirements_file"
        
    # Cleanup clutter in dist
    find "$DIST_DIR" -type d -name "__pycache__" -exec rm -rf {} +
    rm -rf "$DIST_DIR"/*.dist-info
    rm -rf "$DIST_DIR"/*.egg-info
    
    # Prune boto3 just in case
    rm -rf "$DIST_DIR/boto3" "$DIST_DIR/botocore" "$DIST_DIR/s3transfer" "$DIST_DIR/jmespath"
        
    # Verify size
    du -sh "$DIST_DIR"

    # Special handling for extract_audio, chunk_audio, split_by_speaker: Add ffmpeg
    if [[ "$lambda_dir" == *"extract_audio"* ]] || [[ "$lambda_dir" == *"chunk_audio"* ]] || [[ "$lambda_dir" == *"split_by_speaker"* ]]; then
        echo "Downloading ffmpeg for extract_audio (ARM64)..."
        FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
        curl -L "$FFMPEG_URL" -o /tmp/ffmpeg.tar.xz
        tar xf /tmp/ffmpeg.tar.xz -C /tmp
        
        # Move binaries to lambda root or bin/
        # Lambda adds the root to PATH? No, typically /opt/bin or /var/task.
        # We'll put it in root and user needs to invoke with ./ffmpeg or add to PATH in python
        # But easier: put in 'bin' and update PATH env in Lambda or python code.
        # Let's put in root for simplicity of asset.
        cp /tmp/ffmpeg-*-arm64-static/ffmpeg "$lambda_dir/"
        cp /tmp/ffmpeg-*-arm64-static/ffprobe "$lambda_dir/"
        chmod +x "$lambda_dir/ffmpeg" "$lambda_dir/ffprobe"
        
        rm -rf /tmp/ffmpeg*
    fi
done

echo "Build complete."
