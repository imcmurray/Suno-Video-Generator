import React, { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, CheckCircle2, XCircle, Loader2, Play, Pause, Link2, Video as VideoIcon, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { useProject } from "../lib/project-context";
import { generateImage, estimateCost, convertImageToVideo } from "../lib/image-api";
import { SceneData, SceneGroup, MediaVersion } from "../types";
import { v4 as uuidv4 } from 'uuid';

interface GenerationStatus {
  id: string; // scene sequence or group ID
  status: "pending" | "generating" | "completed" | "failed" | "reused" | "converting_video";
  error?: string;
  imageUrl?: string;
  label: string; // Display label
  isReused?: boolean;
  hasVideo?: boolean; // true if group has at least one video version
}

export const ImageGeneration: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { project, updateScene, updateImageProgress, setProject } = useProject();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false); // Use ref for real-time checking in async loop
  const [statuses, setStatuses] = useState<Map<string, GenerationStatus>>(new Map());

  const usingGrouping = project?.useGrouping && project?.sceneGroups && project?.lyricLines;

  // Only depend on the specific data that affects initialization, not the entire project object
  const groupsLength = project?.sceneGroups?.length ?? 0;
  const scenesLength = project?.scenes?.length ?? 0;

  useEffect(() => {
    if (!project) return;

    console.log('Initializing statuses - groups:', groupsLength, 'scenes:', scenesLength);

    const initialStatuses = new Map<string, GenerationStatus>();

    if (usingGrouping && project.sceneGroups) {
      // Initialize group statuses
      project.sceneGroups.forEach((group, index) => {
        if (group.isReusedGroup) {
          initialStatuses.set(group.id, {
            id: group.id,
            status: "reused",
            label: `Group ${index + 1}`,
            isReused: true,
          });
        } else {
          initialStatuses.set(group.id, {
            id: group.id,
            status: group.imagePath ? "completed" : "pending",
            imageUrl: group.imagePath,
            label: `Group ${index + 1}`,
            isReused: false,
          });
        }
      });
    } else {
      // Initialize scene statuses (legacy mode)
      project.scenes.forEach((scene) => {
        initialStatuses.set(scene.sequence.toString(), {
          id: scene.sequence.toString(),
          status: scene.imagePath ? "completed" : "pending",
          imageUrl: scene.imagePath,
          label: `Scene ${scene.sequence}`,
        });
      });
    }

    setStatuses(initialStatuses);
  }, [groupsLength, scenesLength, usingGrouping]);

  const updateStatus = (id: string, updates: Partial<GenerationStatus>) => {
    setStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) {
        const updated = { ...current, ...updates };
        next.set(id, updated);
        console.log('Updated status for:', id, 'New status:', updated.status, 'Error:', updated.error);
        console.log('Map size after update:', next.size);
      } else {
        console.warn('Tried to update status for non-existent id:', id);
      }
      return next;
    });
  };

  // Helper to check if a path is a video file
  const isVideoFile = (path: string): boolean => {
    return /\.(mp4|mov|webm)$/i.test(path);
  };

  // Helper to add a media version to a group
  const addMediaVersion = (groupId: string, mediaPath: string, type: 'image' | 'video', label: string) => {
    if (!project || !project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((group) => {
      if (group.id === groupId) {
        const newVersion: MediaVersion = {
          id: uuidv4(),
          type,
          path: mediaPath,
          createdAt: Date.now(),
          label,
        };

        const existingVersions = group.mediaVersions || [];
        const updatedVersions = [...existingVersions, newVersion];

        return {
          ...group,
          mediaVersions: updatedVersions,
          activeMediaId: newVersion.id,
          imagePath: mediaPath, // Update active media path
        };
      }
      return group;
    });

    setProject({
      ...project,
      sceneGroups: updatedGroups,
    });
  };

  // Helper to select a specific media version
  const selectMediaVersion = (groupId: string, versionId: string) => {
    if (!project || !project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((group) => {
      if (group.id === groupId) {
        const version = group.mediaVersions?.find(v => v.id === versionId);
        if (version) {
          return {
            ...group,
            activeMediaId: versionId,
            imagePath: version.path,
          };
        }
      }
      return group;
    });

    setProject({
      ...project,
      sceneGroups: updatedGroups,
    });
  };

  const updateGroupImage = (groupId: string, imageUrl: string) => {
    if (!project || !project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((group) => {
      if (group.id === groupId) {
        // Initialize media versions with the first image
        const mediaVersion: MediaVersion = {
          id: uuidv4(),
          type: 'image',
          path: imageUrl,
          createdAt: Date.now(),
          label: 'Original Image',
        };

        return {
          ...group,
          imagePath: imageUrl,
          mediaVersions: [mediaVersion],
          activeMediaId: mediaVersion.id,
        };
      }
      // Also update reused groups that reference this one
      if (group.isReusedGroup && group.originalGroupId === groupId) {
        return { ...group, imagePath: imageUrl };
      }
      return group;
    });

    setProject({
      ...project,
      sceneGroups: updatedGroups,
    });
  };

  const generateImagesSequentially = async () => {
    if (!project || !project.apiProvider || !project.apiKey) return;

    setIsGenerating(true);
    setIsPaused(false);
    isPausedRef.current = false;

    if (usingGrouping && project.sceneGroups) {
      // Generate for groups (skip reused ones)
      const groupsToGenerate = project.sceneGroups.filter(
        (group) => !group.imagePath && !group.isReusedGroup
      );

      let completed = project.sceneGroups.filter(
        (g) => g.imagePath && !g.isReusedGroup
      ).length;
      let failed = 0;

      for (const group of groupsToGenerate) {
        if (isPausedRef.current) break;

        updateStatus(group.id, { status: "generating" });

        try {
          const result = await generateImage({
            prompt: group.prompt,
            provider: project.apiProvider,
            apiKey: project.apiKey,
            size: "1792x1024",
            quality: "hd",
          });

          console.log('Generate result for group:', group.id, result);

          if (result.success && (result.imageData || result.imageUrl)) {
            // Handle both blob URLs (OpenAI) and direct URLs (Grok)
            const imageUrl = result.imageUrl || URL.createObjectURL(result.imageData!);
            updateGroupImage(group.id, imageUrl);
            updateStatus(group.id, {
              status: "completed",
              imageUrl,
            });

            completed++;
            updateImageProgress({ completed });
          } else {
            console.error('Generation failed for group:', group.id, 'Error:', result.error);
            throw new Error(result.error || "Image generation failed");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error('Caught error for group:', group.id, 'Message:', errorMessage);

          updateStatus(group.id, {
            status: "failed",
            error: errorMessage,
          });

          failed++;
          console.log('Failed count:', failed);
          updateImageProgress({ failed });
        }

        // Rate limiting
        if (groupsToGenerate.indexOf(group) < groupsToGenerate.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } else {
      // Legacy mode: Generate for scenes
      const scenesToGenerate = project.scenes.filter(
        (scene) => !scene.imagePath
      );

      let completed = project.scenes.filter((s) => s.imagePath).length;
      let failed = 0;

      for (const scene of scenesToGenerate) {
        if (isPausedRef.current) break;

        updateStatus(scene.sequence.toString(), { status: "generating" });
        updateImageProgress({ current: scene.sequence });

        try {
          const result = await generateImage({
            prompt: scene.prompt,
            provider: project.apiProvider,
            apiKey: project.apiKey,
            size: "1792x1024",
            quality: "hd",
          });

          console.log('Generate result for scene:', scene.sequence, result);

          if (result.success && (result.imageData || result.imageUrl)) {
            // Handle both blob URLs (OpenAI) and direct URLs (Grok)
            const imageUrl = result.imageUrl || URL.createObjectURL(result.imageData!);
            updateScene(scene.sequence, { imagePath: imageUrl });
            updateStatus(scene.sequence.toString(), {
              status: "completed",
              imageUrl,
            });

            completed++;
            updateImageProgress({ completed });
          } else {
            console.error('Generation failed for scene:', scene.sequence, 'Error:', result.error);
            throw new Error(result.error || "Image generation failed");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error('Caught error for scene:', scene.sequence, 'Message:', errorMessage);

          updateStatus(scene.sequence.toString(), {
            status: "failed",
            error: errorMessage,
          });

          failed++;
          console.log('Failed count:', failed);
          updateImageProgress({ failed });
        }

        // Rate limiting
        if (scenesToGenerate.indexOf(scene) < scenesToGenerate.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    setIsGenerating(false);
    updateImageProgress({ current: undefined });
  };

  const handleStart = () => {
    generateImagesSequentially();
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    setIsGenerating(false);
  };

  const handleRetryFailed = async () => {
    if (!project) return;

    const failedStatuses = Array.from(statuses.values()).filter(
      (s) => s.status === "failed"
    );

    for (const status of failedStatuses) {
      updateStatus(status.id, { status: "pending", error: undefined });
    }

    generateImagesSequentially();
  };

  const handleConvertToVideo = async (groupId: string) => {
    if (!project || !project.apiKey) return;

    const group = project.sceneGroups?.find(g => g.id === groupId);
    if (!group || !group.imagePath) return;

    updateStatus(groupId, { status: "converting_video" });

    try {
      const videoCount = group.mediaVersions?.filter(v => v.type === 'video').length || 0;
      const videoLabel = videoCount === 0 ? 'Video v1' : `Video v${videoCount + 1}`;

      const result = await convertImageToVideo({
        imageUrl: group.imagePath,
        prompt: group.prompt,
        provider: 'grok',
        apiKey: project.apiKey,
      });

      if (result.success && result.videoData) {
        const videoUrl = URL.createObjectURL(result.videoData);
        addMediaVersion(groupId, videoUrl, 'video', videoLabel);
        updateStatus(groupId, {
          status: "completed",
          imageUrl: videoUrl,
          hasVideo: true,
        });
      } else {
        throw new Error(result.error || "Video conversion failed");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      updateStatus(groupId, {
        status: "completed", // Keep as completed since image exists
        error: `Video conversion failed: ${errorMessage}`,
      });
    }
  };

  const handleRetryVideo = async (groupId: string) => {
    // Same as convert to video - adds another version
    await handleConvertToVideo(groupId);
  };

  const handleSelectVersion = (groupId: string, versionId: string) => {
    selectMediaVersion(groupId, versionId);

    // Update status to reflect the active media
    const group = project?.sceneGroups?.find(g => g.id === groupId);
    const version = group?.mediaVersions?.find(v => v.id === versionId);

    if (version) {
      updateStatus(groupId, {
        imageUrl: version.path,
        hasVideo: group?.mediaVersions?.some(v => v.type === 'video') || false,
      });
    }
  };

  if (!project) return null;

  // Calculate stats
  const allStatuses = Array.from(statuses.values());
  const totalItems = allStatuses.length;
  const uniqueItems = allStatuses.filter((s) => !s.isReused).length;
  const completedCount = allStatuses.filter((s) => s.status === "completed").length;
  const reusedCount = allStatuses.filter((s) => s.status === "reused").length;
  const failedCount = allStatuses.filter((s) => s.status === "failed").length;
  const remainingToGenerate = uniqueItems - completedCount - reusedCount;
  const progressPercent = (completedCount / uniqueItems) * 100;

  // Debug logging for stats
  console.log('Stats calculation:', {
    totalStatuses: allStatuses.length,
    uniqueItems,
    completedCount,
    failedCount,
    reusedCount,
    failedItems: allStatuses.filter((s) => s.status === "failed").map(s => ({ id: s.id, error: s.error }))
  });

  const estimatedCost = estimateCost(
    remainingToGenerate,
    project.apiProvider || "openai",
    "hd"
  );

  // Calculate savings in grouping mode
  const originalSceneCount = usingGrouping ? project.scenes.length : totalItems;
  const savedImages = originalSceneCount - uniqueItems;
  const savedCost = savedImages * 0.08; // Assuming $0.08 per image

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Generate Images</h1>
        <p className="text-muted-foreground">
          Generate AI images {usingGrouping ? 'for each unique group' : 'for each scene'} using {project.apiProvider?.toUpperCase()}
        </p>
      </div>

      {/* Cost Savings Banner (Grouping Mode) */}
      {usingGrouping && savedImages > 0 && (
        <Card className="mb-6 border-green-500/50 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-700">Grouping Optimization Active</p>
                <p className="text-sm text-muted-foreground">
                  Generating {uniqueItems} unique images instead of {originalSceneCount} • Saving {savedImages} images
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">${savedCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Cost Savings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generation Progress</CardTitle>
          <CardDescription>
            {completedCount} of {uniqueItems} images generated
            {reusedCount > 0 && ` • ${reusedCount} reused`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercent} />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600" title={`${failedCount} items failed`}>
                {failedCount} {failedCount > 0 && '⚠️'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining Cost</p>
              <p className="text-2xl font-bold">${estimatedCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {!isGenerating && completedCount < uniqueItems && (
              <Button onClick={handleStart} size="lg">
                <Play className="w-4 h-4 mr-2" />
                {completedCount > 0 ? "Resume Generation" : "Start Generation"}
              </Button>
            )}

            {isGenerating && (
              <Button onClick={handlePause} variant="outline" size="lg">
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}

            {failedCount > 0 && !isGenerating && (
              <Button onClick={handleRetryFailed} variant="outline" size="lg">
                <ImageIcon className="w-4 h-4 mr-2" />
                Retry Failed ({failedCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {usingGrouping && project.sceneGroups ? (
          // Render group statuses
          project.sceneGroups.map((group, index) => {
            const status = statuses.get(group.id);
            if (!status) return null;

            return (
              <Card
                key={`${group.id}-${status.status}-${status.error ? 'error' : 'ok'}`}
                className={status.status === "failed" ? "border-red-500 border-2" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {status.status === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      {status.status === "reused" && (
                        <Link2 className="w-5 h-5 text-blue-600" />
                      )}
                      {status.status === "failed" && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      {(status.status === "generating" || status.status === "converting_video") && (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      )}
                      {status.status === "pending" && (
                        <div className="w-5 h-5 rounded-full border-2 border-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">Group {index + 1}</p>
                        {group.isReusedGroup && (
                          <div className="text-xs bg-blue-500/20 text-blue-700 px-1.5 py-0.5 rounded">
                            Reused
                          </div>
                        )}
                        {status.status === "converting_video" && (
                          <div className="text-xs bg-purple-500/20 text-purple-700 px-1.5 py-0.5 rounded">
                            Converting...
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {group.combinedLyrics}
                      </p>
                      {status.error && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-700 font-medium break-words">{status.error}</p>
                        </div>
                      )}

                      {/* Media Preview */}
                      {status.imageUrl && (
                        <div className="mt-2 space-y-2">
                          <div className="relative w-full h-20 rounded overflow-hidden border">
                            {isVideoFile(status.imageUrl) ? (
                              <video
                                src={status.imageUrl}
                                className="w-full h-full object-cover"
                                controls={false}
                                muted
                                loop
                                playsInline
                              />
                            ) : (
                              <img
                                src={status.imageUrl}
                                alt={`Group ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                            {isVideoFile(status.imageUrl) && (
                              <div className="absolute top-1 right-1 bg-purple-600 text-white px-1.5 py-0.5 rounded text-xs font-semibold">
                                VIDEO
                              </div>
                            )}
                          </div>

                          {/* Video Conversion Button */}
                          {status.status === "completed" && !status.hasVideo && !group.isReusedGroup && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => handleConvertToVideo(group.id)}
                            >
                              <VideoIcon className="w-3 h-3 mr-1" />
                              Convert to Video
                            </Button>
                          )}

                          {/* Version Picker */}
                          {group.mediaVersions && group.mediaVersions.length > 1 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Versions:</p>
                              <div className="flex flex-wrap gap-1">
                                {group.mediaVersions.map((version) => {
                                  const isActive = version.id === group.activeMediaId;
                                  const isVideo = version.type === 'video';

                                  return (
                                    <div key={version.id} className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant={isActive ? "default" : "outline"}
                                        className="text-xs px-2 py-1 h-auto"
                                        onClick={() => handleSelectVersion(group.id, version.id)}
                                      >
                                        {isVideo && <VideoIcon className="w-3 h-3 mr-1" />}
                                        {version.label}
                                        {isActive && " ✓"}
                                      </Button>
                                      {isVideo && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-xs px-2 py-1 h-auto"
                                          onClick={() => handleRetryVideo(group.id)}
                                          title="Retry video generation"
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          // Render scene statuses (legacy mode)
          project.scenes.map((scene) => {
            const status = statuses.get(scene.sequence.toString());
            if (!status) return null;

            return (
              <Card
                key={`${scene.sequence}-${status.status}-${status.error ? 'error' : 'ok'}`}
                className={status.status === "failed" ? "border-red-500 border-2" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {status.status === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      {status.status === "failed" && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      {status.status === "generating" && (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      )}
                      {status.status === "pending" && (
                        <div className="w-5 h-5 rounded-full border-2 border-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Scene {scene.sequence}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {scene.lyricCleaned}
                      </p>
                      {status.error && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-700 font-medium break-words">{status.error}</p>
                        </div>
                      )}
                      {status.imageUrl && (
                        <div className="mt-2 w-full h-20 rounded overflow-hidden border">
                          <img
                            src={status.imageUrl}
                            alt={`Scene ${scene.sequence}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Next Button */}
      {completedCount >= uniqueItems && (
        <Button onClick={onNext} size="lg" className="w-full">
          Continue to Preview & Render
        </Button>
      )}
    </div>
  );
};
