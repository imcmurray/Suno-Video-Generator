/**
 * SRT Parser - Converts SRT subtitle files to structured timing data
 * Handles Suno formatting conventions:
 * - (parentheses) = background vocals - excluded from image prompts
 * - [brackets] = structural markers (Intro, Instrumental, etc.)
 */

import { SceneData, StyleElements, ProjectData } from "../types";

interface SRTSegment {
  start: number; // seconds
  end: number; // seconds
  duration: number; // seconds
  text: string;
}

/**
 * Convert SRT timestamp (HH:MM:SS,mmm) to seconds
 */
export function parseTimestamp(timestamp: string): number {
  const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (match) {
    const [, h, m, s, ms] = match;
    return (
      parseInt(h) * 3600 +
      parseInt(m) * 60 +
      parseInt(s) +
      parseInt(ms) / 1000
    );
  }
  return 0;
}

/**
 * Parse SRT file content and extract timing + text
 */
export function parseSRT(content: string): SRTSegment[] {
  // Split by double newlines to get each subtitle block
  const blocks = content.trim().split(/\n\s*\n/);

  const segments: SRTSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // Line 0: sequence number
    // Line 1: timestamps
    // Line 2+: text
    const timestampLine = lines[1];
    const text = lines.slice(2).join(" ");

    // Parse timestamps: "00:00:05,000 --> 00:00:10,000"
    const match = timestampLine.match(/([\d:,]+)\s*-->\s*([\d:,]+)/);
    if (match) {
      const [, startTs, endTs] = match;
      const start = parseTimestamp(startTs);
      const end = parseTimestamp(endTs);
      const duration = end - start;

      segments.push({
        start,
        end,
        duration,
        text: text.trim(),
      });
    }
  }

  return segments;
}

/**
 * Common genre/style keywords that translate to visual themes
 */
const GENRE_MAP: Record<string, string> = {
  electronic: "neon, digital, futuristic",
  synthwave: "retro-futuristic, neon, 80s aesthetic, purple and pink",
  rock: "dynamic, energetic, gritty",
  metal: "dark, intense, dramatic lighting",
  jazz: "moody, noir, sophisticated",
  classical: "elegant, timeless, refined",
  folk: "natural, organic, earthy",
  country: "rustic, americana, warm tones",
  "hip-hop": "urban, vibrant, street culture",
  ambient: "ethereal, atmospheric, dreamlike",
  trance: "cosmic, transcendent, flowing",
  house: "energetic, colorful, club atmosphere",
  techno: "industrial, minimalist, stark",
  indie: "artistic, authentic, creative",
  pop: "bright, colorful, polished",
  soul: "warm, emotional, intimate",
  blues: "moody, emotional, atmospheric",
  punk: "raw, rebellious, high contrast",
  psychedelic: "surreal, colorful, mind-bending",
  progressive: "complex, layered, evolving",
  cosmic: "space, galaxies, stars, nebulae",
  cinematic: "dramatic, movie-quality, epic",
  orchestral: "grand, sweeping, majestic",
};

const MOOD_KEYWORDS = [
  "dark",
  "bright",
  "moody",
  "uplifting",
  "melancholic",
  "energetic",
  "calm",
  "intense",
  "dreamy",
  "powerful",
  "gentle",
  "dramatic",
];

/**
 * Extract visual/atmospheric elements from Suno style text
 */
export function extractStyleElements(sunoStyle: string): StyleElements {
  if (!sunoStyle) {
    return {
      genres: [],
      visualKeywords: "",
      mood: "",
      baseStyle: "photorealistic, cinematic",
    };
  }

  const lowerStyle = sunoStyle.toLowerCase();
  const visualKeywords: string[] = [];
  const foundGenres: string[] = [];

  // Check for genre/style matches
  for (const [genre, visualDesc] of Object.entries(GENRE_MAP)) {
    if (lowerStyle.includes(genre)) {
      foundGenres.push(genre);
      visualKeywords.push(...visualDesc.split(", "));
    }
  }

  // Look for mood descriptors
  let mood = "";
  for (const moodKeyword of MOOD_KEYWORDS) {
    if (lowerStyle.includes(moodKeyword)) {
      mood = moodKeyword;
      break;
    }
  }

  return {
    genres: foundGenres,
    visualKeywords: visualKeywords.slice(0, 5).join(", "), // Top 5 keywords
    mood,
    baseStyle: "photorealistic, cinematic",
  };
}

