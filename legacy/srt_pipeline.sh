#!/bin/bash

# Complete SRT-Based Music Video Production Pipeline
# Workflow: SRT → AI Prompts → Generate Images → Assemble Video

set -e  # Exit on error

echo "=========================================="
echo "SRT-Based Music Video Pipeline"
echo "=========================================="
echo ""

show_usage() {
    echo "Usage: $0 <song.srt> <audio.wav> <output_name> <api_provider> <api_key> [suno_style.txt] [base_style]"
    echo ""
    echo "Arguments:"
    echo "  song.srt        - Pre-timed subtitle file with lyrics"
    echo "  audio.wav       - High-quality audio file"
    echo "  output_name     - Base name for outputs (e.g., 'My_Song')"
    echo "  api_provider    - 'grok' or 'openai'"
    echo "  api_key         - Your API key (or set XAI_API_KEY/OPENAI_API_KEY env var)"
    echo "  suno_style.txt  - Optional: Your Suno prompt/style file"
    echo "  base_style      - Optional: Base visual style (default: 'photorealistic, cinematic')"
    echo ""
    echo "Example:"
    echo "  $0 mysong.srt mysong.wav 'My_Song' openai sk-xxxxx suno_prompt.txt 'cinematic'"
    echo ""
    echo "Environment Variables (alternative to passing API key):"
    echo "  XAI_API_KEY     - For Grok"
    echo "  OPENAI_API_KEY  - For OpenAI"
    echo ""
    echo "Outputs:"
    echo "  - {output_name}_prompts.json  - AI prompts for each scene"
    echo "  - {output_name}_images/       - Generated images directory"
    echo "  - {output_name}_HD.mp4        - Final YouTube video"
    echo "  - {output_name}.srt           - Copy of subtitle file"
    echo ""
    exit 1
}

if [ "$#" -lt 4 ]; then
    show_usage
fi

SRT_FILE="$1"
AUDIO_FILE="$2"
OUTPUT_NAME="$3"
API_PROVIDER="$4"
API_KEY="${5:-}"
SUNO_STYLE_FILE="${6:-}"
BASE_STYLE="${7:-photorealistic, cinematic}"

# Check for API key in environment if not provided
if [ -z "$API_KEY" ]; then
    if [ "$API_PROVIDER" = "grok" ]; then
        API_KEY="${XAI_API_KEY:-}"
    elif [ "$API_PROVIDER" = "openai" ]; then
        API_KEY="${OPENAI_API_KEY:-}"
    fi
fi

if [ -z "$API_KEY" ]; then
    echo "❌ Error: No API key provided"
    echo "   Either pass as argument or set ${API_PROVIDER^^}_API_KEY environment variable"
    exit 1
fi

# Define output paths
PROMPTS_FILE="${OUTPUT_NAME}_prompts.json"
IMAGES_DIR="${OUTPUT_NAME}_images"
OUTPUT_VIDEO="${OUTPUT_NAME}_HD.mp4"
OUTPUT_SRT="${OUTPUT_NAME}.srt"

echo "Configuration:"
echo "  SRT File: $SRT_FILE"
echo "  Audio: $AUDIO_FILE"
echo "  Output Base: $OUTPUT_NAME"
echo "  API Provider: $API_PROVIDER"
echo "  Suno Style File: ${SUNO_STYLE_FILE:-<none>}"
echo "  Base Style: $BASE_STYLE"
echo ""
echo "Outputs will be:"
echo "  - $PROMPTS_FILE"
echo "  - $IMAGES_DIR/"
echo "  - $OUTPUT_VIDEO"
echo "  - $OUTPUT_SRT"
echo ""

# Validate inputs
if [ ! -f "$SRT_FILE" ]; then
    echo "❌ Error: SRT file not found: $SRT_FILE"
    exit 1
fi

if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found: $AUDIO_FILE"
    exit 1
fi

if [ "$API_PROVIDER" != "grok" ] && [ "$API_PROVIDER" != "openai" ]; then
    echo "❌ Error: API provider must be 'grok' or 'openai'"
    exit 1
fi

read -p "Continue with production? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "=========================================="
echo "STEP 1: Parse SRT and Generate Prompts"
echo "=========================================="
echo ""

if [ -n "$SUNO_STYLE_FILE" ]; then
    ./srt_to_prompts.py "$SRT_FILE" "$PROMPTS_FILE" "$SUNO_STYLE_FILE" "$BASE_STYLE"
else
    ./srt_to_prompts.py "$SRT_FILE" "$PROMPTS_FILE" "" "$BASE_STYLE"
fi

if [ ! -f "$PROMPTS_FILE" ]; then
    echo "❌ Error: Failed to generate prompts file"
    exit 1
fi

echo ""
echo "=========================================="
echo "STEP 2: Generate Images via AI"
echo "=========================================="
echo ""
echo "⚠️  This will make API calls and may incur costs!"
echo "   Check the prompts in $PROMPTS_FILE first if you want to review them."
echo ""

read -p "Proceed with image generation? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopped before image generation."
    echo "You can review $PROMPTS_FILE and run the image generator manually:"
    echo "  ./generate_images.py $PROMPTS_FILE $IMAGES_DIR $API_PROVIDER $API_KEY"
    exit 0
fi

./generate_images.py "$PROMPTS_FILE" "$IMAGES_DIR" "$API_PROVIDER" "$API_KEY"

echo ""
echo "=========================================="
echo "STEP 3: Assemble Final Video"
echo "=========================================="
echo ""

./assemble_video.py "$PROMPTS_FILE" "$IMAGES_DIR" "$AUDIO_FILE" "$OUTPUT_VIDEO"

echo ""
echo "=========================================="
echo "STEP 4: Copy Subtitle File"
echo "=========================================="
echo ""

cp "$SRT_FILE" "$OUTPUT_SRT"
echo "✓ Copied SRT file to: $OUTPUT_SRT"

echo ""
echo "=========================================="
echo "✅ PRODUCTION COMPLETE!"
echo "=========================================="
echo ""
echo "YouTube Upload Package:"
echo ""
echo "  🎥 Video:     $OUTPUT_VIDEO"
if [ -f "$OUTPUT_VIDEO" ]; then
    VIDEO_SIZE=$(du -h "$OUTPUT_VIDEO" | cut -f1)
    echo "      Size: $VIDEO_SIZE"
    echo "      Resolution: 1920x1080 (Full HD)"
fi
echo ""
echo "  📄 Subtitles: $OUTPUT_SRT"
echo ""
echo "  🖼️  Images:    $IMAGES_DIR/ ($(find "$IMAGES_DIR" -type f 2>/dev/null | wc -l) files)"
echo ""
echo "  📋 Prompts:   $PROMPTS_FILE"
echo ""
echo "Next steps:"
echo "  1. Preview $OUTPUT_VIDEO to verify quality"
echo "  2. Upload to YouTube"
echo "  3. Add $OUTPUT_SRT as captions"
echo ""
