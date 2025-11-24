import React, { useState, useEffect, useRef, useMemo } from "react";
import { Monitor, Maximize2, Sparkles, Play, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useProject } from "../lib/project-context";
import { detectMediaOrientation, suggestDisplayMode, type MediaOrientation } from "../lib/media-utils";
import { isValidBlobURL } from "../lib/blob-manager";
import { formatTime } from "../lib/utils";

// Track logged messages to prevent console spam
const loggedMessages = new Set<string>();

function logOnce(key: string, logFn: () => void) {
  if (!loggedMessages.has(key)) {
    loggedMessages.add(key);
    logFn();
  }
}

// Helper to validate media paths and prevent invalid URL loading
const isValidMediaPath = (path: string | undefined): boolean => {
  // Check for undefined, null, empty
  if (!path || path.trim() === '') return false;

  // Check for literal invalid strings
  if (path === 'undefined' || path === 'null') return false;

  // Check minimum length (blob URLs are long)
  if (path.length < 5) return false;

  // For blob URLs, validate both format AND registry status
  if (path.startsWith('blob:')) {
    return isValidBlobURL(path);
  }

  // For http URLs, validate format
  if (path.startsWith('http')) {
    try {
      new URL(path);
      return true;
    } catch {
      return false;
    }
  }

  // Default to true for other paths (file paths, etc.)
  return true;
};

