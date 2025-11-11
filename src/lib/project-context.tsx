import React, { createContext, useContext, useState, ReactNode } from "react";
import { ProjectData, SceneData } from "../types";
import { APIProvider } from "./image-api";

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
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [project, setProjectState] = useState<ProjectState | null>(null);

  const setProject = (newProject: ProjectState | null) => {
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

  return (
    <ProjectContext.Provider
      value={{
        project,
        setProject,
        updateScene,
        updateScenes,
        setApiConfig,
        updateImageProgress,
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
