# Suno Video Generator (Remotion Edition)

Transform your Suno AI-generated songs into professional HD music videos with AI-generated visuals, real-time preview, and interactive prompt editing.

## ✨ Features

- **🎨 Interactive UI** - Beautiful web interface with Shadcn/ui components
- **👀 Real-time Preview** - See your video in the Remotion Player before rendering
- **✏️ Prompt Editor** - Edit AI image prompts for each scene interactively
- **🔄 Image Regeneration** - Regenerate individual scenes with tweaked prompts
- **📊 Progress Tracking** - Visual queue system for image generation
- **🎬 Ken Burns Effects** - Smooth zoom/pan animations on static images
- **⏱️ Timeline Scrubbing** - Frame-accurate preview with timeline controls
- **💰 Cost Estimation** - Know the cost before generating images
- **🎬 Outro/Credits Sequence** - Auto-generated credits with video showcase and AI attribution
- **🔄 Video Looping** - Scene group videos loop seamlessly in final renders
- **🧠 AI Enhanced Prompts** - Precision visual translator for symbolic, lyric-based imagery
- **🎭 Song Info Overlay** - Animated song title, artist, and style with staggered slide-in effects
- **💾 Complete Project Export/Import** - Save and restore entire projects with all settings preserved

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key (for DALL-E 3) or Grok API key

### Installation

```bash
# Install dependencies
npm install

# Run the full development environment (recommended)
npm run dev:all

# This starts both:
# - Web app (Vite) on http://localhost:3001
# - Render server (Express) on http://localhost:3002
```

Or run individually:
```bash
# Web app only
npm run web

# Remotion studio (for video composition only)
npm run dev
```

## 📖 Usage

### 1. Project Setup

Upload your files:
- **SRT file** (required) - Timed lyrics from your song
- **Audio file** (required) - WAV or MP3 from Suno
- **Suno style prompt** (optional) - The prompt you used to generate the song

Configure AI settings:
- Choose API provider (OpenAI DALL-E 3 or Grok)
- Enter your API key
- Set base visual style (e.g., "photorealistic, cinematic")

### 2. Scene Grouping

Organize your lyrics into scene groups:
- Automatic grouping based on time gaps
- Merge consecutive lines for multi-line scenes
- Instrumental breaks automatically detected and positioned chronologically

### 3. Edit Prompts

Review and customize AI image prompts for each scene:
- Click any scene to expand and edit
- Modify prompts to fine-tune visual output
- See extracted style elements and mood
- AI Enhanced prompt regeneration per scene

### 4. Generate Images

Queue-based image generation with progress tracking:
- Start/pause generation at any time
- See real-time progress for each scene
- Retry failed generations
- Resume from where you left off

### 5. Display Configuration

Configure visual settings for each scene:
- Assign images or videos to scene groups
- Configure Ken Burns effects
- Set lyric overlay styling and positioning

### 6. Intro & Outro

Configure overlay animations:
- **Song Info Overlay** - Title, artist, and style with staggered slide-in animation
- **Outro/Credits** - Video showcase grid with QR codes and custom text
- Toggle each feature on/off independently

### 7. Preview & Render

Interactive Remotion Player:
- Preview full video with timeline scrubbing
- See Ken Burns effects in action
- Review scene list
- Export to final MP4 (requires @remotion/renderer setup)

## 🎯 Project Structure

