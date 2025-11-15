import React, { useState } from "react";
import { Edit2, Image as ImageIcon, RefreshCw, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useProject } from "../lib/project-context";
import { SceneData, SceneGroup, LyricLine } from "../types";
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

interface SceneGroupEditorProps {
  group: SceneGroup;
  lyricLines: LyricLine[];
  onUpdate: (updates: Partial<SceneGroup>) => void;
  sequence: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const SceneGroupEditor: React.FC<SceneGroupEditorProps> = ({
  group,
  lyricLines,
  onUpdate,
  sequence,
  isExpanded,
  onToggle,
}) => {
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customPromptText, setCustomPromptText] = useState(group.customPrompt || group.prompt);
  const [selectedType, setSelectedType] = useState<"basic" | "enhanced" | "custom">(
    group.selectedPromptType || "enhanced"
  );

  const handlePromptTypeChange = (type: "basic" | "enhanced" | "custom") => {
    setSelectedType(type);
    onUpdate({ selectedPromptType: type });
  };

  const handleSaveCustom = () => {
    onUpdate({
      customPrompt: customPromptText,
      selectedPromptType: "custom"
    });
    setSelectedType("custom");
    setIsEditingCustom(false);
  };

  const handleCancelCustom = () => {
    setCustomPromptText(group.customPrompt || group.prompt);
    setIsEditingCustom(false);
  };

  const groupLines = lyricLines.filter((line) =>
    group.lyricLineIds.includes(line.id)
  );

  return (
    <Card>
      <div
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold">
              {sequence}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium">{group.combinedLyrics}</p>
                {group.isReusedGroup && (
                  <div className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-700 px-2 py-1 rounded">
                    <Link2 className="w-3 h-3" />
                    Reused
                  </div>
                )}
                {group.isInstrumental && (
                  <div className="text-xs bg-purple-500/20 text-purple-700 px-2 py-1 rounded">
                    Instrumental
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {group.start.toFixed(1)}s - {group.end.toFixed(1)}s ({group.duration.toFixed(1)}s) • {groupLines.length} line(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {group.imagePath && (
              <div className="w-16 h-9 rounded overflow-hidden border">
                <img
                  src={group.imagePath}
                  alt={`Group ${sequence}`}
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
          {/* Constituent Lines */}
          <div>
            <Label className="text-xs text-muted-foreground">Lyric Lines in Group</Label>
            <ul className="mt-2 space-y-1 text-sm">
              {groupLines.map((line) => (
                <li key={line.id} className="text-muted-foreground">
                  • {line.lyric} <span className="text-xs">({line.start.toFixed(1)}s - {line.end.toFixed(1)}s)</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Prompt Editor - disabled for reused groups */}
          <div className="space-y-3">
            <Label>AI Image Prompt</Label>

            {group.isReusedGroup ? (
              <div className="p-3 bg-blue-500/10 text-blue-700 rounded text-sm">
                This group reuses the image from another group. Edit the original group's prompt instead.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Basic Prompt Option */}
                <div className="flex items-start gap-3 p-3 border rounded hover:bg-accent/30 transition-colors">
                  <input
                    type="radio"
                    id={`basic-${group.id}`}
                    name={`prompt-type-${group.id}`}
                    checked={selectedType === "basic"}
                    onChange={() => handlePromptTypeChange("basic")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor={`basic-${group.id}`} className="font-medium text-sm cursor-pointer">
                      Basic Prompt
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">{group.prompt}</p>
                  </div>
                </div>

                {/* AI Enhanced Prompt Option */}
                {group.enhancedPrompt && (
                  <div className="flex items-start gap-3 p-3 border rounded hover:bg-accent/30 transition-colors">
                    <input
                      type="radio"
                      id={`enhanced-${group.id}`}
                      name={`prompt-type-${group.id}`}
                      checked={selectedType === "enhanced"}
                      onChange={() => handlePromptTypeChange("enhanced")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor={`enhanced-${group.id}`} className="font-medium text-sm cursor-pointer flex items-center gap-2">
                        AI Enhanced
                        <span className="text-xs bg-green-500/20 text-green-700 px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">{group.enhancedPrompt}</p>
                    </div>
                  </div>
                )}

                {/* Custom Prompt Option */}
                <div className="flex items-start gap-3 p-3 border rounded hover:bg-accent/30 transition-colors">
                  <input
                    type="radio"
                    id={`custom-${group.id}`}
                    name={`prompt-type-${group.id}`}
                    checked={selectedType === "custom"}
                    onChange={() => handlePromptTypeChange("custom")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`custom-${group.id}`} className="font-medium text-sm cursor-pointer">
                        Custom Edit
                      </label>
                      {selectedType === "custom" && !isEditingCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingCustom(true)}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {isEditingCustom ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={customPromptText}
                          onChange={(e) => setCustomPromptText(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveCustom}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelCustom}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        {group.customPrompt || "Click 'Edit' to create a custom prompt"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export const PromptEditor: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { project, updateScene, setProject } = useProject();
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [pickerScene, setPickerScene] = useState<SceneData | null>(null);

  if (!project) return null;

  const usingGrouping = project.useGrouping && project.sceneGroups && project.lyricLines;

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

  const handleUpdateGroup = (groupId: string, updates: Partial<SceneGroup>) => {
    if (!project.sceneGroups) return;

    const updatedGroups = project.sceneGroups.map((group) =>
      group.id === groupId ? { ...group, ...updates } : group
    );

    setProject({
      ...project,
      sceneGroups: updatedGroups,
    });
  };

  const totalItems = usingGrouping ? (project.sceneGroups?.length || 0) : project.scenes.length;
  const uniqueImages = usingGrouping
    ? (project.sceneGroups?.filter(g => !g.isReusedGroup).length || 0)
    : project.scenes.length;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Edit Scene Prompts</h1>
        <p className="text-muted-foreground">
          Review and customize the AI image prompts for each {usingGrouping ? 'group' : 'scene'}
        </p>
      </div>

      {/* Project Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{usingGrouping ? 'Scene Groups' : 'Total Scenes'}</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </div>
          {usingGrouping && (
            <div>
              <p className="text-sm text-muted-foreground">Unique Images</p>
              <p className="text-2xl font-bold text-green-600">{uniqueImages}</p>
            </div>
          )}
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

      {/* Scene/Group List */}
      <div className="space-y-3 mb-6">
        {usingGrouping ? (
          // Render Scene Groups
          project.sceneGroups!.map((group, index) => (
            <SceneGroupEditor
              key={group.id}
              group={group}
              lyricLines={project.lyricLines!}
              onUpdate={(updates) => handleUpdateGroup(group.id, updates)}
              sequence={index + 1}
              isExpanded={expandedScenes.has(index + 1)}
              onToggle={() => toggleScene(index + 1)}
            />
          ))
        ) : (
          // Render Legacy Scenes
          project.scenes.map((scene) => (
            <SceneEditor
              key={scene.sequence}
              scene={scene}
              onUpdate={(updates) => updateScene(scene.sequence, updates)}
              onRegenerate={handleRegenerateScene}
              isExpanded={expandedScenes.has(scene.sequence)}
              onToggle={() => toggleScene(scene.sequence)}
            />
          ))
        )}
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