export const DisplayConfigEditor: React.FC = () => {
  const { project, setProject } = useProject();
  const [detectionStatus, setDetectionStatus] = useState<Map<string, MediaOrientation>>(new Map());
  const [isDetecting, setIsDetecting] = useState(false);
  const hasRunDetection = useRef(false);

  if (!project || !project.sceneGroups) {
    return null;
  }

  // Memoize groups with valid media to prevent re-computation on every render
  // For reused groups, look up the original group's imagePath
  // Sort by start time for correct timeline order
  const groupsWithMedia = useMemo(
    () => [...(project.sceneGroups || [])]
      .sort((a, b) => a.start - b.start)
      .map((group, index) => {
        // For reused groups, get imagePath from original group
        let effectiveImagePath = group.imagePath;
        if (group.isReusedGroup && group.originalGroupId) {
          const originalGroup = project.sceneGroups?.find(g => g.id === group.originalGroupId);
          effectiveImagePath = originalGroup?.imagePath;
        }
        return {
          group,
          index,
          hasValidMedia: isValidMediaPath(effectiveImagePath),
          effectiveImagePath, // Resolved path for reused groups
        };
      }),
    [project.sceneGroups]
  );

  // Function to detect media orientations for all scene groups
  const detectAllOrientations = async () => {
    if (!project.sceneGroups || isDetecting) return;

    setIsDetecting(true);
    const newDetectionStatus = new Map<string, MediaOrientation>();
    const updatedGroups = [...project.sceneGroups];
    let hasChanges = false;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Hard limit to prevent overwhelming browser (max 50 groups)
    const maxGroups = Math.min(project.sceneGroups.length, 50);

    try {
      for (let i = 0; i < maxGroups; i++) {
        const group = project.sceneGroups[i];

        // Skip groups without media or with invalid paths
        if (!isValidMediaPath(group.imagePath)) {
          skippedCount++;
          continue;
        }

        try {
          // Determine media type
          const activeVersion = group.mediaVersions?.find(v => v.id === group.activeMediaId);
          const mediaType = activeVersion?.type || 'image';

          // Detect orientation (group.imagePath is guaranteed to be valid due to isValidMediaPath check above)
          const orientation = await detectMediaOrientation(group.imagePath!, mediaType);
          newDetectionStatus.set(group.id, orientation);
          successCount++;

          // Auto-suggest display mode if not already set
          if (!group.displayMode || group.displayMode === 'cover') {
            const suggested = suggestDisplayMode(orientation);
            if (suggested === 'contain-blur' && orientation === 'portrait') {
              logOnce(`auto-apply-${group.id}`, () => {
                console.log(`[Detection] 🎨 Auto-applying 'contain-blur' to Group ${i + 1} (portrait detected)`);
              });
              updatedGroups[i] = { ...group, displayMode: suggested };
              hasChanges = true;
            }
          }

          // Rate limiting: Add 200ms delay between groups to prevent browser overload
          if (i < maxGroups - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          failedCount++;
        }
      }
    } catch (error) {
      console.error('[Detection] Critical error:', error);
    }

    setDetectionStatus(newDetectionStatus);

    if (hasChanges) {
      setProject({ ...project, sceneGroups: updatedGroups });
    }

    if (successCount > 0) {
      console.log(`[Detection] Complete: ${successCount} detected, ${skippedCount} skipped`);
    }

    setIsDetecting(false);
  };

  // Clean up stale blob URLs from state on mount
  useEffect(() => {
    console.log('[DisplayConfigEditor] 🧹 Cleanup Effect Running');

    if (!project?.sceneGroups) {
      console.log('[DisplayConfigEditor] No project or sceneGroups, skipping cleanup');
      return;
    }

    console.log('[DisplayConfigEditor] Checking', project.sceneGroups.length, 'groups for stale URLs');

    // Log all groups with imagePath
    const groupsWithMedia = project.sceneGroups.filter(g => g.imagePath);
    console.log('[DisplayConfigEditor] Groups with imagePath:', groupsWithMedia.length);
    groupsWithMedia.forEach((g, idx) => {
      const isBlob = g.imagePath?.startsWith('blob:');
      const isValid = isBlob ? isValidBlobURL(g.imagePath!) : true;
      const mediaType = g.mediaVersions?.find(v => v.id === g.activeMediaId)?.type || 'unknown';
      console.log(`  Group ${idx}: ${g.imagePath?.substring(0, 30)}... | Blob: ${isBlob} | Valid: ${isValid} | DisplayMode: ${g.displayMode || 'cover'} | MediaType: ${mediaType}`);
    });

    // Check if any groups have invalid blob URLs
    const hasStaleUrls = project.sceneGroups.some(g =>
      (g.imagePath?.startsWith('blob:') && !isValidBlobURL(g.imagePath)) ||
      g.mediaVersions?.some(v => v.path.startsWith('blob:') && !isValidBlobURL(v.path))
    );

    console.log('[DisplayConfigEditor] Has stale URLs:', hasStaleUrls);

    if (hasStaleUrls) {
      console.log('[DisplayConfigEditor] ⚠️ Cleaning up stale blob URLs from state');

      const cleanedGroups = project.sceneGroups.map(g => ({
        ...g,
        // Clear imagePath if it's an invalid blob URL
        imagePath: g.imagePath?.startsWith('blob:') && !isValidBlobURL(g.imagePath)
          ? undefined
          : g.imagePath,
        // Clear paths in mediaVersions if they're invalid blob URLs
        mediaVersions: g.mediaVersions?.map(v => ({
          ...v,
          path: v.path.startsWith('blob:') && !isValidBlobURL(v.path)
            ? ''
            : v.path
        }))
      }));

      setProject({ ...project, sceneGroups: cleanedGroups });
      console.log('[DisplayConfigEditor] ✅ Cleanup complete');
    } else {
      console.log('[DisplayConfigEditor] ✅ No stale URLs found, state is clean');
    }
  }, []); // Run once on mount

  // Auto-detect media orientations on mount (with guard against React StrictMode double-run)
  useEffect(() => {
    if (hasRunDetection.current) {
      return; // Prevent duplicate run in React StrictMode
    }

    hasRunDetection.current = true;
    detectAllOrientations();
  }, []); // Run once on mount

  // DOM inspection after renders to verify clean state
  useEffect(() => {
    // Only inspect after detection completes
    if (!isDetecting && detectionStatus.size > 0) {
      const timer = setTimeout(() => {
        const videos = document.querySelectorAll('video');
        const images = document.querySelectorAll('img');

        const videosArray = Array.from(videos);
        const imagesArray = Array.from(images);

        const videosWithInvalidSrc = videosArray.filter(v =>
          v.src && (v.src === 'undefined' || v.src === 'null' || v.src === '' || !v.src.includes('://'))
        );
        const imagesWithInvalidSrc = imagesArray.filter(i =>
          i.src && (i.src === 'undefined' || i.src === 'null' || i.src === '' || !i.src.includes('://'))
        );

        console.log('[DisplayConfigEditor] 🔍 Final DOM State:', {
          totalVideos: videos.length,
          totalImages: images.length,
          videosWithBlobURL: videosArray.filter(v => v.src && v.src.includes('blob:')).length,
          imagesWithBlobURL: imagesArray.filter(i => i.src && i.src.includes('blob:')).length,
          invalidVideos: videosWithInvalidSrc.length,
          invalidImages: imagesWithInvalidSrc.length
        });

        // Cleanup any invalid elements
        if (videosWithInvalidSrc.length > 0 || imagesWithInvalidSrc.length > 0) {
          console.warn('[DisplayConfigEditor] ⚠️ Found invalid media elements, cleaning up...');
          videosWithInvalidSrc.forEach(v => v.remove());
          imagesWithInvalidSrc.forEach(i => i.remove());
        }
      }, 1000); // Wait for everything to settle

      return () => clearTimeout(timer);
    }
  }, [isDetecting, detectionStatus]);

  // Global media error suppression (prevents console spam)
  useEffect(() => {
    const handleMediaError = (e: Event | ErrorEvent) => {
      // Handle media element errors
      if (e.target instanceof HTMLMediaElement || e.target instanceof HTMLImageElement) {
        // Suppress browser's automatic error logging
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Handle generic error events that contain media-related messages
      if (e instanceof ErrorEvent) {
        const errorMsg = e.message?.toLowerCase() || '';
        if (errorMsg.includes('media resource') ||
            errorMsg.includes('invalid uri') ||
            errorMsg.includes('load of media')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    };

    // Capture media errors before they reach the console
    window.addEventListener('error', handleMediaError, true);

    return () => {
      window.removeEventListener('error', handleMediaError, true);
    };
  }, []);

  const handleDisplayModeChange = (groupId: string, displayMode: 'cover' | 'contain' | 'contain-blur') => {
    if (!project.sceneGroups) return;

    const groupIndex = project.sceneGroups.findIndex(g => g.id === groupId);
    const oldDisplayMode = project.sceneGroups[groupIndex]?.displayMode || 'cover';

    console.log(`[DisplayConfigEditor] 🎨 DisplayMode changed for Group ${groupIndex + 1}:`, {
      groupId: groupId.substring(0, 8),
      oldMode: oldDisplayMode,
      newMode: displayMode
    });

    const updatedGroups = project.sceneGroups.map((g) =>
      g.id === groupId ? { ...g, displayMode } : g
    );

    setProject({ ...project, sceneGroups: updatedGroups });
  };

  const handleKenBurnsPresetChange = (groupId: string, kenBurnsPreset: string) => {
    if (!project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((g) =>
      g.id === groupId ? { ...g, kenBurnsPreset: kenBurnsPreset as any } : g
    );

    setProject({ ...project, sceneGroups: updatedGroups });
  };

  const handleCoverVerticalPositionChange = (groupId: string, position: number) => {
    if (!project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((g) =>
      g.id === groupId ? { ...g, coverVerticalPosition: position } : g
    );

    setProject({ ...project, sceneGroups: updatedGroups });
  };

  const handleVideoStartOffsetChange = (groupId: string, offset: number) => {
    if (!project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((g) =>
      g.id === groupId ? { ...g, videoStartOffset: offset } : g
    );

    setProject({ ...project, sceneGroups: updatedGroups });

    // Update the video thumbnail to show the new start point
    const videoElements = document.querySelectorAll(`video[data-group-id="${groupId}"]`);
    videoElements.forEach((video) => {
      (video as HTMLVideoElement).currentTime = offset;
    });
  };

  const applyToAll = (displayMode: 'cover' | 'contain-blur') => {
    if (!project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((g) => ({
      ...g,
      displayMode,
    }));

    setProject({ ...project, sceneGroups: updatedGroups });
  };

  const resetToDefaults = () => {
    if (!project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((g) => ({
      ...g,
      displayMode: 'cover' as const,
      kenBurnsPreset: 'zoom-in' as const,
    }));

    setProject({ ...project, sceneGroups: updatedGroups });
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Configure Display & Animation</h1>
        <p className="text-muted-foreground">
          Customize how each scene's media is displayed and animated
        </p>
      </div>

      {/* Bulk Operations Toolbar */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
          <CardDescription>
            Apply settings to all scene groups at once. Click "Detect Orientations" to auto-detect portrait/landscape media.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={detectAllOrientations} variant="outline" disabled={isDetecting}>
            <Play className="w-4 h-4 mr-2" />
            {isDetecting ? "Detecting..." : "Detect Orientations"}
          </Button>
          <Button onClick={() => applyToAll('cover')} variant="outline">
            <Maximize2 className="w-4 h-4 mr-2" />
            Apply "Cover" to All
          </Button>
          <Button onClick={() => applyToAll('contain-blur')} variant="outline">
            <Sparkles className="w-4 h-4 mr-2" />
            Apply "Contain-Blur" to All
          </Button>
          <Button onClick={resetToDefaults} variant="outline">
            Reset All to Defaults
          </Button>
        </CardContent>
      </Card>

      {/* Scene Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupsWithMedia.map(({ group, index, hasValidMedia, effectiveImagePath }) => {
          // For reused groups, get orientation from original group
          let orientation = detectionStatus.get(group.id);
          if (!orientation && group.isReusedGroup && group.originalGroupId) {
            orientation = detectionStatus.get(group.originalGroupId);
          }
          const isPortrait = orientation === 'portrait';

          // Log each group card render with displayMode (once per group)
          logOnce(`card-render-${group.id}`, () => {
            console.log(`[DisplayConfigEditor] 📋 Rendering Group ${index + 1} card:`, {
              groupId: group.id.substring(0, 8),
              displayMode: group.displayMode || 'cover',
              hasValidMedia,
              orientation: orientation || 'unknown'
            });
          });

          // Memoize thumbnail rendering to prevent video element destruction during displayMode changes
          // IMPORTANT: Do NOT include 'orientation' or 'group.mediaVersions' in dependencies
          // - orientation changes would cause video element recreation
          // - mediaVersions is an array whose reference changes even when contents are identical
          const thumbnailContent = useMemo(() => {
            // Use effectiveImagePath for reused groups (resolves to original group's media)
            const mediaPath = effectiveImagePath;
            const shouldRender = hasValidMedia && mediaPath && isValidMediaPath(mediaPath);

            if (!shouldRender) {
              return (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4">
                  <Monitor className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm text-center">No media generated yet</p>
                  <p className="text-xs text-center mt-1">Generate images/videos in Step 4</p>
                </div>
              );
            }

            // Double-check path is valid before rendering media elements
            if (!mediaPath || mediaPath.trim() === '') {
              return (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4">
                  <Monitor className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm text-center">Invalid media path</p>
                </div>
              );
            }

            logOnce(`thumbnail-render-${group.id}`, () => {
              console.log(`[Thumbnail] Rendering Group ${index + 1}:`, {
                groupId: group.id.substring(0, 8),
                imagePath: mediaPath.substring(0, 50),
                hasValidMedia,
                isReused: group.isReusedGroup,
                isValidPath: isValidMediaPath(mediaPath)
              });
            });

            // For reused groups, get media type from original group's mediaVersions
            let isVideo = false;
            if (group.isReusedGroup && group.originalGroupId) {
              const originalGroup = project.sceneGroups?.find(g => g.id === group.originalGroupId);
              isVideo = originalGroup?.mediaVersions?.find(v => v.id === originalGroup.activeMediaId)?.type === 'video';
            } else {
              isVideo = group.mediaVersions?.find(v => v.id === group.activeMediaId)?.type === 'video';
            }
            const displayMode = group.displayMode || 'cover';

            // Only render media elements if we have a valid path
            if (!mediaPath || mediaPath.trim() === '') {
              return null;
            }

            // Render based on display mode
            if (displayMode === 'contain-blur') {
              // Contain-blur mode: dual layer rendering (blurred background + main content)
              return (
                <div className="relative w-full h-full">
                  {/* Blurred background layer */}
                  {isVideo ? (
                    <video
                      key={`${group.id}-blur`}
                      src={mediaPath}
                      data-group-id={group.id}
                      className="absolute w-full h-full"
                      style={{
                        objectFit: 'cover',
                        filter: 'blur(40px)',
                        opacity: 0.6,
                        transform: 'scale(1.2)',
                      }}
                      muted
                      playsInline
                      preload="metadata"
                      autoPlay={false}
                      loop={false}
                      onLoadedMetadata={(e) => {
                        if (group.videoStartOffset) {
                          e.currentTarget.currentTime = group.videoStartOffset;
                        }
                      }}
                    />
                  ) : (
                    <img
                      key={`${group.id}-blur`}
                      src={mediaPath}
                      alt=""
                      className="absolute w-full h-full"
                      style={{
                        objectFit: 'cover',
                        filter: 'blur(40px)',
                        opacity: 0.6,
                        transform: 'scale(1.2)',
                      }}
                      loading="lazy"
                    />
                  )}

                  {/* Main content layer (on top) */}
                  {isVideo ? (
                    <video
                      key={group.id}
                      src={mediaPath}
                      data-group-id={group.id}
                      className="relative w-full h-full"
                      style={{ objectFit: 'contain' }}
                      muted
                      playsInline
                      preload="metadata"
                      autoPlay={false}
                      loop={false}
                      onLoadedMetadata={(e) => {
                        if (group.videoStartOffset) {
                          e.currentTarget.currentTime = group.videoStartOffset;
                        }
                      }}
                      onError={(e) => {
                        logOnce(`thumbnail-video-error-${group.id}`, () => {
                          console.log(`[Thumbnail] ❌ Video error for Group ${index + 1}`);
                        });
                        e.currentTarget.removeAttribute('src');
                        e.currentTarget.load();
                      }}
                    />
                  ) : (
                    <img
                      key={group.id}
                      src={mediaPath}
                      alt={`Group ${index + 1}`}
                      className="relative w-full h-full"
                      style={{ objectFit: 'contain' }}
                      loading="lazy"
                      onError={(e) => {
                        logOnce(`thumbnail-image-error-${group.id}`, () => {
                          console.log(`[Thumbnail] ❌ Image error for Group ${index + 1}`);
                        });
                        e.currentTarget.removeAttribute('src');
                      }}
                    />
                  )}
                </div>
              );
            } else {
              // Cover or Contain mode: single layer rendering
              const objectFit = displayMode === 'contain' ? 'contain' : 'cover';
              const verticalPosition = group.coverVerticalPosition ?? 50; // Default to center
              const objectPosition = displayMode === 'cover' ? `center ${verticalPosition}%` : 'center';

              return (
                <>
                  {isVideo ? (
                    <video
                      key={group.id}
                      src={mediaPath}
                      data-group-id={group.id}
                      className="w-full h-full"
                      style={{ objectFit, objectPosition }}
                      muted
                      playsInline
                      preload="metadata"
                      autoPlay={false}
                      loop={false}
                      onLoadedMetadata={(e) => {
                        if (group.videoStartOffset) {
                          e.currentTarget.currentTime = group.videoStartOffset;
                        }
                      }}
                      onError={(e) => {
                        logOnce(`thumbnail-video-error-${group.id}`, () => {
                          console.log(`[Thumbnail] ❌ Video error for Group ${index + 1}`);
                        });
                        e.currentTarget.removeAttribute('src');
                        e.currentTarget.load();
                      }}
                    />
                  ) : (
                    <img
                      key={group.id}
                      src={mediaPath}
                      alt={`Group ${index + 1}`}
                      className="w-full h-full"
                      style={{ objectFit, objectPosition }}
                      loading="lazy"
                      onError={(e) => {
                        logOnce(`thumbnail-image-error-${group.id}`, () => {
                          console.log(`[Thumbnail] ❌ Image error for Group ${index + 1}`);
                        });
                        e.currentTarget.removeAttribute('src');
                      }}
                    />
                  )}
                </>
              );
            }
          }, [group.id, effectiveImagePath, group.activeMediaId, group.displayMode, group.coverVerticalPosition, group.isReusedGroup, group.originalGroupId, hasValidMedia, index, project.sceneGroups]);

          return (
            <Card key={group.id} className={isPortrait ? 'border-blue-500 border-2' : ''}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Group {index + 1}
                  {isPortrait && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Portrait Detected
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {group.combinedLyrics}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Media Preview Thumbnail */}
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  {thumbnailContent}
                  {/* Orientation badge - rendered outside useMemo to prevent video element recreation */}
                  {hasValidMedia && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {orientation || 'Unknown'}
                    </div>
                  )}
                </div>

                {/* Display Mode Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={group.displayMode === 'cover' ? 'default' : 'outline'}
                      size="sm"
                      className="flex flex-col items-center py-3 h-auto"
                      onClick={() => handleDisplayModeChange(group.id, 'cover')}
                    >
                      <Maximize2 className="w-4 h-4 mb-1" />
                      <span className="text-xs">Cover</span>
                    </Button>
                    <Button
                      variant={group.displayMode === 'contain' ? 'default' : 'outline'}
                      size="sm"
                      className="flex flex-col items-center py-3 h-auto"
                      onClick={() => handleDisplayModeChange(group.id, 'contain')}
                    >
                      <Monitor className="w-4 h-4 mb-1" />
                      <span className="text-xs">Contain</span>
                    </Button>
                    <Button
                      variant={group.displayMode === 'contain-blur' ? 'default' : 'outline'}
                      size="sm"
                      className="flex flex-col items-center py-3 h-auto"
                      onClick={() => handleDisplayModeChange(group.id, 'contain-blur')}
                    >
                      <Sparkles className="w-4 h-4 mb-1" />
                      <span className="text-xs">Blur BG</span>
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {group.displayMode === 'cover' && 'Fills screen, may crop edges'}
                    {group.displayMode === 'contain' && 'Fits entire media, may show black bars'}
                    {group.displayMode === 'contain-blur' && 'Fits media with blurred background'}
                  </div>
                </div>

                {/* Vertical Position Slider (Cover mode only) */}
                {group.displayMode === 'cover' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Vertical Position</label>
                      <span className="text-xs text-muted-foreground">
                        {group.coverVerticalPosition ?? 50}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={group.coverVerticalPosition ?? 50}
                      onChange={(e) => handleCoverVerticalPositionChange(group.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Top</span>
                      <span>Center</span>
                      <span>Bottom</span>
                    </div>
                  </div>
                )}

                {/* Ken Burns Preset Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ken Burns Animation</label>
                  <Select
                    value={group.kenBurnsPreset || 'zoom-in'}
                    onValueChange={(value) => handleKenBurnsPresetChange(group.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">🔲 Static (No Animation)</SelectItem>
                      <SelectItem value="zoom-in">🔍 Zoom In</SelectItem>
                      <SelectItem value="zoom-out">🔎 Zoom Out</SelectItem>
                      <SelectItem value="pan-left">⬅️ Pan Left</SelectItem>
                      <SelectItem value="pan-right">➡️ Pan Right</SelectItem>
                      <SelectItem value="pan-up">⬆️ Pan Up</SelectItem>
                      <SelectItem value="pan-down">⬇️ Pan Down</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(group.start)} - {formatTime(group.end)} ({group.duration.toFixed(1)}s)
                  </div>
                </div>

                {/* Video Start Offset Slider - only show for videos longer than group duration */}
                {(() => {
                  // Get the active video version to check duration
                  const activeVersion = group.mediaVersions?.find(v => v.id === group.activeMediaId);
                  const isVideo = activeVersion?.type === 'video';
                  const videoDuration = activeVersion?.duration || 0;
                  const maxOffset = videoDuration - group.duration;

                  // Only show slider if it's a video and it's longer than the group needs
                  if (isVideo && maxOffset > 0.1) {
                    return (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Video Start Point</label>
                        <input
                          type="range"
                          min={0}
                          max={maxOffset}
                          step={0.1}
                          value={group.videoStartOffset || 0}
                          onChange={(e) => handleVideoStartOffsetChange(group.id, parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Start: {formatTime(group.videoStartOffset || 0)}</span>
                          <span>Video: {videoDuration.toFixed(1)}s → Using {group.duration.toFixed(1)}s</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Status Indicators */}
                {group.isReusedGroup && (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Reuses media from another group
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detection Status */}
      {isDetecting && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Detecting media orientations...
        </div>
      )}
    </div>
  );
};
