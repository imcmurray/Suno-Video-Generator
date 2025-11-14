/**
 * Scene Grouper - Intelligently groups lyric lines to optimize image generation
 * Features:
 * - Detects repeated lyrics (choruses) for image reuse
 * - Suggests groupings based on minimum duration (3-5s)
 * - Handles structural markers ([Intro], [Chorus], etc.)
 * - Special handling for instrumental sections
 */

import { v4 as uuidv4 } from 'uuid';
import { SceneData, LyricLine, SceneGroup, StyleElements } from '../types';
import { generateImagePrompt } from './srt-parser';

/**
 * Minimum duration for a scene group (in seconds)
 */
const MIN_SCENE_DURATION = 3;
const MAX_SCENE_DURATION = 12;
const INSTRUMENTAL_SPLIT_THRESHOLD = 8; // Split instrumentals longer than 8s

/**
 * Convert legacy SceneData[] to LyricLine[] with unique IDs
 */
export function scenesToLyricLines(scenes: SceneData[]): LyricLine[] {
  return scenes.map((scene) => ({
    id: uuidv4(),
    sequence: scene.sequence,
    start: scene.start,
    end: scene.end,
    duration: scene.duration,
    lyric: scene.lyric,
    lyricCleaned: scene.lyricCleaned,
  }));
}

/**
 * Check if a lyric is an instrumental/structural marker
 */
function isInstrumentalMarker(lyric: string): boolean {
  const cleaned = lyric.trim().toLowerCase();
  const markers = [
    'instrumental',
    'intro',
    'outro',
    'solo',
    'break',
    'fade',
    'interlude',
  ];

  // Check if it's a bracket marker like [Instrumental]
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    const content = cleaned.slice(1, -1);
    return markers.some((marker) => content.includes(marker));
  }

  return false;
}

/**
 * Check if a lyric is a structural marker like [Verse], [Chorus], [Bridge]
 */
function isStructuralMarker(lyric: string): boolean {
  const cleaned = lyric.trim().toLowerCase();
  const markers = ['verse', 'chorus', 'bridge', 'pre-chorus', 'hook'];

  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    const content = cleaned.slice(1, -1);
    return markers.some((marker) => content.includes(marker));
  }

  return false;
}

/**
 * Normalize lyric text for comparison (remove punctuation, lowercase, trim)
 */
