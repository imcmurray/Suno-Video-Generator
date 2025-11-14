import React, { useState, useEffect } from "react";
import { Image as ImageIcon, CheckCircle2, XCircle, Loader2, Play, Pause, Link2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { useProject } from "../lib/project-context";
import { generateImage, estimateCost } from "../lib/image-api";
import { SceneData, SceneGroup } from "../types";

interface GenerationStatus {
  id: string; // scene sequence or group ID
  status: "pending" | "generating" | "completed" | "failed" | "reused";
  error?: string;
  imageUrl?: string;
  label: string; // Display label
  isReused?: boolean;
}

export const ImageGeneration: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { project, updateScene, updateImageProgress, setProject } = useProject();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statuses, setStatuses] = useState<Map<string, GenerationStatus>>(new Map());

  const usingGrouping = project?.useGrouping && project?.sceneGroups && project?.lyricLines;

  useEffect(() => {
    if (!project) return;

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
  }, [project, usingGrouping]);

  const updateStatus = (id: string, updates: Partial<GenerationStatus>) => {
    setStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) {
        next.set(id, { ...current, ...updates });
      }
      return next;
    });
  };

  const updateGroupImage = (groupId: string, imageUrl: string) => {
    if (!project || !project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((group) => {
      if (group.id === groupId) {
        return { ...group, imagePath: imageUrl };
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
        if (isPaused) break;

        updateStatus(group.id, { status: "generating" });

        try {
          const result = await generateImage({
            prompt: group.prompt,
            provider: project.apiProvider,
            apiKey: project.apiKey,
            size: "1792x1024",
            quality: "hd",
          });

          if (result.success && result.imageData) {
            const imageUrl = URL.createObjectURL(result.imageData);
            updateGroupImage(group.id, imageUrl);
            updateStatus(group.id, {
              status: "completed",
              imageUrl,
            });

            completed++;
            updateImageProgress({ completed });
          } else {
            throw new Error(result.error || "Image generation failed");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          updateStatus(group.id, {
            status: "failed",
            error: errorMessage,
          });
          failed++;
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
        if (isPaused) break;

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

          if (result.success && result.imageData) {
            const imageUrl = URL.createObjectURL(result.imageData);
            updateScene(scene.sequence, { imagePath: imageUrl });
            updateStatus(scene.sequence.toString(), {
              status: "completed",
              imageUrl,
            });

            completed++;
            updateImageProgress({ completed });
          } else {
            throw new Error(result.error || "Image generation failed");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          updateStatus(scene.sequence.toString(), {
            status: "failed",
            error: errorMessage,
          });
          failed++;
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
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
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
              <Card key={group.id}>
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
                      {status.status === "generating" && (
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
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {group.combinedLyrics}
                      </p>
                      {status.error && (
                        <p className="text-xs text-red-600 mt-1">{status.error}</p>
                      )}
                      {status.imageUrl && (
                        <div className="mt-2 w-full h-20 rounded overflow-hidden border">
                          <img
                            src={status.imageUrl}
                            alt={`Group ${index + 1}`}
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
        ) : (
          // Render scene statuses (legacy mode)
          project.scenes.map((scene) => {
            const status = statuses.get(scene.sequence.toString());
            if (!status) return null;

            return (
              <Card key={scene.sequence}>
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
                        <p className="text-xs text-red-600 mt-1">{status.error}</p>
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
