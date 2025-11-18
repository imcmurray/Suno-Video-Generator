import React, { useState } from "react";
import { Upload, FileAudio, FileText, Sparkles, FileJson, FileArchive } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useProject } from "../lib/project-context";
import { srtToProjectData } from "../lib/srt-parser";
import { estimateCost, APIProvider, enhanceAllPromptsWithTheme } from "../lib/image-api";
import { loadProject, importCompleteProject } from "../lib/project-storage";

export const ProjectSetup: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { setProject, setApiConfig } = useProject();
  const [mode, setMode] = useState<"create" | "import" | "import-complete">("create");
  const [files, setFiles] = useState<{
    srt?: File;
    audio?: File;
    sunoStyle?: File;
    project?: File;
    completeProject?: File;
  }>({});
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseStyle, setBaseStyle] = useState("photorealistic, cinematic");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (type: "srt" | "audio" | "sunoStyle" | "project" | "completeProject") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [type]: file }));
    }
  };

  const handleCreateProject = async () => {
    if (!files.srt || !files.audio) {
      setError("Please upload both SRT and audio files");
      return;
    }

    if (!apiKey) {
      setError("Please enter your API key");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Read SRT file
      setLoadingStatus("Reading files...");
      const srtText = await files.srt.text();

      // Read Suno style file if provided
      let sunoStyleText = "";
      if (files.sunoStyle) {
        sunoStyleText = await files.sunoStyle.text();
      }

      // Parse SRT and generate basic prompts
      setLoadingStatus("Generating basic prompts...");
      const projectData = srtToProjectData(srtText, sunoStyleText, baseStyle);

      // Enhance all prompts with AI (theme-aware)
      let enhancementFailed = false;
      if (projectData.sceneGroups && projectData.sceneGroups.length > 0) {
        try {
          setLoadingStatus(`Enhancing ${projectData.sceneGroups.length} prompts with AI...`);
          console.log('Enhancing prompts with AI...');

          // Extract basic prompts
          const basicPrompts = projectData.sceneGroups.map(group => group.prompt);

          // Enhance with theme context
          const themeContext = {
            sunoStyle: sunoStyleText,
            genre: projectData.metadata.extractedStyleElements.genres.join(', '),
            mood: projectData.metadata.extractedStyleElements.mood,
          };

          const enhancedPrompts = await enhanceAllPromptsWithTheme(
            basicPrompts,
            apiProvider,
            apiKey,
            themeContext
          );

          // Update scene groups with enhanced prompts and set default to "enhanced"
          projectData.sceneGroups = projectData.sceneGroups.map((group, index) => ({
            ...group,
            enhancedPrompt: enhancedPrompts[index],
            selectedPromptType: "enhanced" as const,
          }));

          console.log('Prompt enhancement complete!');
        } catch (enhanceError) {
          console.error('Prompt enhancement failed, continuing with basic prompts:', enhanceError);
          enhancementFailed = true;
          // Don't fail project creation - continue with basic prompts only
        }
      }

      setLoadingStatus("Creating project...");

      // Create project state
      setProject({
        ...projectData,
        metadata: {
          ...projectData.metadata,
          srtFile: files.srt.name,
          audioFile: files.audio.name,
          sunoStyleFile: files.sunoStyle?.name,
        },
        audioFile: files.audio,
        srtFile: files.srt,
        sunoStyleFile: files.sunoStyle,
        apiProvider,
        apiKey,
        imageGenerationProgress: {
          total: projectData.scenes.length,
          completed: 0,
          failed: 0,
        },
      });

      setApiConfig(apiProvider, apiKey);

      // Show warning if enhancement failed but project succeeded
      if (enhancementFailed) {
        setError("Project created successfully, but AI prompt enhancement failed. You can generate enhanced prompts later from the Edit Scene Prompts page.");
      }

      // Move to next step
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  const handleImportProject = async () => {
    if (!files.project || !files.audio) {
      setError("Please upload both project JSON and audio files");
      return;
    }

    if (!apiKey) {
      setError("Please enter your API key");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load JSON
      setLoadingStatus("Loading project file...");
      const importedData = await loadProject(files.project);

      // Validate structure
      if (!importedData.metadata || !importedData.scenes) {
        throw new Error("Invalid project file - missing required data");
      }

      setLoadingStatus("Restoring project...");

      // Transform imported data based on format
      // exportPrompts() creates "groups" with snake_case fields
      // saveProject() creates "sceneGroups" with camelCase fields
      let sceneGroups = importedData.sceneGroups;

      if (importedData.groups && !importedData.sceneGroups) {
        // Transform exportPrompts format to internal format
        sceneGroups = importedData.groups.map((group: any) => ({
          id: group.id,
          lyricLineIds: group.lyric_line_ids || group.lyricLineIds,
          start: group.start,
          end: group.end,
          duration: group.duration,
          combinedLyrics: group.combined_lyrics || group.combinedLyrics,
          prompt: group.prompt_basic || group.prompt,
          enhancedPrompt: group.prompt_enhanced || group.enhancedPrompt,
          customPrompt: group.prompt_custom || group.customPrompt,
          selectedPromptType: group.selected_prompt_type || group.selectedPromptType || "basic",
          filename: group.filename,
          isReusedGroup: group.is_reused_group || group.isReusedGroup,
          originalGroupId: group.original_group_id || group.originalGroupId,
          isInstrumental: group.is_instrumental || group.isInstrumental,
          isGap: group.is_gap || group.isGap,
          // Image/media data
          imagePath: group.image_path || group.imagePath,
          mediaVersions: group.media_versions ? group.media_versions.map((v: any) => ({
            id: v.id,
            type: v.type,
            path: v.path,
            createdAt: v.created_at || v.createdAt,
            label: v.label,
            quality: v.quality,
            exported: v.exported,
          })) : group.mediaVersions,
          activeMediaId: group.active_media_id || group.activeMediaId,
        }));
      }

      // Create project state from imported data
      setProject({
        metadata: importedData.metadata,
        scenes: importedData.scenes || [],
        lyricLines: importedData.lyricLines,
        sceneGroups: sceneGroups,
        useGrouping: importedData.useGrouping,
        audioFile: files.audio, // User must provide audio
        srtFile: files.project, // Use project file as placeholder
        apiProvider: apiProvider, // User can override
        apiKey, // User must provide API key
        imageGenerationProgress: importedData.imageGenerationProgress || {
          total: importedData.scenes?.length || 0,
          completed: 0,
          failed: 0,
        },
      });

      setApiConfig(apiProvider, apiKey);

      console.log("Project imported successfully!");
      console.log(`Loaded ${importedData.scenes?.length || 0} scenes`);
      console.log(`Loaded ${importedData.sceneGroups?.length || 0} scene groups`);

      // Move to next step
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import project");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  const handleImportCompleteProject = async () => {
    if (!files.completeProject) {
      setError("Please upload a complete project ZIP file");
      return;
    }

    if (!apiKey) {
      setError("Please enter your API key");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load complete project ZIP
      setLoadingStatus("Loading complete project...");
      const { project: importedData, audioFile } = await importCompleteProject(files.completeProject);

      // Validate structure
      if (!importedData.metadata || !importedData.scenes) {
        throw new Error("Invalid project file - missing required data");
      }

      setLoadingStatus("Restoring project...");

      // Create project state from imported data
      setProject({
        metadata: importedData.metadata,
        scenes: importedData.scenes || [],
        lyricLines: importedData.lyricLines,
        sceneGroups: importedData.sceneGroups,
        useGrouping: importedData.useGrouping,
        audioFile: audioFile, // Audio from ZIP
        srtFile: files.completeProject, // Use ZIP file as placeholder
        apiProvider: apiProvider, // User can override
        apiKey, // User must provide API key
        imageGenerationProgress: importedData.imageGenerationProgress || {
          total: importedData.scenes?.length || 0,
          completed: 0,
          failed: 0,
        },
      });

      setApiConfig(apiProvider, apiKey);

      console.log("Complete project imported successfully!");
      console.log(`Loaded ${importedData.scenes?.length || 0} scenes`);
      console.log(`Loaded ${importedData.sceneGroups?.length || 0} scene groups`);

      // Move to next step
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import complete project");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  const estimatedCost = files.srt
    ? estimateCost(files.srt ? 30 : 0, apiProvider, "hd") // Estimate ~30 scenes
    : 0;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Suno Video Generator</h1>
        <p className="text-muted-foreground">
          Create professional music videos from your Suno AI-generated songs
        </p>
      </div>

      <div className="grid gap-6">
        {/* Mode Selection */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4">
              <Button
                variant={mode === "create" ? "default" : "outline"}
                onClick={() => setMode("create")}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Create New
              </Button>
              <Button
                variant={mode === "import" ? "default" : "outline"}
                onClick={() => setMode("import")}
                className="flex-1"
              >
                <FileJson className="w-4 h-4 mr-2" />
                Import Project
              </Button>
              <Button
                variant={mode === "import-complete" ? "default" : "outline"}
                onClick={() => setMode("import-complete")}
                className="flex-1"
              >
                <FileArchive className="w-4 h-4 mr-2" />
                Import Complete
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "create" ? "Upload Files" : mode === "import" ? "Import Project Files" : "Import Complete Project"}
            </CardTitle>
            <CardDescription>
              {mode === "create"
                ? "Upload your SRT lyrics file and audio from Suno"
                : mode === "import"
                ? "Upload your exported project JSON and audio file"
                : "Upload your complete project ZIP file (includes audio and media)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "import" && (
              /* Project JSON File */
              <div className="space-y-2">
                <Label htmlFor="project-file" className="flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  Project JSON File *
                </Label>
                <Input
                  id="project-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange("project")}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer text-foreground"
                />
                {files.project && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {files.project.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Previously exported project file (*_suno-video.json)
                </p>
              </div>
            )}

            {mode === "import-complete" && (
              /* Complete Project ZIP File */
              <div className="space-y-2">
                <Label htmlFor="complete-project-file" className="flex items-center gap-2">
                  <FileArchive className="w-4 h-4" />
                  Complete Project ZIP File *
                </Label>
                <Input
                  id="complete-project-file"
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange("completeProject")}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer text-foreground"
                />
                {files.completeProject && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {files.completeProject.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Complete project ZIP file (*_complete.zip) - includes project data, audio, and all media
                </p>
              </div>
            )}

            {mode === "create" && (
              <>
                {/* SRT File */}
                <div className="space-y-2">
                  <Label htmlFor="srt-file" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    SRT Subtitle File *
                  </Label>
                  <Input
                    id="srt-file"
                    type="file"
                    accept=".srt"
                    onChange={handleFileChange("srt")}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer text-foreground"
                  />
                  {files.srt && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {files.srt.name}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Audio File - Required in create and import modes, but not import-complete */}
            {mode !== "import-complete" && (
              <div className="space-y-2">
                <Label htmlFor="audio-file" className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4" />
                  Audio File (WAV/MP3) *
                </Label>
                <Input
                  id="audio-file"
                  type="file"
                  accept=".wav,.mp3,.m4a"
                  onChange={handleFileChange("audio")}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer text-foreground"
                />
                {files.audio && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {files.audio.name}
                  </p>
                )}
                {mode === "import" && (
                  <p className="text-xs text-muted-foreground">
                    Audio file is required for video rendering
                  </p>
                )}
              </div>
            )}

            {mode === "create" && (
              /* Suno Style File (Optional) */
              <div className="space-y-2">
                <Label htmlFor="style-file" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Suno Style Prompt (Optional)
                </Label>
                <Input
                  id="style-file"
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange("sunoStyle")}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer text-foreground"
                />
                {files.sunoStyle && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {files.sunoStyle.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  The prompt you used to generate the song in Suno
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>AI Image Generation Settings</CardTitle>
            <CardDescription>
              Configure your AI provider and visual style
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* API Provider */}
            <div className="space-y-2">
              <Label htmlFor="api-provider">API Provider</Label>
              <select
                id="api-provider"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={apiProvider}
                onChange={(e) => setApiProvider(e.target.value as APIProvider)}
              >
                <option value="openai">OpenAI DALL-E 3</option>
                <option value="grok">Grok (xAI)</option>
              </select>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key *</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your API key will not be stored permanently
              </p>
            </div>

            {mode === "create" && (
              <>
                {/* Base Style */}
                <div className="space-y-2">
                  <Label htmlFor="base-style">Base Visual Style</Label>
                  <Input
                    id="base-style"
                    type="text"
                    value={baseStyle}
                    onChange={(e) => setBaseStyle(e.target.value)}
                    placeholder="photorealistic, cinematic"
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied to all scenes (e.g., "photorealistic", "anime", "oil painting")
                  </p>
                </div>

                {/* Cost Estimate */}
                {estimatedCost > 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Estimated Cost</p>
                    <p className="text-2xl font-bold">${estimatedCost.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      Based on ~30 scenes at $0.08 per image (DALL-E 3 HD)
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={
            mode === "create"
              ? handleCreateProject
              : mode === "import"
              ? handleImportProject
              : handleImportCompleteProject
          }
          disabled={
            loading ||
            !apiKey ||
            (mode === "create" && (!files.srt || !files.audio)) ||
            (mode === "import" && (!files.project || !files.audio)) ||
            (mode === "import-complete" && !files.completeProject)
          }
          size="lg"
          className="w-full"
        >
          {loading ? (
            loadingStatus ||
            (mode === "create"
              ? "Creating Project..."
              : mode === "import"
              ? "Importing Project..."
              : "Importing Complete Project...")
          ) : (
            <>
              {mode === "create" ? (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Create Project & Generate Prompts
                </>
              ) : mode === "import" ? (
                <>
                  <FileJson className="w-4 h-4 mr-2" />
                  Import Project
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4 mr-2" />
                  Import Complete Project
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
