#!/usr/bin/env python3
"""
Assemble Video from Timed Images
Creates video from images with precise timing based on SRT segments
Uses FFmpeg to create perfectly synced video
"""

import sys
import json
import os
import subprocess
from pathlib import Path

def create_ffmpeg_concat_file(segments, images_dir, output_file="/tmp/ffmpeg_concat.txt"):
    """
    Create FFmpeg concat file with precise durations
    """
    with open(output_file, 'w') as f:
        for segment in segments:
            image_path = os.path.join(images_dir, segment['filename'])
            
            # Check if image exists
            if not os.path.exists(image_path):
                print(f"⚠️  Warning: Missing image {image_path}")
                continue
            
            # Write to concat file
            f.write(f"file '{os.path.abspath(image_path)}'\n")
            f.write(f"duration {segment['duration']}\n")
        
        # FFmpeg requires last file without duration
        if segments:
            last_image = os.path.join(images_dir, segments[-1]['filename'])
            f.write(f"file '{os.path.abspath(last_image)}'\n")
    
    return output_file

def assemble_video(concat_file, audio_file, output_file):
    """
    Use FFmpeg to create final video with audio
    """
    cmd = [
        'ffmpeg',
        '-f', 'concat',
        '-safe', '0',
        '-i', concat_file,
        '-i', audio_file,
        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '320k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        '-y',  # Overwrite output
        output_file
    ]
    
    print("🎬 Running FFmpeg to assemble video...")
    print(f"   Command: {' '.join(cmd[:10])}...")
    
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg error: {e.stderr}")
        return False

def get_video_info(video_file):
    """Get video duration and other info"""
    cmd = [
        'ffprobe',
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        video_file
    ]
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        return float(result.stdout.strip())
    except:
        return 0

def main():
    if len(sys.argv) < 4:
        print("Video Assembler - Creates video from timed images")
        print("\nUsage:")
        print("  ./assemble_video.py <prompts.json> <images_dir> <audio.wav> <output.mp4>")
        print("\nExample:")
        print("  ./assemble_video.py prompts.json ./images song.wav song_HD.mp4")
        print("\nThe prompts.json file should contain timing information from SRT parsing")
        sys.exit(1)
    
    prompts_file = sys.argv[1]
    images_dir = sys.argv[2]
    audio_file = sys.argv[3]
    output_file = sys.argv[4] if len(sys.argv) > 4 else "output_HD.mp4"
    
    # Validate inputs
    if not os.path.exists(prompts_file):
        print(f"❌ Error: Prompts file not found: {prompts_file}")
        sys.exit(1)
    
    if not os.path.exists(images_dir):
        print(f"❌ Error: Images directory not found: {images_dir}")
        sys.exit(1)
    
    if not os.path.exists(audio_file):
        print(f"❌ Error: Audio file not found: {audio_file}")
        sys.exit(1)
    
    # Load prompts/timing data
    print(f"📖 Loading timing data from: {prompts_file}")
    with open(prompts_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    segments = data['segments']
    print(f"✓ Found {len(segments)} timed segments")
    print(f"✓ Total duration: {data['metadata']['total_duration']:.1f}s")
    print()
    
    # Verify all images exist
    missing = []
    for seg in segments:
        img_path = os.path.join(images_dir, seg['filename'])
        if not os.path.exists(img_path):
            missing.append(seg['filename'])
    
    if missing:
        print(f"⚠️  Warning: {len(missing)} images missing:")
        for m in missing[:5]:
            print(f"   - {m}")
        if len(missing) > 5:
            print(f"   ... and {len(missing)-5} more")
        print()
        
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # Create FFmpeg concat file
    print("📝 Creating FFmpeg concat file...")
    concat_file = create_ffmpeg_concat_file(segments, images_dir)
    print(f"✓ Concat file: {concat_file}")
    print()
    
    # Assemble video
    if assemble_video(concat_file, audio_file, output_file):
        print()
        print("=" * 50)
        print("✅ Video assembly complete!")
        print("=" * 50)
        
        if os.path.exists(output_file):
            file_size = os.path.getsize(output_file) / (1024*1024)  # MB
            duration = get_video_info(output_file)
            
            print(f"📹 Output: {output_file}")
            print(f"   Size: {file_size:.1f} MB")
            print(f"   Duration: {duration:.1f}s")
            print(f"   Resolution: 1920x1080 (Full HD)")
            print()
            print("Ready to upload to YouTube!")
        else:
            print("❌ Error: Output file not created")
            sys.exit(1)
    else:
        print("❌ Failed to assemble video")
        sys.exit(1)
    
    # Clean up
    try:
        os.remove(concat_file)
    except:
        pass

if __name__ == "__main__":
    main()