function normalizeLyric(lyric: string): string {
  return lyric
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect repeated lyric sequences (e.g., choruses)
 * Returns a map of normalized lyric -> array of line IDs that have that lyric
 */
export function detectRepeatedLyrics(
  lyricLines: LyricLine[]
): Map<string, string[]> {
  const lyricMap = new Map<string, string[]>();

  for (const line of lyricLines) {
    // Skip structural markers and instrumentals
    if (isStructuralMarker(line.lyric) || isInstrumentalMarker(line.lyric)) {
      continue;
    }

    const normalized = normalizeLyric(line.lyricCleaned);

    // Only track if lyric has meaningful content
    if (normalized.length > 5) {
      const existing = lyricMap.get(normalized) || [];
      existing.push(line.id);
      lyricMap.set(normalized, existing);
    }
  }

  // Filter to only include lyrics that appear more than once
  const repeated = new Map<string, string[]>();
  for (const [lyric, ids] of lyricMap.entries()) {
    if (ids.length > 1) {
      repeated.set(lyric, ids);
    }
  }

  return repeated;
}

/**
 * Create scene groups for instrumental sections
 * Splits long instrumentals into 2-3 groups for variety
 */
function createInstrumentalGroups(
  lines: LyricLine[],
  styleElements: StyleElements,
  baseStyle: string,
  groupCounter: { count: number }
): SceneGroup[] {
  const groups: SceneGroup[] = [];
  const totalDuration = lines[lines.length - 1].end - lines[0].start;

  // Determine number of groups based on duration
  let numGroups = 1;
  if (totalDuration > INSTRUMENTAL_SPLIT_THRESHOLD) {
    numGroups = Math.min(3, Math.ceil(totalDuration / 5)); // Max 3 groups
  }

  if (numGroups === 1) {
    // Single group for the entire instrumental section
    const { prompt } = generateImagePrompt(
      lines[0].lyric,
      styleElements,
      baseStyle
    );

    groups.push({
      id: uuidv4(),
      lyricLineIds: lines.map((l) => l.id),
      start: lines[0].start,
      end: lines[lines.length - 1].end,
      duration: totalDuration,
      combinedLyrics: lines[0].lyric,
      prompt,
      filename: `scene_group_${String(groupCounter.count++).padStart(3, '0')}.jpg`,
      isReusedGroup: false,
      isInstrumental: true,
    });
  } else {
    // Split into multiple groups
    const durationPerGroup = totalDuration / numGroups;

    for (let i = 0; i < numGroups; i++) {
      const startTime = lines[0].start + i * durationPerGroup;
      const endTime = i === numGroups - 1
        ? lines[lines.length - 1].end
        : startTime + durationPerGroup;

      // Find lines that fall within this time range
      const groupLines = lines.filter(
        (line) => line.start >= startTime && line.end <= endTime
      );

      // If no lines match, include at least one line
      if (groupLines.length === 0 && lines.length > i) {
        groupLines.push(lines[i]);
      }

      const { prompt } = generateImagePrompt(
        `${lines[0].lyric} (part ${i + 1})`,
        styleElements,
        baseStyle
      );

      groups.push({
        id: uuidv4(),
        lyricLineIds: groupLines.map((l) => l.id),
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
        combinedLyrics: `${lines[0].lyric} (part ${i + 1})`,
        prompt,
        filename: `scene_group_${String(groupCounter.count++).padStart(3, '0')}.jpg`,
        isReusedGroup: false,
        isInstrumental: true,
      });
    }
  }

  return groups;
}

/**
 * Suggest automatic groupings based on duration and structure
 */
export function suggestGroupings(
  lyricLines: LyricLine[],
  styleElements: StyleElements,
  baseStyle: string = 'photorealistic, cinematic'
): SceneGroup[] {
  if (lyricLines.length === 0) return [];

  const groups: SceneGroup[] = [];
  const groupCounter = { count: 1 };

  let i = 0;
  while (i < lyricLines.length) {
    const currentLine = lyricLines[i];

    // Check if this is an instrumental/structural marker
    if (isInstrumentalMarker(currentLine.lyric)) {
      // Collect all consecutive instrumental lines
      const instrumentalLines: LyricLine[] = [currentLine];
      let j = i + 1;
      while (j < lyricLines.length && isInstrumentalMarker(lyricLines[j].lyric)) {
        instrumentalLines.push(lyricLines[j]);
        j++;
      }

      // Create instrumental groups (may be split into multiple)
      const instrumentalGroups = createInstrumentalGroups(
        instrumentalLines,
        styleElements,
        baseStyle,
        groupCounter
      );
      groups.push(...instrumentalGroups);

      i = j;
      continue;
    }

    // Check if this is a standalone structural marker (verse/chorus label)
    if (isStructuralMarker(currentLine.lyric)) {
      // Skip structural markers, they don't need their own scene
      i++;
      continue;
    }

    // Regular lyric line - group by duration
    const groupLines: LyricLine[] = [currentLine];
    let groupDuration = currentLine.duration;
    let j = i + 1;

    // Keep adding lines until we reach minimum duration or hit a marker
    while (
      j < lyricLines.length &&
      groupDuration < MIN_SCENE_DURATION &&
      !isInstrumentalMarker(lyricLines[j].lyric) &&
      !isStructuralMarker(lyricLines[j].lyric)
    ) {
      groupLines.push(lyricLines[j]);
      groupDuration = lyricLines[j].end - currentLine.start;
      j++;
    }

    // Create the group
    const combinedLyrics = groupLines.map((l) => l.lyricCleaned).join(' ');
    const { prompt } = generateImagePrompt(
      combinedLyrics,
      styleElements,
      baseStyle
    );

    groups.push({
      id: uuidv4(),
      lyricLineIds: groupLines.map((l) => l.id),
      start: groupLines[0].start,
      end: groupLines[groupLines.length - 1].end,
      duration: groupLines[groupLines.length - 1].end - groupLines[0].start,
      combinedLyrics,
      prompt,
      filename: `scene_group_${String(groupCounter.count++).padStart(3, '0')}.jpg`,
      isReusedGroup: false,
      isInstrumental: false,
    });

    i = j;
  }

  return groups;
}

/**
 * Create reused groups for repeated lyrics
 * Returns updated scene groups with reuse linkages
 */
export function createReusedGroups(
  sceneGroups: SceneGroup[],
  lyricLines: LyricLine[]
): SceneGroup[] {
  // Detect repeated lyrics
  const repeatedLyrics = detectRepeatedLyrics(lyricLines);

  if (repeatedLyrics.size === 0) {
    return sceneGroups;
  }

  // Create a map of line ID to group
  const lineToGroupMap = new Map<string, SceneGroup>();
  for (const group of sceneGroups) {
    for (const lineId of group.lyricLineIds) {
      lineToGroupMap.set(lineId, group);
    }
  }

  // For each repeated lyric, link groups together
  const updatedGroups = [...sceneGroups];
  const processedGroups = new Set<string>();

  for (const [, lineIds] of repeatedLyrics) {
    // Get all groups that contain these repeated lines
    const groupsWithRepeatedLyric = new Set<SceneGroup>();
    for (const lineId of lineIds) {
      const group = lineToGroupMap.get(lineId);
      if (group && !processedGroups.has(group.id)) {
        groupsWithRepeatedLyric.add(group);
      }
    }

    if (groupsWithRepeatedLyric.size > 1) {
      // Pick the first occurrence as the original
      const groupArray = Array.from(groupsWithRepeatedLyric);
      const originalGroup = groupArray[0];
      processedGroups.add(originalGroup.id);

      // Mark others as reused
      for (let i = 1; i < groupArray.length; i++) {
        const group = groupArray[i];
        const groupIndex = updatedGroups.findIndex((g) => g.id === group.id);

        if (groupIndex !== -1) {
          updatedGroups[groupIndex] = {
            ...group,
            isReusedGroup: true,
            originalGroupId: originalGroup.id,
            imagePath: originalGroup.imagePath, // Link to original image
          };
          processedGroups.add(group.id);
        }
      }
    }
  }

  return updatedGroups;
}

/**
 * Calculate statistics about grouping optimization
 */
export function calculateGroupingStats(
  originalLineCount: number,
  sceneGroups: SceneGroup[]
): {
  originalCount: number;
  groupCount: number;
  uniqueImageCount: number;
  reusedCount: number;
  savingsPercent: number;
  estimatedCostSavings: number;
} {
  const uniqueImageCount = sceneGroups.filter((g) => !g.isReusedGroup).length;
  const reusedCount = sceneGroups.filter((g) => g.isReusedGroup).length;
  const savingsPercent = Math.round(
    ((originalLineCount - uniqueImageCount) / originalLineCount) * 100
  );

  // Assume $0.08 per image (OpenAI DALL-E 3 pricing)
  const estimatedCostSavings = (originalLineCount - uniqueImageCount) * 0.08;

  return {
    originalCount: originalLineCount,
    groupCount: sceneGroups.length,
    uniqueImageCount,
    reusedCount,
    savingsPercent,
    estimatedCostSavings,
  };
}

/**
 * Detect timeline gaps between lyric lines and scene groups
 * Returns gaps longer than minGapDuration seconds
 */
export function detectTimelineGaps(
  lyricLines: LyricLine[],
  sceneGroups: SceneGroup[],
  minGapDuration: number = 2
): Array<{ start: number; end: number; duration: number }> {
  // Collect all timeline items (lines + groups)
  const timelineItems = [
    ...lyricLines.map((line) => ({ start: line.start, end: line.end })),
    ...sceneGroups.filter(g => !g.isGap).map((group) => ({ start: group.start, end: group.end })),
  ].sort((a, b) => a.start - b.start);

  const gaps: Array<{ start: number; end: number; duration: number }> = [];

  for (let i = 0; i < timelineItems.length - 1; i++) {
    const currentEnd = timelineItems[i].end;
    const nextStart = timelineItems[i + 1].start;
    const gapDuration = nextStart - currentEnd;

    if (gapDuration >= minGapDuration) {
      gaps.push({
        start: currentEnd,
        end: nextStart,
        duration: gapDuration,
      });
    }
  }

  return gaps;
}

/**
 * Create scene groups for timeline gaps
 * Splits gaps into 3-5 second chunks for better visual flow
 */
export function createGapGroups(
  gaps: Array<{ start: number; end: number; duration: number }>,
  styleElements: StyleElements,
  baseStyle: string,
  groupCounter: { count: number }
): SceneGroup[] {
  const gapGroups: SceneGroup[] = [];
  const targetSegmentDuration = 4; // Prefer 4-second segments
  const minSegmentDuration = 3;
  const maxSegmentDuration = 5;

  for (const gap of gaps) {
    // Determine number of segments to create
    const numSegments = Math.max(
      1,
      Math.round(gap.duration / targetSegmentDuration)
    );
    const segmentDuration = gap.duration / numSegments;

    // Create segments
    for (let i = 0; i < numSegments; i++) {
      const segmentStart = gap.start + i * segmentDuration;
      const segmentEnd =
        i === numSegments - 1 ? gap.end : segmentStart + segmentDuration;

      const { prompt } = generateImagePrompt(
        '[Instrumental]',
        styleElements,
        baseStyle
      );

      gapGroups.push({
        id: uuidv4(),
        lyricLineIds: [], // No lyric lines for gaps
        start: segmentStart,
        end: segmentEnd,
        duration: segmentEnd - segmentStart,
        combinedLyrics: 'Instrumental Break',
        prompt,
        filename: `scene_group_${String(groupCounter.count++).padStart(3, '0')}.jpg`,
        isReusedGroup: false,
        isInstrumental: true,
        isGap: true, // Mark as gap placeholder
      });
    }
  }

  return gapGroups;
}

/**
 * Main function: Convert scenes to optimized scene groups
 */
export function createOptimizedSceneGroups(
  scenes: SceneData[],
  styleElements: StyleElements,
  baseStyle: string = 'photorealistic, cinematic'
): {
  lyricLines: LyricLine[];
  sceneGroups: SceneGroup[];
  stats: ReturnType<typeof calculateGroupingStats>;
} {
  // Convert scenes to lyric lines
  const lyricLines = scenesToLyricLines(scenes);

  // Suggest initial groupings
  let sceneGroups = suggestGroupings(lyricLines, styleElements, baseStyle);

  // Apply reuse detection
  sceneGroups = createReusedGroups(sceneGroups, lyricLines);

  // Calculate statistics
  const stats = calculateGroupingStats(scenes.length, sceneGroups);

  // Update lyric lines with assigned group IDs
  const updatedLyricLines = lyricLines.map((line) => {
    const group = sceneGroups.find((g) => g.lyricLineIds.includes(line.id));
    return {
      ...line,
      assignedGroupId: group?.id,
    };
  });

  return {
    lyricLines: updatedLyricLines,
    sceneGroups,
    stats,
  };
}
