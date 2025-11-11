import React, { useState } from "react";
import { Edit2, Image as ImageIcon, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useProject } from "../lib/project-context";
import { SceneData } from "../types";
import { ImageVariationPicker } from "./ImageVariationPicker";

interface SceneEditorProps {
  scene: SceneData;
  onUpdate: (updates: Partial<SceneData>) => void;
  onRegenerate: (scene: SceneData) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

const SceneEditor: React.FC<SceneEditorProps> = ({
  scene,
  onUpdate,
  onRegenerate,
  isExpanded,
  onToggle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.prompt);

  const handleSave = () => {
    onUpdate({ prompt: editedPrompt });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedPrompt(scene.prompt);
    setIsEditing(false);
  };

  return (
    <Card>
      <div
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold">
              {scene.sequence}
            </div>
            <div>
              <p className="font-medium">{scene.lyric}</p>
              <p className="text-sm text-muted-foreground">
                {scene.start.toFixed(1)}s - {scene.end.toFixed(1)}s ({scene.duration.toFixed(1)}s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {scene.imagePath && (
              <div className="w-16 h-9 rounded overflow-hidden border">
                <img
                  src={scene.imagePath}
                  alt={`Scene ${scene.sequence}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <CardContent className="border-t space-y-4">
          {/* Cleaned Lyric */}
          <div>
            <Label className="text-xs text-muted-foreground">Cleaned Lyric</Label>
            <p className="text-sm">{scene.lyricCleaned}</p>
          </div>

          {/* Prompt Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>AI Image Prompt</Label>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm bg-muted p-3 rounded">{scene.prompt}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {scene.imagePath ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegenerate(scene)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Image
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => onRegenerate(scene)}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Generate Image
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export const PromptEditor: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { project, updateScene } = useProject();
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [pickerScene, setPickerScene] = useState<SceneData | null>(null);

  if (!project) return null;

  const toggleScene = (sequence: number) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sequence)) {
        next.delete(sequence);
      } else {
        next.add(sequence);
      }
      return next;
    });
  };

  const handleRegenerateScene = (scene: SceneData) => {
    setPickerScene(scene);
  };

  const handleVariationSelected = (imageUrl: string) => {
    if (pickerScene) {
      updateScene(pickerScene.sequence, { imagePath: imageUrl });
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Edit Scene Prompts</h1>
        <p className="text-muted-foreground">
          Review and customize the AI image prompts for each scene
        </p>
      </div>

      {/* Project Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Scenes</p>
            <p className="text-2xl font-bold">{project.scenes.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Base Style</p>
            <p className="text-sm font-medium">{project.metadata.baseStyle}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Visual Theme</p>
            <p className="text-sm font-medium">
              {project.metadata.extractedStyleElements.visualKeywords || "None"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mood</p>
            <p className="text-sm font-medium">
              {project.metadata.extractedStyleElements.mood || "None"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scene List */}
      <div className="space-y-3 mb-6">
        {project.scenes.map((scene) => (
          <SceneEditor
            key={scene.sequence}
            scene={scene}
            onUpdate={(updates) => updateScene(scene.sequence, updates)}
            onRegenerate={handleRegenerateScene}
            isExpanded={expandedScenes.has(scene.sequence)}
            onToggle={() => toggleScene(scene.sequence)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={onNext} size="lg" className="flex-1">
          Continue to Image Generation
        </Button>
      </div>

      {/* Image Variation Picker Dialog */}
      {pickerScene && (
        <ImageVariationPicker
          scene={pickerScene}
          isOpen={pickerScene !== null}
          onClose={() => setPickerScene(null)}
          onSelect={handleVariationSelected}
        />
      )}
    </div>
  );
};
