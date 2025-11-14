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

// Scene group that combines multiple lyric lines and shares one image
export interface SceneGroup {
  id: string; // unique identifier
  lyricLineIds: string[]; // array of LyricLine IDs in this group
  start: number; // start time (from first line)
  end: number; // end time (from last line)
  duration: number; // total duration
  combinedLyrics: string; // merged text from all lines
  prompt: string; // AI image prompt for the group
  filename: string; // scene_group_001.jpg
  imagePath?: string; // local path to generated image
  isReusedGroup: boolean; // true if this reuses another group's image
  originalGroupId?: string; // reference to original group if reused
  isInstrumental: boolean; // true for [Intro]/[Outro]/[Instrumental] sections
  isGap?: boolean; // true for auto-generated gap placeholders (no SRT entry)
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
}

export interface VideoCompositionProps {
  scenes: SceneData[];
  audioPath: string;
  sceneGroups?: SceneGroup[]; // New: use groups if available
  lyricLines?: LyricLine[]; // New: needed to display lyrics within groups
  useGrouping?: boolean; // Flag to use new grouping system
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
