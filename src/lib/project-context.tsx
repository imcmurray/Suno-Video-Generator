import React, { createContext, useContext, useState, ReactNode } from "react";
import { ProjectData, SceneData, OutroConfig } from "../types";
import { APIProvider } from "./image-api";
import { revokeAllBlobURLs } from "./blob-manager";

// Default outro configuration
export const DEFAULT_OUTRO_CONFIG: OutroConfig = {
  enabled: false,
  duration: 20,
  appName: "Suno Video Generator",
  githubUrl: "github.com/imcmurray/Suno-Video-Generator",
};

export interface ProjectState extends ProjectData {
  audioFile?: File;
  srtFile?: File;
  sunoStyleFile?: File;
  apiProvider?: APIProvider;
  apiKey?: string;
  imageGenerationProgress: {
    total: number;
    completed: number;
    failed: number;
    current?: number;
  };
}

interface ProjectContextType {
  project: ProjectState | null;
  setProject: (project: ProjectState | null) => void;
  updateScene: (sequence: number, updates: Partial<SceneData>) => void;
  updateScenes: (scenes: SceneData[]) => void;
  setApiConfig: (provider: APIProvider, apiKey: string) => void;
  updateImageProgress: (progress: Partial<ProjectState["imageGenerationProgress"]>) => void;
  updateOutroConfig: (updates: Partial<OutroConfig>) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [project, setProjectState] = useState<ProjectState | null>(null);

  const setProject = (newProject: ProjectState | null) => {
    // Detect if we're switching to a completely different project
    const isSwitchingProjects =
      // Case 1: Clearing the project (null)
      newProject === null ||
      // Case 2: Starting a new project when none exists
      (project === null && newProject !== null) ||
      // Case 3: Loading a different project (different SRT file name or no previous project)
      (project !== null && newProject !== null &&
       project.metadata.srtFile !== newProject.metadata.srtFile);

    // Revoke all blob URLs when switching to a different project
    if (isSwitchingProjects && project !== null) {
      console.log('[ProjectContext] Switching projects - revoking all blob URLs');
      revokeAllBlobURLs();
    }

    setProjectState(newProject);
  };

  const updateScene = (sequence: number, updates: Partial<SceneData>) => {
    if (!project) return;

    const updatedScenes = project.scenes.map((scene) =>
      scene.sequence === sequence ? { ...scene, ...updates } : scene
    );

    setProjectState({
      ...project,
      scenes: updatedScenes,
    });
  };

  const updateScenes = (scenes: SceneData[]) => {
    if (!project) return;
    setProjectState({
      ...project,
      scenes,
    });
  };

  const setApiConfig = (provider: APIProvider, apiKey: string) => {
    if (!project) return;
    setProjectState({
      ...project,
      apiProvider: provider,
      apiKey,
    });
  };

  const updateImageProgress = (progress: Partial<ProjectState["imageGenerationProgress"]>) => {
    if (!project) return;
    setProjectState({
      ...project,
      imageGenerationProgress: {
        ...project.imageGenerationProgress,
        ...progress,
      },
    });
  };

  const updateOutroConfig = (updates: Partial<OutroConfig>) => {
    if (!project) return;
    setProjectState({
      ...project,
      outroConfig: {
        ...(project.outroConfig || DEFAULT_OUTRO_CONFIG),
        ...updates,
      },
    });
  };

  return (
    <ProjectContext.Provider
      value={{
        project,
        setProject,
        updateScene,
        updateScenes,
        setApiConfig,
        updateImageProgress,
        updateOutroConfig,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};
