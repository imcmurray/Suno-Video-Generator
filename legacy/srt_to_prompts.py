#!/usr/bin/env python3
"""
SRT to AI Prompts Generator (with Suno Style Integration)
Parses an SRT subtitle file and generates image/video prompts for each segment
Uses the original Suno prompt/style to maintain consistent atmosphere

Handles Suno formatting conventions:
- (parentheses) = background vocals - excluded from image prompts
- [brackets] = structural markers (Intro, Instrumental, etc.) - handled specially
"""

import sys
import re
import json
from datetime import timedelta

def parse_timestamp(timestamp):
    """Convert SRT timestamp to seconds"""
    # Format: HH:MM:SS,mmm
    time_match = re.match(r'(\d{2}):(\d{2}):(\d{2}),(\d{3})', timestamp)
    if time_match:
        h, m, s, ms = map(int, time_match.groups())
        return h * 3600 + m * 60 + s + ms / 1000
    return 0

def parse_srt(srt_file):
    """Parse SRT file and extract timing + text"""
    with open(srt_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by double newlines to get each subtitle block
    blocks = re.split(r'\n\s*\n', content.strip())
    
    segments = []
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 3:
            continue
        
        # Line 0: sequence number
        # Line 1: timestamps
        # Line 2+: text
        timestamp_line = lines[1]
        text = ' '.join(lines[2:])
        
        # Parse timestamps
        match = re.match(r'([\d:,]+)\s*-->\s*([\d:,]+)', timestamp_line)
        if match:
            start_ts, end_ts = match.groups()
            start_sec = parse_timestamp(start_ts)
            end_sec = parse_timestamp(end_ts)
            duration = end_sec - start_sec
            
            segments.append({
                'start': start_sec,
                'end': end_sec,
                'duration': duration,
                'text': text.strip()
            })
    
    return segments

def load_suno_style(style_file):
    """Load the Suno prompt/style file"""
    try:
        with open(style_file, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        return content
    except FileNotFoundError:
        print(f"⚠️  Warning: Style file '{style_file}' not found. Proceeding without style context.")
        return ""

def extract_style_elements(suno_style):
    """
    Extract key visual/atmospheric elements from Suno style text
    This helps create consistent visual themes
    """
    if not suno_style:
        return {}
    
    elements = {
        'genre': '',
        'mood': '',
        'atmosphere': '',
        'visual_keywords': []
    }
    
    # Common genre/style keywords that translate visually
    genre_map = {
        'electronic': 'neon, digital, futuristic',
        'synthwave': 'retro-futuristic, neon, 80s aesthetic, purple and pink',
        'rock': 'dynamic, energetic, gritty',
        'metal': 'dark, intense, dramatic lighting',
        'jazz': 'moody, noir, sophisticated',
        'classical': 'elegant, timeless, refined',
        'folk': 'natural, organic, earthy',
        'country': 'rustic, americana, warm tones',
        'hip-hop': 'urban, vibrant, street culture',
        'ambient': 'ethereal, atmospheric, dreamlike',
        'trance': 'cosmic, transcendent, flowing',
        'house': 'energetic, colorful, club atmosphere',
        'techno': 'industrial, minimalist, stark',
        'indie': 'artistic, authentic, creative',
        'pop': 'bright, colorful, polished',
        'soul': 'warm, emotional, intimate',
        'blues': 'moody, emotional, atmospheric',
        'punk': 'raw, rebellious, high contrast',
        'psychedelic': 'surreal, colorful, mind-bending',
        'progressive': 'complex, layered, evolving',
        'cosmic': 'space, galaxies, stars, nebulae',
        'cinematic': 'dramatic, movie-quality, epic',
        'orchestral': 'grand, sweeping, majestic'
    }
    
    # Check for genre/style matches
    lower_style = suno_style.lower()
    for genre, visual_desc in genre_map.items():
        if genre in lower_style:
            elements['visual_keywords'].extend(visual_desc.split(', '))
    
    # Look for mood descriptors
    mood_keywords = ['dark', 'bright', 'moody', 'uplifting', 'melancholic', 'energetic', 
                     'calm', 'intense', 'dreamy', 'powerful', 'gentle', 'dramatic']
    for mood in mood_keywords:
        if mood in lower_style:
            elements['mood'] = mood
            break
    
    return elements

def generate_image_prompt(lyric_text, suno_style="", style_elements=None, base_style="photorealistic"):
    """
    Generate an AI image prompt based on lyric text and Suno style
    
    Handles Suno formatting:
    - (parentheses) = background vocals - excluded from image prompts
    - [brackets] = structural markers - handled specially
    """
    if style_elements is None:
        style_elements = {}
    
    # Clean up the lyric text
    lyric = lyric_text.strip()
    
    # Remove background vocals in parentheses
    # e.g., "We are stardust (stardust, stardust)" -> "We are stardust"
    lyric = re.sub(r'\([^)]*\)', '', lyric).strip()
    
    # Handle structural markers in brackets
    if lyric.startswith('[') and lyric.endswith(']'):
        # Extract what's inside brackets
        marker = lyric[1:-1].lower()
        
        # Check if it's an instrumental/structural marker
        structural_markers = ['instrumental', 'intro', 'outro', 'bridge', 'solo', 
                             'break', 'fade', 'interlude', 'chorus', 'verse', 'pre-chorus']
        
        if any(word in marker for word in structural_markers):
            lyric = "Abstract visual interpretation of the music"
        # If it's a mood/emotion marker like [Emotional], [Intense], keep it
        else:
            lyric = f"{marker.capitalize()} atmosphere"
    
    # If after cleaning we have no content, use generic
    if not lyric or lyric.isspace():
        lyric = "Abstract visual interpretation of the music"
    
    # Build the prompt starting with base style
    prompt_parts = [base_style]
    
    # Add visual keywords from style
    if style_elements.get('visual_keywords'):
        visual_style = ', '.join(style_elements['visual_keywords'][:3])  # Top 3 keywords
        prompt_parts.append(visual_style)
    
    # Add mood if present
    if style_elements.get('mood'):
        prompt_parts.append(f"{style_elements['mood']} atmosphere")
    
    # The core lyric interpretation
    prompt_parts.append(f"scene depicting: {lyric}")
    
    # Technical specs
    prompt_parts.append("16:9 aspect ratio, high quality, cinematic composition")
    
    # Combine everything
    prompt = " | ".join(prompt_parts)
    
    return prompt

def main():
    if len(sys.argv) < 3:
        print("SRT to AI Prompts Generator (with Suno Style)")
        print("\nUsage:")
        print("  ./srt_to_prompts.py <input.srt> <output.json> [suno_style.txt] [base_style]")
        print("\nArguments:")
        print("  input.srt       - Your timed lyrics subtitle file")
        print("  output.json     - Output file for prompts and timing")
        print("  suno_style.txt  - (Optional) Your Suno prompt/style file")
        print("  base_style      - (Optional) Base visual style (default: photorealistic)")
        print("\nExample:")
        print("  ./srt_to_prompts.py lyrics.srt prompts.json suno_prompt.txt 'cinematic'")
        print("\nHandles Suno formatting:")
        print("  (parentheses) - Background vocals, excluded from prompts")
        print("  [brackets]    - Structural markers like [Intro], [Instrumental]")
        print("\nThe Suno style file should contain the prompt you used to generate")
        print("your song. This creates visual consistency with the musical theme.")
        sys.exit(1)
    
    srt_file = sys.argv[1]
    output_file = sys.argv[2]
    suno_style_file = sys.argv[3] if len(sys.argv) > 3 else None
    base_style = sys.argv[4] if len(sys.argv) > 4 else "photorealistic, cinematic"
    
    print("=" * 60)
    print("SRT to AI Prompts Generator")
    print("=" * 60)
    print()
    
    # Load Suno style if provided
    suno_style = ""
    style_elements = {}
    if suno_style_file:
        print(f"📖 Loading Suno style from: {suno_style_file}")
        suno_style = load_suno_style(suno_style_file)
        if suno_style:
            print(f"✓ Loaded {len(suno_style)} characters of style context")
            print(f"✓ Extracting visual elements from Suno style...")
            style_elements = extract_style_elements(suno_style)
            
            if style_elements.get('visual_keywords'):
                print(f"  Visual keywords: {', '.join(style_elements['visual_keywords'][:5])}")
            if style_elements.get('mood'):
                print(f"  Detected mood: {style_elements['mood']}")
            print()
    
    print(f"📖 Parsing SRT file: {srt_file}")
    segments = parse_srt(srt_file)
    
    if not segments:
        print("❌ No segments found in SRT file")
        sys.exit(1)
    
    print(f"✓ Found {len(segments)} segments")
    print(f"✓ Total duration: {segments[-1]['end']:.1f}s")
    print(f"✓ Base style: {base_style}")
    print()
    
    # Generate prompts for each segment
    prompt_data = []
    print("Generating prompts for each scene...")
    print("-" * 60)
    
    for i, seg in enumerate(segments, 1):
        prompt = generate_image_prompt(
            seg['text'], 
            suno_style, 
            style_elements,
            base_style
        )
        
        # Show cleaned lyric (what will be used for prompts)
        cleaned_lyric = re.sub(r'\([^)]*\)', '', seg['text']).strip()
        
        prompt_data.append({
            'sequence': i,
            'start': seg['start'],
            'end': seg['end'],
            'duration': seg['duration'],
            'lyric': seg['text'],  # Original with background vocals
            'lyric_cleaned': cleaned_lyric,  # Cleaned version used for prompt
            'prompt': prompt,
            'filename': f"scene_{i:03d}.jpg"
        })
        
        print(f"Scene {i:3d} [{seg['start']:6.1f}s - {seg['end']:6.1f}s] ({seg['duration']:.1f}s)")
        print(f"  Lyric: {seg['text'][:60]}{'...' if len(seg['text']) > 60 else ''}")
        if cleaned_lyric != seg['text']:
            print(f"  Clean: {cleaned_lyric[:60]}{'...' if len(cleaned_lyric) > 60 else ''}")
        print(f"  Prompt: {prompt[:80]}{'...' if len(prompt) > 80 else ''}")
        print()
    
    # Save to JSON
    output = {
        'metadata': {
            'srt_file': srt_file,
            'suno_style_file': suno_style_file or None,
            'suno_style_text': suno_style if suno_style else None,
            'total_segments': len(segments),
            'total_duration': segments[-1]['end'],
            'base_style': base_style,
            'extracted_style_elements': style_elements
        },
        'segments': prompt_data
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("=" * 60)
    print(f"✅ Saved {len(segments)} prompts to: {output_file}")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Review/edit the prompts in the JSON file if needed")
    print("  2. Run the image generator to create visuals:")
    print(f"     ./generate_images.py {output_file} ./images openai $OPENAI_API_KEY")
    print("  3. Assemble the final video:")
    print(f"     ./assemble_video.py {output_file} ./images audio.wav output_HD.mp4")

if __name__ == "__main__":
    main()
