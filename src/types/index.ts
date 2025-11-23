// Individual lyric line from SRT file
export interface LyricLine {
  id: string; // unique identifier
  sequence: number;
  start: number; // seconds
  end: number; // seconds
  duration: number; // seconds
  lyric: string; // original with formatting
  lyricCleaned: string; // for prompts
  assignedGroupId?: string; // which group this line belongs to
}

// Media version tracking for image-to-video workflow
export interface MediaVersion {
  id: string; // unique identifier for this version
  type: 'image' | 'video'; // media type
  path: string; // blob URL or file path
  createdAt: number; // timestamp
  label: string; // display label (e.g., "Original Image", "Video v1", "Video v2")
  quality?: 'SD' | 'HD'; // video quality (auto-detected from resolution/file size)
  exported?: boolean; // true if image has been exported for manual upload
  fps?: number; // video frame rate (for playback rate adjustment)
  duration?: number; // video duration in seconds (for looping)
}

// Scene group that combines multiple lyric lines and shares one image/video
export interface SceneGroup {
  id: string; // unique identifier
  lyricLineIds: string[]; // array of LyricLine IDs in this group
  start: number; // start time (from first line)
  end: number; // end time (from last line)
  duration: number; // total duration
  combinedLyrics: string; // merged text from all lines
  prompt: string; // Basic AI image prompt for the group
  enhancedPrompt?: string; // AI-enhanced version with rich visual details
  selectedPromptType?: "basic" | "enhanced" | "custom"; // Which prompt user selected
  customPrompt?: string; // User's custom edited prompt
  filename: string; // scene_group_001.jpg
  imagePath?: string; // local path to active media (backward compatible)
  mediaVersions?: MediaVersion[]; // all generated media versions (images + videos)
  activeMediaId?: string; // which version is currently selected
  isReusedGroup: boolean; // true if this reuses another group's image
  originalGroupId?: string; // reference to original group if reused
  isInstrumental: boolean; // true for [Intro]/[Outro]/[Instrumental] sections
  isGap?: boolean; // true for auto-generated gap placeholders (no SRT entry)
  displayMode?: 'cover' | 'contain' | 'contain-blur'; // How media is displayed in composition
  kenBurnsPreset?: 'static' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down'; // Ken Burns animation preset
  coverVerticalPosition?: number; // Vertical position for cover mode (0-100%, 50 = center)
}

// Legacy interface for backward compatibility
export interface SceneData {
  sequence: number;
  start: number; // seconds
  end: number; // seconds
  duration: number; // seconds
  lyric: string; // original with formatting
  lyricCleaned: string; // for prompts
  prompt: string; // AI image prompt
  filename: string; // scene_001.jpg
  imagePath?: string; // local path to generated image
}

export interface StyleElements {
  genres: string[];
  visualKeywords: string;
  mood: string;
  baseStyle: string;
}

export interface ProjectData {
  metadata: {
    srtFile: string;
    audioFile: string;
    sunoStyleFile?: string;
    sunoStyleText?: string;
    totalSegments: number;
    baseStyle: string;
    extractedStyleElements: StyleElements;
  };
  scenes: SceneData[]; // Legacy: kept for backward compatibility
  lyricLines?: LyricLine[]; // Individual lyric lines from SRT
  sceneGroups?: SceneGroup[]; // Grouped scenes for optimized image generation
  useGrouping?: boolean; // Flag to enable new grouping system
  outroConfig?: OutroConfig; // Outro/credits configuration
}

export interface VideoCompositionProps {
  scenes: SceneData[];
  audioPath: string;
  sceneGroups?: SceneGroup[]; // New: use groups if available
  lyricLines?: LyricLine[]; // New: needed to display lyrics within groups
  useGrouping?: boolean; // Flag to use new grouping system
  outroConfig?: OutroConfig; // Outro/credits configuration
}

export interface SceneProps {
  scene: SceneData;
  startFrame: number;
  durationInFrames: number;
}

export interface SceneGroupProps {
  sceneGroup: SceneGroup;
  lyricLines: LyricLine[]; // Lines that belong to this group
  startFrame: number;
  durationInFrames: number;
}

// Outro/credits configuration
export interface OutroConfig {
  enabled: boolean;
  duration: number; // Duration in seconds (default 20)
  appName: string;
  githubUrl: string;
  aiCredits: string; // Customizable AI credits text
  githubQrImage?: string; // Blob URL for GitHub QR code image
  bitcoinQrImage?: string; // Blob URL for Bitcoin QR code image
}

export interface OutroMediaItem {
  path: string;
  type: 'image' | 'video';
}

export interface OutroProps {
  mediaItems: OutroMediaItem[]; // Array of media items with type information
  duration: number; // Duration in seconds
  appName: string;
  githubUrl: string;
  aiCredits: string; // Customizable AI credits text
  githubQrImage?: string; // Blob URL for GitHub QR code image
  bitcoinQrImage?: string; // Blob URL for Bitcoin QR code image
}
