import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Plus,
  Trash2,
  Edit2,
  Link2,
  Info,
  BarChart3,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Label } from './ui/label';
import { useProject } from '../lib/project-context';
import { formatTime } from '../lib/utils';
import { LyricLine, SceneGroup } from '../types';
import {
  createOptimizedSceneGroups,
  detectRepeatedLyrics,
  calculateGroupingStats,
  detectTimelineGaps,
  createGapGroups,
} from '../lib/scene-grouper';

interface SceneGroupingEditorProps {
  onNext: () => void;
  onBack: () => void;
}

// Color palette for groups
const GROUP_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-cyan-500',
];

export const SceneGroupingEditor: React.FC<SceneGroupingEditorProps> = ({
  onNext,
  onBack,
}) => {
  const { project, setProject } = useProject();
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [sceneGroups, setSceneGroups] = useState<SceneGroup[]>([]);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [repeatedLyrics, setRepeatedLyrics] = useState<Map<string, string[]>>(
    new Map()
  );

  // Initialize from project data
  useEffect(() => {
    if (project) {
      if (project.lyricLines && project.sceneGroups) {
        // Already has grouping data
        setLyricLines(project.lyricLines);
        setSceneGroups(project.sceneGroups);
      } else {
        // Generate initial optimized groupings
        handleAutoSuggest();
      }
    }
  }, []);

  // Detect repeated lyrics whenever lyric lines change
  useEffect(() => {
    if (lyricLines.length > 0) {
      const repeated = detectRepeatedLyrics(lyricLines);
      setRepeatedLyrics(repeated);
    }
  }, [lyricLines]);

  const handleAutoSuggest = () => {
    if (!project) return;

    const result = createOptimizedSceneGroups(
      project.scenes,
      project.metadata.extractedStyleElements,
      project.metadata.baseStyle
    );

    setLyricLines(result.lyricLines);
    setSceneGroups(result.sceneGroups);
  };

  const handleCreateGroup = () => {
    if (selectedLines.size === 0) return;

    // Get selected lyric lines in order
    const selectedLyricLines = lyricLines
      .filter((line) => selectedLines.has(line.id))
      .sort((a, b) => a.sequence - b.sequence);

    if (selectedLyricLines.length === 0) return;

    // Create combined lyrics
    const combinedLyrics = selectedLyricLines
      .map((l) => l.lyricCleaned)
      .join(' ');

    // Generate prompt (simplified - in real app, use generateImagePrompt)
    const prompt = `${project?.metadata.baseStyle} | scene depicting: ${combinedLyrics}`;

    const newGroup: SceneGroup = {
      id: `group_${Date.now()}`,
      lyricLineIds: selectedLyricLines.map((l) => l.id),
      start: selectedLyricLines[0].start,
      end: selectedLyricLines[selectedLyricLines.length - 1].end,
      duration:
        selectedLyricLines[selectedLyricLines.length - 1].end -
        selectedLyricLines[0].start,
      combinedLyrics,
      prompt,
      filename: `scene_group_${String(sceneGroups.length + 1).padStart(3, '0')}.jpg`,
      isReusedGroup: false,
      isInstrumental: false,
    };

    // Update lyric lines with group assignment
    const updatedLyricLines = lyricLines.map((line) =>
      selectedLines.has(line.id)
        ? { ...line, assignedGroupId: newGroup.id }
        : line
    );

    setLyricLines(updatedLyricLines);
    setSceneGroups([...sceneGroups, newGroup]);
    setSelectedLines(new Set());
  };

  const handleDeleteGroup = (groupId: string) => {
    // Remove group
    const updatedGroups = sceneGroups.filter((g) => g.id !== groupId);

    // Unassign lyric lines
    const updatedLyricLines = lyricLines.map((line) =>
      line.assignedGroupId === groupId
        ? { ...line, assignedGroupId: undefined }
        : line
    );

    setLyricLines(updatedLyricLines);
    setSceneGroups(updatedGroups);
    setSelectedGroup(null);
  };

  const handleSplitGroup = (groupId: string) => {
    const group = sceneGroups.find((g) => g.id === groupId);
    if (!group || group.lyricLineIds.length <= 1) return;

    // Unassign all lines in this group
    const updatedLyricLines = lyricLines.map((line) =>
      group.lyricLineIds.includes(line.id)
        ? { ...line, assignedGroupId: undefined }
        : line
    );

    // Remove the group
    const updatedGroups = sceneGroups.filter((g) => g.id !== groupId);

    setLyricLines(updatedLyricLines);
    setSceneGroups(updatedGroups);
    setSelectedGroup(null);
  };

  const handleToggleLineSelection = (lineId: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handleLinkRepeatedGroups = (lineIds: string[]) => {
    // Find groups that contain these lines
    const affectedGroups = sceneGroups.filter((group) =>
      group.lyricLineIds.some((id) => lineIds.includes(id))
    );

    if (affectedGroups.length < 2) return;

    // Use first group as original
    const originalGroup = affectedGroups[0];

    // Mark others as reused
    const updatedGroups = sceneGroups.map((group) => {
      if (affectedGroups.includes(group) && group.id !== originalGroup.id) {
        return {
          ...group,
          isReusedGroup: true,
          originalGroupId: originalGroup.id,
        };
      }
      return group;
    });

    setSceneGroups(updatedGroups);
  };

  const handleContinue = () => {
    if (!project) return;

    // Merge gap groups with scene groups for saving
    const allGroups = [...sceneGroups, ...gapGroups];

    // Save grouping data to project
    setProject({
      ...project,
      lyricLines,
      sceneGroups: allGroups,
      useGrouping: true,
    });

    onNext();
  };

  const getGroupColor = (groupId: string): string => {
    const index = sceneGroups.findIndex((g) => g.id === groupId);
    return GROUP_COLORS[index % GROUP_COLORS.length];
  };

  const getDurationWarning = (duration: number): 'short' | 'long' | null => {
    if (duration < 3) return 'short';
    if (duration > 6) return 'long';  // Match Grok video max duration
    return null;
  };

  // First: Filter ungrouped lines
  const ungroupedLines = lyricLines.filter((line) => !line.assignedGroupId);

  // Second: Detect timeline gaps and create gap groups
  const gaps = detectTimelineGaps(lyricLines, sceneGroups);
  const gapGroups =
    gaps.length > 0 && project
      ? createGapGroups(
          gaps,
          project.metadata.extractedStyleElements,
          project.metadata.baseStyle,
          { count: sceneGroups.length + 1 }
        )
      : [];

  // Third: Calculate stats including gap groups
  const allGroupsForStats = [...sceneGroups, ...gapGroups];
  const stats =
    project && allGroupsForStats.length > 0
      ? calculateGroupingStats(project.scenes.length, allGroupsForStats)
      : null;

  // Create merged timeline: interleave ungrouped lines, scene groups, and gap groups chronologically
  const timelineItems = [
    ...ungroupedLines.map((line) => ({
      type: 'line' as const,
      data: line,
      start: line.start,
      id: line.id,
    })),
    ...sceneGroups.map((group) => ({
      type: 'group' as const,
      data: group,
      start: group.start,
      id: group.id,
    })),
    ...gapGroups.map((group) => ({
      type: 'gap' as const,
      data: group,
      start: group.start,
      id: group.id,
    })),
  ].sort((a, b) => a.start - b.start);

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Scene Grouping</h1>
        <p className="text-muted-foreground">
          Group lyric lines together to optimize image generation and reuse images
          for repeated sections
        </p>
      </div>

      {/* Statistics Panel */}
      {stats && (
        <Card className="mb-6 border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Optimization Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Original Lines</p>
              <p className="text-2xl font-bold">{stats.originalCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scene Groups</p>
              <p className="text-2xl font-bold">{stats.groupCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Images</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.uniqueImageCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reused</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.reusedCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost Savings</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats.estimatedCostSavings.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                ({stats.savingsPercent}% reduction)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Bar */}
      <Card className="sticky top-16 z-10 mb-6 backdrop-blur-sm bg-background/95 shadow-md">
        <CardContent className="flex gap-3 items-center py-4">
          <Button onClick={handleAutoSuggest} variant="default">
            <Wand2 className="w-4 h-4 mr-2" />
            Auto-Suggest Groupings
          </Button>
          <Button
            onClick={handleCreateGroup}
            variant="outline"
            disabled={selectedLines.size === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Group ({selectedLines.size} selected)
          </Button>
          {selectedGroup && (
            <>
              <Button
                onClick={() => handleSplitGroup(selectedGroup)}
                variant="outline"
              >
                Split Group
              </Button>
              <Button
                onClick={() => handleDeleteGroup(selectedGroup)}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Group
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Timeline View */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline & Grouping</CardTitle>
              <CardDescription>
                Click lines to select, then create a group. Click groups to
                edit/delete.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Chronological Timeline: Ungrouped Lines + Scene Groups + Gap Groups */}
              {timelineItems.map((item) => {
                if (item.type === 'line') {
                  // Render ungrouped line
                  const line = item.data;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleLineSelection(line.id)}
                      className={`
                        p-3 rounded border-2 border-dashed cursor-pointer transition-all mb-2
                        ${
                          selectedLines.has(line.id)
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-yellow-400/50 bg-yellow-50/30 dark:bg-yellow-900/10 hover:border-yellow-500'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium">{line.lyric}</p>
                            <span className="text-xs text-yellow-600 dark:text-yellow-500 font-medium">
                              Ungrouped
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(line.start)} - {formatTime(line.end)} (
                            {line.duration.toFixed(1)}s)
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else if (item.type === 'gap') {
                  // Render gap group
                  const gap = item.data;
                  return (
                    <div
                      key={item.id}
                      className={`
                        p-4 rounded border-2 border-dashed transition-all mb-3
                        border-gray-400/50 bg-gray-100/30 dark:bg-gray-800/30
                        ${
                          selectedGroup === gap.id
                            ? 'ring-2 ring-blue-500'
                            : ''
                        }
                      `}
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full bg-gray-400 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              🎵 {gap.combinedLyrics}
                            </span>
                            <div className="flex items-center gap-1 text-xs bg-gray-500/20 text-gray-700 dark:text-gray-400 px-2 py-1 rounded">
                              Auto-detected
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(gap.start)} - {formatTime(gap.end)} (
                            {gap.duration.toFixed(1)}s)
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Timeline gap • Will generate abstract instrumental visual
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Render scene group
                  const group = item.data;

                  // Safety check: recalculate duration if undefined/null
                  const actualDuration = group.duration ?? (group.end - group.start);
                  const warning = getDurationWarning(actualDuration);

                  const groupLines = lyricLines.filter((line) =>
                    group.lyricLineIds.includes(line.id)
                  );
                  const colorClass = getGroupColor(group.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedGroup(group.id)}
                      className={`
                        p-4 rounded border-2 cursor-pointer transition-all mb-3
                        ${
                          selectedGroup === group.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-300 hover:border-gray-400'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${colorClass} mt-1 flex-shrink-0`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {group.isReusedGroup && (
                              <div className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-700 px-2 py-1 rounded">
                                <Link2 className="w-3 h-3" />
                                Reused
                              </div>
                            )}
                            {group.isInstrumental && (
                              <div className="flex items-center gap-1 text-xs bg-purple-500/20 text-purple-700 px-2 py-1 rounded">
                                Instrumental
                              </div>
                            )}
                            {warning && (
                              <div
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  warning === 'short'
                                    ? 'bg-yellow-500/20 text-yellow-700'
                                    : 'bg-orange-500/20 text-orange-700'
                                }`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {warning === 'short' ? 'Too Short' : 'Too Long'}
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-medium mb-1">
                            {group.combinedLyrics}
                          </p>
                          <p className="text-xs text-muted-foreground mb-2">
                            {formatTime(group.start)} - {formatTime(group.end)} (
                            {group.duration.toFixed(1)}s) • {groupLines.length}{' '}
                            line(s)
                          </p>
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Show lines ({groupLines.length})
                            </summary>
                            <ul className="mt-2 space-y-1 pl-4">
                              {groupLines.map((line) => (
                                <li key={line.id} className="text-muted-foreground">
                                  • {line.lyric}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Repeated Lyrics Detection */}
          {repeatedLyrics.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Repeated Lyrics
                </CardTitle>
                <CardDescription>
                  These lyrics appear multiple times. Link them to reuse images.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from(repeatedLyrics.entries()).map(([lyric, lineIds]) => {
                  const firstLine = lyricLines.find((l) => l.id === lineIds[0]);
                  return (
                    <div
                      key={lyric}
                      className="p-3 border rounded bg-accent/50"
                    >
                      <p className="text-sm font-medium mb-1">
                        {firstLine?.lyric || lyric}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Appears {lineIds.length} times
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLinkRepeatedGroups(lineIds)}
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Link Groups
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Help Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-4 h-4" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                <strong>1. Auto-Suggest:</strong> Automatically groups lines by
                duration (3-5s minimum) and detects repeated sections.
              </p>
              <p>
                <strong>2. Manual Grouping:</strong> Select multiple ungrouped
                lines and click "Create Group".
              </p>
              <p>
                <strong>3. Link Repeated:</strong> Click "Link Groups" for
                repeated lyrics to reuse the same image.
              </p>
              <p>
                <strong>4. Edit Groups:</strong> Click a group to select it, then
                split or delete as needed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-4 mt-8">
        <Button onClick={onBack} variant="outline" size="lg">
          Back to Setup
        </Button>
        <Button
          onClick={handleContinue}
          size="lg"
          className="flex-1"
          disabled={sceneGroups.length === 0}
        >
          Continue to Prompt Editor
        </Button>
      </div>
    </div>
  );
};
