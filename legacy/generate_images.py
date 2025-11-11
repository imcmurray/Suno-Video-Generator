#!/usr/bin/env python3
"""
AI Image Generator using Grok or OpenAI APIs
Generates images from prompts JSON file
"""

import sys
import json
import os
import time
import requests
from pathlib import Path

def generate_with_grok(prompt, api_key, output_file):
    """
    Generate image using Grok (xAI) API
    Documentation: https://docs.x.ai/
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Note: Adjust this endpoint based on actual Grok API documentation
    # This is a placeholder - check xAI docs for the correct endpoint
    url = "https://api.x.ai/v1/images/generations"
    
    payload = {
        "model": "grok-vision",  # Adjust model name as needed
        "prompt": prompt,
        "size": "1792x1024",  # 16:9 aspect ratio
        "quality": "hd"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        # Download the image
        image_url = result['data'][0]['url']
        
        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()
        
        with open(output_file, 'wb') as f:
            f.write(img_response.content)
        
        return True
    except Exception as e:
        print(f"  ❌ Grok API error: {e}")
        return False

def generate_with_openai(prompt, api_key, output_file):
    """
    Generate image using OpenAI DALL-E API
    Documentation: https://platform.openai.com/docs/guides/images
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    url = "https://api.openai.com/v1/images/generations"
    
    payload = {
        "model": "dall-e-3",
        "prompt": prompt,
        "size": "1792x1024",  # 16:9 aspect ratio
        "quality": "hd",
        "n": 1
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        
        result = response.json()
        image_url = result['data'][0]['url']
        
        # Download the image
        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()
        
        with open(output_file, 'wb') as f:
            f.write(img_response.content)
        
        return True
    except Exception as e:
        print(f"  ❌ OpenAI API error: {e}")
        return False

def main():
    if len(sys.argv) < 5:
        print("AI Image Generator")
        print("\nUsage:")
        print("  ./generate_images.py <prompts.json> <output_dir> <api_provider> <api_key>")
        print("\nAPI Providers:")
        print("  grok    - Use Grok (xAI) image generation")
        print("  openai  - Use OpenAI DALL-E 3")
        print("\nExample:")
        print("  ./generate_images.py prompts.json ./images openai sk-xxxxx")
        print("\nEnvironment Variables (alternative to command line):")
        print("  XAI_API_KEY     - For Grok")
        print("  OPENAI_API_KEY  - For OpenAI")
        sys.exit(1)
    
    prompts_file = sys.argv[1]
    output_dir = sys.argv[2]
    api_provider = sys.argv[3].lower()
    api_key = sys.argv[4] if len(sys.argv) > 4 else ""
    
    # Check for API key in environment if not provided
    if not api_key:
        if api_provider == "grok":
            api_key = os.environ.get("XAI_API_KEY", "")
        elif api_provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY", "")
    
    if not api_key:
        print(f"❌ Error: No API key provided for {api_provider}")
        print(f"   Set {api_provider.upper()}_API_KEY environment variable or pass as argument")
        sys.exit(1)
    
    # Validate provider
    if api_provider not in ["grok", "openai"]:
        print(f"❌ Error: Invalid provider '{api_provider}'. Use 'grok' or 'openai'")
        sys.exit(1)
    
    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Load prompts
    print(f"📖 Loading prompts from: {prompts_file}")
    with open(prompts_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    segments = data['segments']
    print(f"✓ Found {len(segments)} scenes to generate")
    print(f"✓ Using {api_provider.upper()} API")
    print(f"✓ Output directory: {output_dir}")
    print()
    
    # Generate images
    successful = 0
    failed = 0
    
    for i, segment in enumerate(segments, 1):
        print(f"Generating scene {i}/{len(segments)}...")
        print(f"  Lyric: {segment['lyric'][:60]}{'...' if len(segment['lyric']) > 60 else ''}")
        print(f"  Duration: {segment['duration']:.1f}s")
        
        output_file = os.path.join(output_dir, segment['filename'])
        prompt = segment['prompt']
        
        # Skip if already exists
        if os.path.exists(output_file):
            print(f"  ⏭️  Already exists, skipping...")
            successful += 1
            continue
        
        # Generate image
        if api_provider == "grok":
            success = generate_with_grok(prompt, api_key, output_file)
        elif api_provider == "openai":
            success = generate_with_openai(prompt, api_key, output_file)
        
        if success:
            print(f"  ✓ Saved: {output_file}")
            successful += 1
        else:
            failed += 1
        
        # Rate limiting - be nice to the API
        if i < len(segments):
            time.sleep(2)  # Wait 2 seconds between requests
        
        print()
    
    # Summary
    print("=" * 50)
    print(f"✅ Generation complete!")
    print(f"   Successful: {successful}/{len(segments)}")
    if failed > 0:
        print(f"   Failed: {failed}/{len(segments)}")
    print(f"   Output: {output_dir}")
    print()
    print("Next step: Run video assembly script")

if __name__ == "__main__":
    main()
