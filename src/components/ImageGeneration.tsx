import React, { useState, useEffect } from "react";
import { Image as ImageIcon, CheckCircle2, XCircle, Loader2, Play, Pause } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { useProject } from "../lib/project-context";
import { generateImage, estimateCost } from "../lib/image-api";
import { SceneData } from "../types";

interface SceneGenerationStatus {
  sequence: number;
  status: "pending" | "generating" | "completed" | "failed";
  error?: string;
  imageUrl?: string;
}

export const ImageGeneration: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { project, updateScene, updateImageProgress } = useProject();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sceneStatuses, setSceneStatuses] = useState<Map<number, SceneGenerationStatus>>(
    new Map()
  );

  useEffect(() => {
    if (!project) return;

    // Initialize statuses
    const initialStatuses = new Map<number, SceneGenerationStatus>();
    project.scenes.forEach((scene) => {
      initialStatuses.set(scene.sequence, {
        sequence: scene.sequence,
        status: scene.imagePath ? "completed" : "pending",
        imageUrl: scene.imagePath,
      });
    });
    setSceneStatuses(initialStatuses);
  }, [project]);

  const updateStatus = (sequence: number, updates: Partial<SceneGenerationStatus>) => {
    setSceneStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(sequence) || {
        sequence,
        status: "pending" as const,
      };
      next.set(sequence, { ...current, ...updates });
      return next;
    });
  };

  const generateImagesSequentially = async () => {
    if (!project || !project.apiProvider || !project.apiKey) return;

    setIsGenerating(true);
    setIsPaused(false);

    const scenesToGenerate = project.scenes.filter(
      (scene) => !scene.imagePath
    );

    let completed = project.scenes.filter((s) => s.imagePath).length;
    let failed = 0;

    for (const scene of scenesToGenerate) {
      if (isPaused) break;

      updateStatus(scene.sequence, { status: "generating" });
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
          // Convert Blob to URL
          const imageUrl = URL.createObjectURL(result.imageData);

          // Update scene with image
          updateScene(scene.sequence, { imagePath: imageUrl });
          updateStatus(scene.sequence, {
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
        updateStatus(scene.sequence, {
          status: "failed",
          error: errorMessage,
        });
        failed++;
        updateImageProgress({ failed });
      }

      // Rate limiting - wait 2 seconds between requests
      if (scenesToGenerate.indexOf(scene) < scenesToGenerate.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
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

    const failedScenes = Array.from(sceneStatuses.values()).filter(
      (s) => s.status === "failed"
    );

    for (const status of failedScenes) {
      updateStatus(status.sequence, { status: "pending", error: undefined });
    }

    generateImagesSequentially();
  };

  if (!project) return null;

  const totalScenes = project.scenes.length;
  const completedCount = Array.from(sceneStatuses.values()).filter(
    (s) => s.status === "completed"
  ).length;
  const failedCount = Array.from(sceneStatuses.values()).filter(
    (s) => s.status === "failed"
  ).length;
  const progressPercent = (completedCount / totalScenes) * 100;
  const estimatedCost = estimateCost(
    totalScenes - completedCount,
    project.apiProvider || "openai",
    "hd"
  );

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Generate Images</h1>
        <p className="text-muted-foreground">
          Generate AI images for each scene using {project.apiProvider?.toUpperCase()}
        </p>
      </div>

      {/* Progress Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generation Progress</CardTitle>
          <CardDescription>
            {completedCount} of {totalScenes} images generated
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
            {!isGenerating && completedCount < totalScenes && (
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

      {/* Scene Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {project.scenes.map((scene) => {
          const status = sceneStatuses.get(scene.sequence);
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
        })}
      </div>

      {/* Next Button */}
      {completedCount === totalScenes && (
        <Button onClick={onNext} size="lg" className="w-full">
          Continue to Preview & Render
        </Button>
      )}
    </div>
  );
};