/**
 * Generate AI image prompt from lyric text and style elements
 */
export function generateImagePrompt(
  lyricText: string,
  styleElements: StyleElements,
  baseStyle: string = "photorealistic, cinematic"
): { prompt: string; cleanedLyric: string } {
  let lyric = lyricText.trim();

  // Remove background vocals in parentheses
  // e.g., "We are stardust (stardust, stardust)" -> "We are stardust"
  const cleanedLyric = lyric.replace(/\([^)]*\)/g, "").trim();
  lyric = cleanedLyric;

  // Handle structural markers in brackets
  if (lyric.startsWith("[") && lyric.endsWith("]")) {
    const marker = lyric.slice(1, -1).toLowerCase();

    // Check if it's an instrumental/structural marker
    const structuralMarkers = [
      "instrumental",
      "intro",
      "outro",
      "bridge",
      "solo",
      "break",
      "fade",
      "interlude",
      "chorus",
      "verse",
      "pre-chorus",
    ];

    if (structuralMarkers.some((word) => marker.includes(word))) {
      lyric = "Abstract visual interpretation of the music";
    } else {
      // Mood/emotion marker like [Emotional], [Intense]
      lyric = `${marker.charAt(0).toUpperCase() + marker.slice(1)} atmosphere`;
    }
  }

  // If after cleaning we have no content, use generic
  if (!lyric || !lyric.trim()) {
    lyric = "Abstract visual interpretation of the music";
  }

  // Build the prompt
  const promptParts: string[] = [baseStyle];

  // Add visual keywords from style
  if (styleElements.visualKeywords) {
    const keywords = styleElements.visualKeywords.split(", ").slice(0, 3); // Top 3
    promptParts.push(keywords.join(", "));
  }

  // Add mood if present
  if (styleElements.mood) {
    promptParts.push(`${styleElements.mood} atmosphere`);
  }

  // The core lyric interpretation
  promptParts.push(`scene depicting: ${lyric}`);

  // Technical specs
  promptParts.push("high quality, cinematic composition");

  // Combine everything
  const prompt = promptParts.join(" | ");

  return { prompt, cleanedLyric };
}

/**
 * Convert SRT file to structured project data with prompts
 */
export function srtToProjectData(
  srtContent: string,
  sunoStyleText: string = "",
  baseStyle: string = "photorealistic, cinematic"
): ProjectData {
  // Parse SRT
  const segments = parseSRT(srtContent);

  if (segments.length === 0) {
    throw new Error("No segments found in SRT file");
  }

  // Extract style elements
  const styleElements = extractStyleElements(sunoStyleText);

  // Generate prompts for each segment
  const scenes: SceneData[] = segments.map((seg, index) => {
    const { prompt, cleanedLyric } = generateImagePrompt(
      seg.text,
      styleElements,
      baseStyle
    );

    return {
      sequence: index + 1,
      start: seg.start,
      end: seg.end,
      duration: seg.duration,
      lyric: seg.text, // Original with background vocals
      lyricCleaned: cleanedLyric, // Cleaned version for prompts
      prompt,
      filename: `scene_${String(index + 1).padStart(3, "0")}.jpg`,
    };
  });

  return {
    metadata: {
      srtFile: "",
      audioFile: "",
      sunoStyleText: sunoStyleText || undefined,
      totalSegments: scenes.length,
      baseStyle,
      extractedStyleElements: styleElements,
    },
    scenes,
  };
}
