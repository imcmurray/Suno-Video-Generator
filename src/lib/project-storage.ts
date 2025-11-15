import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ProjectState } from "./project-context";
import { SceneGroup } from "../types";

/**
 * Save project state to JSON file
 */
export async function saveProject(project: ProjectState): Promise<void> {
  const projectData = {
    metadata: project.metadata,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      // Don't save blob URLs, they won't work after reload
      imagePath: scene.imagePath?.startsWith("blob:") ? undefined : scene.imagePath,
    })),
    apiProvider: project.apiProvider,
    imageGenerationProgress: project.imageGenerationProgress,
  };

  const json = JSON.stringify(projectData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `${project.metadata.srtFile?.replace(".srt", "") || "project"}_suno-video.json`;

  saveAs(blob, filename);
}

/**
 * Export all generated images as a ZIP file
 */
export async function exportImages(project: ProjectState): Promise<void> {
  const zip = new JSZip();
  const imagesFolder = zip.folder("images");

  if (!imagesFolder) {
    throw new Error("Failed to create images folder in ZIP");
  }

  // Collect all images
  const imagePromises = project.scenes
    .filter((scene) => scene.imagePath)
    .map(async (scene) => {
      try {
        // Fetch the image blob
        const response = await fetch(scene.imagePath!);
        const blob = await response.blob();

        // Add to ZIP
        imagesFolder.file(scene.filename, blob);
      } catch (error) {
        console.error(`Failed to add image ${scene.filename}:`, error);
      }
    });

  await Promise.all(imagePromises);

  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = `${project.metadata.srtFile?.replace(".srt", "") || "project"}_images.zip`;

  saveAs(zipBlob, filename);
}

/**
 * Export SRT file for YouTube upload
 */
export function exportSRT(project: ProjectState): void {
  // Generate SRT content from scenes
  const srtContent = project.scenes
    .map((scene) => {
      // Format: HH:MM:SS,mmm
      const formatTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };

      return [
        scene.sequence,
        `${formatTime(scene.start)} --> ${formatTime(scene.end)}`,
        scene.lyric,
        "", // Empty line between entries
      ].join("\n");
    })
    .join("\n");

  const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
  const filename = `${project.metadata.srtFile?.replace(".srt", "") || "project"}.srt`;

  saveAs(blob, filename);
}

/**
 * Export prompts as JSON for reference
 */
export function exportPrompts(project: ProjectState): void {
  // Helper to get the active prompt based on user's selection
  const getActivePrompt = (group: SceneGroup): string => {
    if (group.selectedPromptType === "custom" && group.customPrompt) {
      return group.customPrompt;
    } else if (group.selectedPromptType === "enhanced" && group.enhancedPrompt) {
      return group.enhancedPrompt;
    }
    return group.prompt; // Default to basic
  };

  // Export scene groups with all prompt variations
  const promptsData = {
    metadata: project.metadata,
    groups: project.sceneGroups?.map((group) => ({
      id: group.id,
      sequence: project.sceneGroups!.indexOf(group) + 1,
      start: group.start,
      end: group.end,
      duration: group.duration,
      combined_lyrics: group.combinedLyrics,
      lyric_line_ids: group.lyricLineIds,
      filename: group.filename,

      // All prompt variations
      prompt_basic: group.prompt,
      prompt_enhanced: group.enhancedPrompt || null,
      prompt_custom: group.customPrompt || null,
      selected_prompt_type: group.selectedPromptType || "basic",

      // Convenience field: the actual active prompt being used
      active_prompt: getActivePrompt(group),

      // Metadata
      is_reused_group: group.isReusedGroup,
      original_group_id: group.originalGroupId || null,
      is_instrumental: group.isInstrumental,
      is_gap: group.isGap || false,
    })) || [],
  };

  const json = JSON.stringify(promptsData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `${project.metadata.srtFile?.replace(".srt", "") || "project"}_prompts.json`;

  saveAs(blob, filename);
}

/**
 * Load project from JSON file
 */
export async function loadProject(file: File): Promise<Partial<ProjectState>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);
        resolve(data);
      } catch (error) {
        reject(new Error("Failed to parse project file"));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
