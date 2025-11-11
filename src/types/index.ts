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
  scenes: SceneData[];
}

export interface VideoCompositionProps {
  scenes: SceneData[];
  audioPath: string;
}

export interface SceneProps {
  scene: SceneData;
  startFrame: number;
  durationInFrames: number;
}
