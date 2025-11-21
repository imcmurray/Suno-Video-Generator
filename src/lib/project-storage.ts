import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ProjectState } from "./project-context";
import { SceneGroup } from "../types";
import { createBlobURL, revokeGroupBlobURLs } from "./blob-manager";

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
    lyricLines: project.lyricLines,
    useGrouping: project.useGrouping,
    sceneGroups: project.sceneGroups?.map((group) => ({
      ...group, // Preserves displayMode, kenBurnsPreset, coverVerticalPosition
      // Don't save blob URLs, they won't work after reload
      imagePath: group.imagePath?.startsWith("blob:") ? undefined : group.imagePath,
      // Save mediaVersions with file references (no blob URLs)
      mediaVersions: group.mediaVersions?.map((version) => ({
        id: version.id,
        type: version.type,
        path: version.path.startsWith("blob:") ? `${group.filename.replace('.jpg', '')}_${version.label.replace(/\s+/g, '_').toLowerCase()}.${version.type === 'video' ? 'mp4' : 'jpg'}` : version.path,
        createdAt: version.createdAt,
        label: version.label,
        quality: version.quality,
        exported: version.exported,
      })),
      activeMediaId: group.activeMediaId,
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
 * Export all generated images and videos as a ZIP file with manifest
 */
export async function exportImages(project: ProjectState): Promise<void> {
  const zip = new JSZip();
  const manifest: any = { groups: {} };

  // Handle sceneGroups (current mode)
  if (project.sceneGroups && project.sceneGroups.length > 0) {
    const mediaPromises = project.sceneGroups
      .filter((group) => group.mediaVersions && group.mediaVersions.length > 0)
      .map(async (group) => {
        const groupManifest: any = { mediaVersions: [] };

        for (const version of group.mediaVersions || []) {
          try {
            // Fetch the media blob
            const response = await fetch(version.path);
            const blob = await response.blob();

            // Generate filename
            const groupNum = String(project.sceneGroups!.indexOf(group) + 1).padStart(3, '0');
            const extension = version.type === 'video' ? 'mp4' : 'jpg';
            const qualitySuffix = version.quality ? `_${version.quality}` : '';
            const filename = `group_${groupNum}_${version.label.replace(/\s+/g, '_').toLowerCase()}${qualitySuffix}.${extension}`;

            // Add to ZIP
            zip.file(filename, blob);

            // Add to manifest
            groupManifest.mediaVersions.push({
              filename,
              id: version.id,
              type: version.type,
              label: version.label,
              quality: version.quality,
              createdAt: version.createdAt,
              exported: version.exported,
            });
          } catch (error) {
            console.error(`Failed to add media ${version.label} for group ${group.id}:`, error);
          }
        }

        manifest.groups[group.id] = groupManifest;
      });

    await Promise.all(mediaPromises);
  } else {
    // Legacy: Handle scenes
    const imagePromises = project.scenes
      .filter((scene) => scene.imagePath)
      .map(async (scene) => {
        try {
          const response = await fetch(scene.imagePath!);
          const blob = await response.blob();
          zip.file(scene.filename, blob);
        } catch (error) {
          console.error(`Failed to add image ${scene.filename}:`, error);
        }
      });

    await Promise.all(imagePromises);
  }

  // Add manifest to ZIP
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = `${project.metadata.srtFile?.replace(".srt", "") || "project"}_media.zip`;

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
 * Export only prompts (all variations) for sharing or external use
 * Does not include project structure, media, or other settings
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

  // Export prompts only
  const promptsData = {
    version: "1.0", // For future compatibility
    title: project.metadata.srtFile?.replace(".srt", "") || "Untitled Project",
    groups: project.sceneGroups?.map((group) => ({
      id: group.id,
      sequence: project.sceneGroups!.indexOf(group) + 1,
      combined_lyrics: group.combinedLyrics,

      // All prompt variations
      prompt_basic: group.prompt,
      prompt_enhanced: group.enhancedPrompt || null,
      prompt_custom: group.customPrompt || null,
      selected_prompt_type: group.selectedPromptType || "basic",

      // Convenience field: the actual active prompt being used
      active_prompt: getActivePrompt(group),
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

/**
 * Export complete project as a ZIP file
 * Includes project.json, audio file, and all media (images/videos)
 */
export async function exportCompleteProject(project: ProjectState): Promise<void> {
  const zip = new JSZip();
  const manifest: any = { groups: {} };

  // 1. Add project.json with updated media paths
  const projectData = {
    metadata: project.metadata,
    scenes: project.scenes,
    lyricLines: project.lyricLines,
    useGrouping: project.useGrouping,
    sceneGroups: project.sceneGroups?.map((group) => ({
      ...group, // Preserves displayMode, kenBurnsPreset, coverVerticalPosition
      imagePath: undefined, // Will be restored from manifest
      mediaVersions: group.mediaVersions?.map((version) => ({
        ...version,
        path: undefined, // Will be restored from manifest
      })),
    })),
    apiProvider: project.apiProvider,
    imageGenerationProgress: project.imageGenerationProgress,
  };

  zip.file("project.json", JSON.stringify(projectData, null, 2));

  // 2. Add audio file
  if (project.audioFile) {
    const audioExtension = project.audioFile.name.split('.').pop() || 'wav';
    zip.file(`audio.${audioExtension}`, project.audioFile);
    manifest.audioFilename = `audio.${audioExtension}`;
  }

  // 3. Add all media files
  if (project.sceneGroups && project.sceneGroups.length > 0) {
    const mediaPromises = project.sceneGroups
      .filter((group) => group.mediaVersions && group.mediaVersions.length > 0)
      .map(async (group) => {
        const groupManifest: any = { mediaVersions: [], activeMediaId: group.activeMediaId };

        for (const version of group.mediaVersions || []) {
          try {
            // Fetch the media blob
            const response = await fetch(version.path);
            const blob = await response.blob();

            // Generate filename
            const groupNum = String(project.sceneGroups!.indexOf(group) + 1).padStart(3, '0');
            const extension = version.type === 'video' ? 'mp4' : 'jpg';
            const qualitySuffix = version.quality ? `_${version.quality}` : '';
            const filename = `group_${groupNum}_${version.label.replace(/\s+/g, '_').toLowerCase()}${qualitySuffix}.${extension}`;

            // Add to ZIP in media folder
            zip.file(`media/${filename}`, blob);

            // Add to manifest
            groupManifest.mediaVersions.push({
              filename,
              id: version.id,
              type: version.type,
              label: version.label,
              quality: version.quality,
              createdAt: version.createdAt,
              exported: version.exported,
            });
          } catch (error) {
            console.error(`Failed to add media ${version.label} for group ${group.id}:`, error);
          }
        }

        manifest.groups[group.id] = groupManifest;
      });

    await Promise.all(mediaPromises);
  }

  // 4. Add manifest
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 5. Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = `${project.metadata.srtFile?.replace(".srt", "") || "project"}_complete.zip`;

  saveAs(zipBlob, filename);
}

/**
 * Import complete project from ZIP file
 * Extracts project.json, audio file, and all media files
 */
export async function importCompleteProject(
  file: File
): Promise<{ project: Partial<ProjectState>; audioFile: File }> {
  const zip = await JSZip.loadAsync(file);

  // 1. Load project.json
  const projectJsonFile = zip.file("project.json");
  if (!projectJsonFile) {
    throw new Error("Invalid complete project file - missing project.json");
  }

  const projectJson = await projectJsonFile.async("text");
  const projectData = JSON.parse(projectJson);

  // 2. Load manifest
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid complete project file - missing manifest.json");
  }

  const manifestJson = await manifestFile.async("text");
  const manifest = JSON.parse(manifestJson);

  // 3. Load audio file
  const audioFilename = manifest.audioFilename || "audio.wav";
  const audioFile = zip.file(audioFilename);
  if (!audioFile) {
    throw new Error("Invalid complete project file - missing audio file");
  }

  const audioBlob = await audioFile.async("blob");
  const audioFileObj = new File([audioBlob], audioFilename, { type: "audio/wav" });

  // 4. Load all media files and create blob URLs
  const sceneGroups = projectData.sceneGroups?.map((group: any) => {
    const groupManifest = manifest.groups[group.id];
    if (!groupManifest) return group;

    const mediaVersions = groupManifest.mediaVersions.map((versionManifest: any) => {
      // Get the file from ZIP
      const mediaFile = zip.file(`media/${versionManifest.filename}`);
      if (!mediaFile) {
        console.warn(`Media file not found: media/${versionManifest.filename}`);
        return null;
      }

      // We'll need to create blob URLs asynchronously, so we'll do this in a second pass
      return {
        ...versionManifest,
        zipFile: mediaFile,
      };
    }).filter((v: any) => v !== null);

    return {
      ...group, // Preserves displayMode, kenBurnsPreset, coverVerticalPosition
      mediaVersions,
      activeMediaId: groupManifest.activeMediaId,
    };
  });

  // 5. Create blob URLs for all media (async operation)
  if (sceneGroups) {
    for (const group of sceneGroups) {
      // Revoke any existing blob URLs for this group before creating new ones
      revokeGroupBlobURLs(group.id);

      if (group.mediaVersions) {
        for (const version of group.mediaVersions) {
          if (version.zipFile) {
            const blob = await version.zipFile.async("blob");
            // Create and register blob URL with metadata for tracking
            version.path = createBlobURL(blob, { groupId: group.id, versionLabel: version.label });
            delete version.zipFile; // Clean up

            // Set imagePath to active media
            if (version.id === group.activeMediaId) {
              group.imagePath = version.path;
            }
          }
        }
      }
    }
  }

  return {
    project: {
      ...projectData,
      sceneGroups,
    },
    audioFile: audioFileObj,
  };
}
