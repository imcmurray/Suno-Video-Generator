import React, { useState } from "react";
import { Upload, FileAudio, FileText, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useProject } from "../lib/project-context";
import { srtToProjectData } from "../lib/srt-parser";
import { estimateCost, APIProvider } from "../lib/image-api";

export const ProjectSetup: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { setProject, setApiConfig } = useProject();
  const [files, setFiles] = useState<{
    srt?: File;
    audio?: File;
    sunoStyle?: File;
  }>({});
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseStyle, setBaseStyle] = useState("photorealistic, cinematic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (type: "srt" | "audio" | "sunoStyle") => (
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
      const srtText = await files.srt.text();

      // Read Suno style file if provided
      let sunoStyleText = "";
      if (files.sunoStyle) {
        sunoStyleText = await files.sunoStyle.text();
      }

      // Parse SRT and generate prompts
      const projectData = srtToProjectData(srtText, sunoStyleText, baseStyle);

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

      // Move to next step
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
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
        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <CardDescription>
              Upload your SRT lyrics file and audio from Suno
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {files.srt && (
                <p className="text-sm text-muted-foreground">
                  Selected: {files.srt.name}
                </p>
              )}
            </div>

            {/* Audio File */}
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
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {files.audio && (
                <p className="text-sm text-muted-foreground">
                  Selected: {files.audio.name}
                </p>
              )}
            </div>

            {/* Suno Style File (Optional) */}
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
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
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
          onClick={handleCreateProject}
          disabled={loading || !files.srt || !files.audio || !apiKey}
          size="lg"
          className="w-full"
        >
          {loading ? (
            "Creating Project..."
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Create Project & Generate Prompts
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
