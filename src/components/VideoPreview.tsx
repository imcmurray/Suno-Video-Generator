import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { prefetch } from "remotion";
import { Play, Download, FileVideo, Save, FileArchive, FileText, FileJson } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useProject } from "../lib/project-context";
import { VideoComposition } from "../remotion/VideoComposition";
import { saveProject, exportImages, exportSRT, exportPrompts, exportCompleteProject } from "../lib/project-storage";

export const VideoPreview: React.FC = () => {
  const { project } = useProject();
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderedVideoJobId, setRenderedVideoJobId] = useState<string | null>(null);

  if (!project || !project.audioFile) return null;

  // FPS constant
  const fps = 30;

  // Refs for syncing audio with Player
  const playerRef = useRef<PlayerRef>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Create blob URL for audio
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupAudio = async () => {
      console.log("Setting up audio with prefetch...");
      console.log("Audio file type:", project.audioFile!.type);
      console.log("Audio file size:", project.audioFile!.size, "bytes");

      const blobUrl = URL.createObjectURL(project.audioFile!);
      console.log("✓ Audio blob URL created:", blobUrl);

      // Prefetch the audio so Remotion Player can use it
      console.log("Prefetching audio for Remotion...");
      const { free, waitUntilDone } = prefetch(blobUrl, {
        method: "blob-url",
      });

      await waitUntilDone();
      console.log("✓ Audio prefetch complete");
      setAudioUrl(blobUrl);

      cleanup = () => {
        console.log("Cleaning up audio resources");
        free();
        URL.revokeObjectURL(blobUrl);
      };
    };

    setupAudio();

    return () => cleanup?.();
  }, [project.audioFile]);

  // Sync HTML5 audio with Remotion Player
  useEffect(() => {
    const player = playerRef.current;
    const audio = audioRef.current;

    if (!player || !audio || !audioUrl) return;

    console.log("[Audio Sync] Setting up audio synchronization");

    // Handle play event
    const handlePlay = () => {
      console.log("[Audio Sync] Player started playing");
      setIsPlaying(true);
      const currentFrame = player.getCurrentFrame();
      const currentTime = currentFrame / fps;
      audio.currentTime = currentTime;
      audio.play().catch(err => console.error("[Audio Sync] Play failed:", err));
    };

    // Handle pause event
    const handlePause = () => {
      console.log("[Audio Sync] Player paused");
      setIsPlaying(false);
      audio.pause();
    };

    // Handle seek event
    const handleSeek = (e: { detail: { frame: number } }) => {
      const currentTime = e.detail.frame / fps;
      console.log("[Audio Sync] Seeking to:", currentTime.toFixed(2), "seconds");
      audio.currentTime = currentTime;
    };

    // Handle frame update for time sync (throttled)
    let lastSyncFrame = 0;
    const handleFrameUpdate = (e: { detail: { frame: number } }) => {
      // Only sync every 30 frames (1 second) to avoid overhead
      if (Math.abs(e.detail.frame - lastSyncFrame) > 30) {
        lastSyncFrame = e.detail.frame;
        const expectedTime = e.detail.frame / fps;
        const actualTime = audio.currentTime;
        const drift = Math.abs(expectedTime - actualTime);

        // Re-sync if drift exceeds 0.2 seconds
        if (drift > 0.2 && isPlaying) {
          console.log("[Audio Sync] Correcting drift:", drift.toFixed(3), "seconds");
          audio.currentTime = expectedTime;
        }
      }
    };

    // Subscribe to Player events
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("seeked", handleSeek as any);
    player.addEventListener("frameupdate", handleFrameUpdate as any);

    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("seeked", handleSeek as any);
      player.removeEventListener("frameupdate", handleFrameUpdate as any);
    };
  }, [audioUrl, fps, isPlaying]);

  // Check if using grouping mode
  const usingGrouping = project.useGrouping && project.sceneGroups && project.lyricLines;

  // Calculate total duration in frames
  let totalDurationSeconds = usingGrouping
    ? (project.sceneGroups && project.sceneGroups.length > 0
        ? project.sceneGroups[project.sceneGroups.length - 1].end
        : 60)
    : (project.scenes[project.scenes.length - 1]?.end || 60);

  // Add outro duration if enabled
  if (project.outroConfig?.enabled) {
    totalDurationSeconds += project.outroConfig.duration;
  }

  const durationInFrames = Math.floor(totalDurationSeconds * fps);

  const compositionProps = {
    scenes: project.scenes,
    audioPath: audioUrl,
    sceneGroups: project.sceneGroups,
    lyricLines: project.lyricLines,
    useGrouping: project.useGrouping,
    outroConfig: project.outroConfig,
  };

  // Show loading message while audio is being prefetched
  if (!audioUrl) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading Audio...</CardTitle>
            <CardDescription>Prefetching audio for playback</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleRender = async () => {
    if (!project || !project.audioFile) {
      alert("Project or audio not ready");
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);
    setRenderJobId(null);

    try {
      // Create FormData to send audio file and media files to backend
      const formData = new FormData();
      formData.append("audioFile", project.audioFile);

      // Upload media files from sceneGroups
      if (usingGrouping && project.sceneGroups) {
        console.log("Collecting media files from scene groups...");

        for (const group of project.sceneGroups) {
          // Skip reused groups - they'll reference the original group's media
          if (group.isReusedGroup) continue;

          if (group.imagePath) {
            try {
              // Fetch the blob URL and convert to File
              const response = await fetch(group.imagePath);
              const blob = await response.blob();

              // Determine file extension based on media type
              const activeVersion = group.mediaVersions?.find(v => v.id === group.activeMediaId);
              const isVideo = activeVersion?.type === 'video';
              const extension = isVideo ? 'mp4' : 'jpg';
              const filename = `${group.filename || `group_${group.id}`}.${extension}`;

              const file = new File([blob], filename, { type: blob.type });

              // Upload with a unique key
              const fileKey = `media_${group.id}`;
              formData.append(fileKey, file);
              console.log(`Added ${isVideo ? 'video' : 'image'}: ${fileKey} (${filename})`);
            } catch (error) {
              console.error(`Failed to upload media for group ${group.id}:`, error);
            }
          }
        }

        // Send sceneGroups metadata (without blob URLs, use file keys instead)
        const sceneGroupsForBackend = project.sceneGroups.map(group => ({
          id: group.id,
          lyricLineIds: group.lyricLineIds,
          start: group.start,
          end: group.end,
          duration: group.duration,
          combinedLyrics: group.combinedLyrics,
          prompt: group.prompt,
          filename: group.filename,
          isReusedGroup: group.isReusedGroup,
          originalGroupId: group.originalGroupId,
          isInstrumental: group.isInstrumental,
          // Add media file key for backend to map
          mediaFileKey: group.isReusedGroup ? undefined : `media_${group.id}`,
          // Include media type metadata for correct rendering
          mediaVersions: group.mediaVersions,
          activeMediaId: group.activeMediaId,
          // Include display configuration
          displayMode: group.displayMode,
          kenBurnsPreset: group.kenBurnsPreset,
          coverVerticalPosition: group.coverVerticalPosition,
        }));

        formData.append("sceneGroups", JSON.stringify(sceneGroupsForBackend));
        formData.append("lyricLines", JSON.stringify(project.lyricLines));
        formData.append("useGrouping", "true");
        console.log(`Prepared ${sceneGroupsForBackend.length} scene groups for render`);
      } else {
        // Legacy mode: send scenes (backward compatibility)
        formData.append("scenes", JSON.stringify(project.scenes));
      }

      formData.append("metadata", JSON.stringify(project.metadata));

      // Include outro configuration if enabled
      if (project.outroConfig) {
        formData.append("outroConfig", JSON.stringify(project.outroConfig));
      }

      // Start render job
      console.log("Starting render job...");
      const response = await fetch("http://localhost:3002/api/render", {
        method: "POST",
        body: formData, // Send as multipart/form-data
      });

      if (!response.ok) {
        throw new Error(`Failed to start render: ${response.statusText}`);
      }

      const data = await response.json();
      const jobId = data.jobId;
      setRenderJobId(jobId);

      console.log(`Render job started: ${jobId}`);

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:3002/api/render/${jobId}/status`);
          if (!statusResponse.ok) {
            throw new Error("Failed to get render status");
          }

          const statusData = await statusResponse.json();
          setRenderProgress(statusData.progress);

          console.log(`Render progress: ${statusData.progress.toFixed(1)}% (${statusData.status})`);

          if (statusData.status === "completed") {
            clearInterval(pollInterval);
            setIsRendering(false);
            setRenderedVideoJobId(jobId);

            // Download the video
            window.location.href = `http://localhost:3002/api/render/${jobId}/download`;

            alert("Video rendered successfully! Download started.");
          } else if (statusData.status === "failed") {
            clearInterval(pollInterval);
            setIsRendering(false);
            throw new Error(statusData.error || "Render failed");
          }
        } catch (error) {
          clearInterval(pollInterval);
          setIsRendering(false);
          throw error;
        }
      }, 2000); // Poll every 2 seconds
    } catch (error) {
      console.error("Render error:", error);
      alert(`Render failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsRendering(false);
    }
  };

  const handleReDownload = () => {
    if (renderedVideoJobId) {
      window.location.href = `http://localhost:3002/api/render/${renderedVideoJobId}/download`;
    }
  };

  const handleRenderAgain = () => {
    setRenderedVideoJobId(null);
    setRenderJobId(null);
    setRenderProgress(0);
    setIsRendering(false);
  };

  const handleSaveProject = async () => {
    if (!project) return;
    try {
      await saveProject(project);
    } catch (error) {
      alert("Failed to save project: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleExportImages = async () => {
    if (!project) return;
    const hasImages = project.scenes.some((s) => s.imagePath);
    if (!hasImages) {
      alert("No images to export. Generate images first.");
      return;
    }
    try {
      await exportImages(project);
    } catch (error) {
      alert("Failed to export images: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleExportSRT = () => {
    if (!project) return;
    try {
      exportSRT(project);
    } catch (error) {
      alert("Failed to export SRT: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleExportPrompts = () => {
    if (!project) return;
    try {
      exportPrompts(project);
    } catch (error) {
      alert("Failed to export prompts: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleExportCompleteProject = async () => {
    if (!project) return;
    if (!project.audioFile) {
      alert("Cannot export complete project without audio file");
      return;
    }
    try {
      await exportCompleteProject(project);
    } catch (error) {
      alert("Failed to export complete project: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Preview & Render</h1>
        <p className="text-muted-foreground">
          Preview your video with the Remotion Player, then render to final MP4
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Video Preview</CardTitle>
              <CardDescription>
                Real-time preview with timeline scrubbing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-black rounded-lg overflow-hidden">
                <Player
                  ref={playerRef}
                  component={VideoComposition as any}
                  inputProps={compositionProps}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  compositionWidth={1920}
                  compositionHeight={1080}
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                  }}
                  controls
                  loop
                  clickToPlay
                  showVolumeControls={true}
                  allowFullscreen={true}
                  initiallyShowControls={5000}
                  spaceKeyToPlayOrPause={true}
                  autoPlay={false}
                  initiallyMuted={true}
                  numberOfSharedAudioTags={0}
                />
              </div>

              {/* Hidden HTML5 audio element synced with Player */}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  preload="auto"
                  style={{ display: "none" }}
                />
              )}

              {/* Scene/Group Timeline */}
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">
                  {usingGrouping ? "Group Timeline" : "Scene Timeline"}
                </p>
                <div className="flex gap-1 h-8 bg-muted rounded overflow-hidden">
                  {usingGrouping && project.sceneGroups ? (
                    project.sceneGroups.map((group, index) => {
                      const widthPercent =
                        (group.duration / totalDurationSeconds) * 100;
                      return (
                        <div
                          key={group.id}
                          className="bg-primary hover:bg-primary/80 transition-colors cursor-pointer relative group"
                          style={{ width: `${widthPercent}%` }}
                          title={group.combinedLyrics}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-primary-foreground font-medium opacity-0 group-hover:opacity-100">
                              {index + 1}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    project.scenes.map((scene) => {
                      const widthPercent =
                        (scene.duration / totalDurationSeconds) * 100;
                      return (
                        <div
                          key={scene.sequence}
                          className="bg-primary hover:bg-primary/80 transition-colors cursor-pointer relative group"
                          style={{ width: `${widthPercent}%` }}
                          title={scene.lyricCleaned}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-primary-foreground font-medium opacity-0 group-hover:opacity-100">
                              {scene.sequence}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0:00</span>
                  <span>
                    {Math.floor(totalDurationSeconds / 60)}:
                    {String(Math.floor(totalDurationSeconds % 60)).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Panel - Takes up 1 column */}
        <div className="space-y-6">
          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {usingGrouping ? "Total Groups" : "Total Scenes"}
                </p>
                <p className="text-lg font-semibold">
                  {usingGrouping && project.sceneGroups
                    ? project.sceneGroups.length
                    : project.scenes.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">
                  {Math.floor(totalDurationSeconds / 60)}:
                  {String(Math.floor(totalDurationSeconds % 60)).padStart(2, "0")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolution</p>
                <p className="text-lg font-semibold">1920x1080 (Full HD)</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Frame Rate</p>
                <p className="text-lg font-semibold">30 fps</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Audio</p>
                <p className="text-sm truncate">{project.audioFile?.name}</p>
              </div>
            </CardContent>
          </Card>

          {/* Render Options */}
          <Card>
            <CardHeader>
              <CardTitle>Export Video</CardTitle>
              <CardDescription>
                Render your final video in high quality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Output Settings</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Format: MOV (H.264)</p>
                  <p>• Quality: High (8 Mbps, BT.709)</p>
                  <p>• Audio: PCM Lossless (~1.5 Mbps)</p>
                  <p>• Ken Burns effects enabled</p>
                </div>
              </div>

              {renderedVideoJobId && !isRendering ? (
                <>
                  <Button
                    onClick={handleReDownload}
                    size="lg"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Video
                  </Button>
                  <Button
                    onClick={handleRenderAgain}
                    variant="outline"
                    size="lg"
                    className="w-full mt-2"
                  >
                    <FileVideo className="w-4 h-4 mr-2" />
                    Render Again
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleRender}
                  disabled={isRendering}
                  size="lg"
                  className="w-full"
                >
                  {isRendering ? (
                    <>
                      <FileVideo className="w-4 h-4 mr-2 animate-pulse" />
                      Rendering... {renderProgress.toFixed(1)}%
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Render Video
                    </>
                  )}
                </Button>
              )}

              {isRendering && (
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
              )}

              {!isRendering && !renderedVideoJobId && (
                <p className="text-xs text-muted-foreground text-center">
                  Estimated render time: {Math.ceil(totalDurationSeconds / 10)} - {Math.ceil(totalDurationSeconds / 5)} minutes
                </p>
              )}

              {renderedVideoJobId && !isRendering && (
                <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
                  <p className="text-xs font-medium">Video Rendered Successfully</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">Server location:</span> /server/outputs/{renderedVideoJobId}.mov
                    </p>
                    <p>
                      <span className="font-medium">Browser download:</span> Check your downloads folder for music-video-{renderedVideoJobId}.mov
                    </p>
                  </div>
                </div>
              )}

              {renderJobId && isRendering && (
                <p className="text-xs text-muted-foreground text-center">
                  Job ID: {renderJobId}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Export Project */}
          <Card>
            <CardHeader>
              <CardTitle>Export Project</CardTitle>
              <CardDescription>
                Save your work and export assets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={handleSaveProject}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Project (JSON)
              </Button>

              <Button
                onClick={handleExportImages}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <FileArchive className="w-4 h-4 mr-2" />
                Export Media (ZIP)
              </Button>

              <Button
                onClick={handleExportSRT}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export SRT for YouTube
              </Button>

              <Button
                onClick={handleExportPrompts}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <FileJson className="w-4 h-4 mr-2" />
                Export Prompts (JSON)
              </Button>

              <Button
                onClick={handleExportCompleteProject}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <FileArchive className="w-4 h-4 mr-2" />
                Export Complete Project (ZIP)
              </Button>
            </CardContent>
          </Card>

          {/* Scene/Group List */}
          <Card>
            <CardHeader>
              <CardTitle>{usingGrouping ? "Groups" : "Scenes"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {usingGrouping && project.sceneGroups ? (
                  project.sceneGroups.map((group, index) => {
                    const groupLines = project.lyricLines?.filter((line) =>
                      group.lyricLineIds.includes(line.id)
                    );

                    return (
                      <div
                        key={group.id}
                        className="flex items-start gap-2 p-2 hover:bg-accent rounded text-sm"
                      >
                        <span className="font-semibold text-muted-foreground min-w-[2rem]">
                          {index + 1}.
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{group.combinedLyrics}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.duration.toFixed(1)}s • {groupLines?.length || 0} line(s)
                          </p>
                          {group.isReusedGroup && (
                            <span className="text-xs text-blue-600">Reused</span>
                          )}
                          {group.isInstrumental && (
                            <span className="text-xs text-purple-600">Instrumental</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  project.scenes.map((scene) => (
                    <div
                      key={scene.sequence}
                      className="flex items-start gap-2 p-2 hover:bg-accent rounded text-sm"
                    >
                      <span className="font-semibold text-muted-foreground min-w-[2rem]">
                        {scene.sequence}.
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{scene.lyricCleaned}</p>
                        <p className="text-xs text-muted-foreground">
                          {scene.duration.toFixed(1)}s
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
