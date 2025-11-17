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

### 2. Edit Prompts

Review and customize AI image prompts for each scene:
- Click any scene to expand and edit
- Modify prompts to fine-tune visual output
- See extracted style elements and mood

### 3. Generate Images

Queue-based image generation with progress tracking:
- Start/pause generation at any time
- See real-time progress for each scene
- Retry failed generations
- Resume from where you left off

### 4. Preview & Render

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
│   │   ├── PromptEditor.tsx
│   │   ├── ImageGeneration.tsx
│   │   └── VideoPreview.tsx
│   ├── remotion/           # Remotion video components
│   │   ├── VideoComposition.tsx
│   │   └── Scene.tsx       # With Ken Burns effects
│   ├── lib/                # Core logic
│   │   ├── srt-parser.ts
│   │   ├── image-api.ts
│   │   ├── project-context.tsx
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

- [ ] Video clips instead of static images
- [ ] Crossfade transitions between scenes
- [ ] Lyric overlay on video
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