```
suno-video-generator/
├── src/
│   ├── components/          # React UI components
│   │   ├── ui/             # Shadcn/ui components
│   │   ├── ProjectSetup.tsx
│   │   ├── SceneGroupingEditor.tsx
│   │   ├── PromptEditor.tsx
│   │   ├── ImageGeneration.tsx
│   │   ├── DisplayConfigEditor.tsx
│   │   ├── IntroOutroEditor.tsx
│   │   └── VideoPreview.tsx
│   ├── remotion/           # Remotion video components
│   │   ├── VideoComposition.tsx
│   │   ├── Scene.tsx       # With Ken Burns effects
│   │   ├── SongInfoOverlay.tsx
│   │   └── Outro.tsx
│   ├── lib/                # Core logic
│   │   ├── srt-parser.ts
│   │   ├── image-api.ts
│   │   ├── project-context.tsx
│   │   ├── project-storage.ts
│   │   └── utils.ts
│   ├── types/              # TypeScript definitions
│   ├── App.tsx             # Main application
│   ├── web.tsx             # Web entry point
│   └── index.ts            # Remotion entry point
├── legacy/                 # Original Python scripts
└── public/
```

## 🔧 Configuration

### API Keys

Set environment variables (recommended):

```bash
export OPENAI_API_KEY="sk-xxxxx"
export XAI_API_KEY="xai-xxxxx"
```

Or enter directly in the web UI (not stored permanently).

### Video Settings

- Resolution: 1920x1080 (Full HD)
- Frame Rate: 30 fps
- Audio: AAC 320kbps
- Ken Burns: Enabled by default
- Aspect Ratio: 16:9

## 💡 Advanced Features

### Ken Burns Effects

Each scene includes smooth zoom and pan animations:
- Zoom: 1x → 1.1x over scene duration
- Pan: Subtle horizontal movement
- Customizable in `src/remotion/Scene.tsx`

### Style Extraction

Automatically extracts visual themes from your Suno prompt:

**Genre Mappings:**
- `synthwave` → "retro-futuristic, neon, 80s aesthetic"
- `trance` → "cosmic, transcendent, flowing"
- `cinematic` → "dramatic, movie-quality, epic"
- 20+ more genre mappings

**Mood Detection:**
- Dark, bright, moody, uplifting, energetic, calm, intense, etc.

### Suno Formatting

Handles special Suno subtitle conventions:
- `(background vocals)` - Kept in captions, excluded from image prompts
- `[Intro]`, `[Instrumental]` - Triggers abstract visuals

### Song Info Overlay

Displays song metadata at the start of your video with smooth animations:

- **Staggered Slide-In** - Title, artist, and style slide in sequentially from left
- **Configurable Timing** - Set display duration (default 5 seconds)
- **Synchronized Fade-Out** - All elements fade out together
- **Style Fallback** - Uses Suno style prompt if no custom style text provided
- **Position Control** - Configurable left/bottom offset positioning
- **Toggleable** - Enable/disable in Intro & Outro settings

### Outro/Credits Sequence

Automatically generates a professional credits sequence at the end of your video:

- **Video Showcase** - Displays all videos used in the project in a dynamic grid
- **Ripple Animation** - Videos appear with staggered timing (top-left to bottom-right)
- **Looping Playback** - All videos loop continuously during the credits
- **Customizable Text** - Edit App Name, GitHub URL, and AI Credits text
- **QR Code Support** - Upload GitHub and Bitcoin QR codes (appear in last 5 seconds)
- **Duration** - 20 seconds with smooth fade in/out transitions
- **Toggleable** - Enable/disable in Display Configuration settings
- **Dynamic Grid** - Automatically sizes grid to accommodate any number of videos
- **Export/Import** - QR images and all outro settings preserved in project exports

### Video Looping in Scene Groups

Videos assigned to scene groups now loop correctly in final renders:

- **Automatic Duration Detection** - Reads actual video duration from metadata
- **Seamless Looping** - Uses Remotion's Loop component with real video duration
- **Extended Scenes** - Videos loop seamlessly when scene duration exceeds video length

### AI Enhanced Prompts

The AI prompt enhancement system uses a precision visual translator framework:

- **Symbolic Imagery** - Generates prompts based on actual lyric content and meaning
- **Avoids Generic Terms** - Filters out overused terms like "vibrant, neon, gritty, raw, rebellious"
- **Surreal/Abstract Focus** - Creates unique, evocative imagery tied to specific lyrics
- **Progressive UI** - AI Enhanced tags appear in real-time as batches complete
- **Per-Scene Regeneration** - Regenerate individual AI Enhanced prompts with a single click

### Complete Project Export/Import

Save and restore entire projects for later editing:

- **Full State Preservation** - All settings, prompts, and configurations saved
- **Media Files Included** - Audio, images, videos, and QR codes bundled in ZIP
- **SRT & Style Files** - Lyrics and Suno style prompt preserved
- **Chronological Ordering** - Scene groups maintain correct time-based order
- **Cross-Session Support** - Import projects in new browser sessions
- **Versioned Manifest** - Future-proof export format

## 📊 Cost Estimation

**OpenAI DALL-E 3:**
- ~$0.08 per image (HD, 1792x1024)
- 3-min song (~36 scenes) = $2.88
- 4-min song (~60 scenes) = $4.80

Generation time: ~2-3 minutes per image

## 🛠️ Development

### Run Development Servers

```bash
# Full-stack development (recommended)
npm run dev:all

# This runs both:
# - Web app (Vite) on http://localhost:3001
# - Render server (Express) on http://localhost:3002

# Or run individually:

# Web app only (port 3001)
npm run web

# Render server only (port 3002)
npm run server

# Remotion studio only (port 3000)
npm run dev
```

The web app communicates with the render server for video processing and file uploads.

### Build for Production

```bash
# Web app
npm run build:web

# Remotion render
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

## 🎨 Customization

### Modify Visual Styles

Edit `src/lib/srt-parser.ts`:

```typescript
const GENRE_MAP: Record<string, string> = {
  'yourgenre': 'custom, visual, keywords',
  // Add your own genre mappings
};
```

### Adjust Ken Burns Effects

Edit `src/remotion/Scene.tsx`:

```typescript
// Change zoom range
const scale = interpolate(frame, [0, durationInFrames], [1, 1.2]);

// Change pan distance
const translateX = interpolate(frame, [0, durationInFrames], [0, -100]);
```

### Add Transitions

Between scenes, you can add crossfade effects using Remotion's transition utilities.

## 📝 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev:all` | **Start both web app (port 3001) and render server (port 3002)** |
| `npm run web` | Start web app dev server only (port 3001) |
| `npm run server` | Start render server only (port 3002) |
| `npm run dev` | Start Remotion studio (port 3000) |
| `npm run build:web` | Build web app for production |
| `npm run build` | Render video with Remotion CLI |

## 🚧 Roadblocks & Solutions

### Issue: Aspect Ratio Mismatch
- **Problem:** DALL-E 3 generates 1792x1024, video is 1920x1080
- **Solution:** Scenes scale/fit to maintain aspect ratio with black bars

### Issue: Static Images Feel Boring
- **Solution:** Ken Burns effects add motion to static images

### Issue: Visual Inconsistency Between Scenes
- **Solution:** Style extraction from Suno prompt maintains theme consistency

### Issue: Expensive to Test Changes
- **Solution:** Preview in Remotion Player before generating all images

## 🔮 Future Enhancements

- [x] Video clips instead of static images ✅ (Grok video generation + import support)
- [x] Lyric overlay on video ✅ (Karaoke-style lyrics during playback)
- [ ] Crossfade transitions between scenes
- [ ] Multiple visual styles per song
- [ ] Batch processing queue
- [ ] Cloud rendering with Remotion Lambda
- [ ] Export SRT for YouTube upload

## 📄 License

MIT License - Free for personal and commercial use

## 🙏 Credits

- **Remotion** - Programmatic video generation
- **OpenAI DALL-E 3** - AI image generation
- **Shadcn/ui** - Beautiful UI components
- **Tailwind CSS** - Utility-first CSS framework
- **Suno AI** - Music generation platform

## 💬 Support

Issues or questions? Check the `.claude` file for detailed architecture documentation.

---

**Made with ❤️ and AI**

Transform your Suno songs into visual masterpieces! 🎵→🎬
