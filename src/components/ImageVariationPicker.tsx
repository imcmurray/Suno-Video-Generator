import React, { useState } from "react";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { SceneData } from "../types";
import { generateVariations, estimateCost } from "../lib/image-api";
import { useProject } from "../lib/project-context";

interface ImageVariationPickerProps {
  scene: SceneData;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
}

export const ImageVariationPicker: React.FC<ImageVariationPickerProps> = ({
  scene,
  isOpen,
  onClose,
  onSelect,
}) => {
  const { project } = useProject();
  const [prompt, setPrompt] = useState(scene.prompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const variationCount = 3;
  const cost = estimateCost(variationCount, project?.apiProvider || "openai", "standard");

  const handleGenerate = async () => {
    if (!project || !project.apiProvider || !project.apiKey) {
      setError("API configuration missing");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setVariations([]);
    setSelectedIndex(null);

    try {
      const results = await generateVariations(
        {
          prompt,
          provider: project.apiProvider,
          apiKey: project.apiKey,
          // size and quality removed - Grok doesn't support these parameters
          // Images are automatically resized to 1792x1024 in post-processing
        },
        variationCount
      );

      const imageUrls: string[] = [];
      const failedVariations: { index: number; error: string }[] = [];

      results.forEach((result, index) => {
        if (result.success && result.imageData) {
          const url = URL.createObjectURL(result.imageData);
          imageUrls.push(url);
        } else {
          failedVariations.push({
            index: index + 1,
            error: result.error || "Unknown error",
          });
          console.error(`Variation ${index + 1} failed:`, result.error);
        }
      });

      if (imageUrls.length === 0) {
        // All variations failed - show detailed error
        const errorDetails = failedVariations
          .map((v) => `Variation ${v.index}: ${v.error}`)
          .join("\n");
        throw new Error(`All ${variationCount} variations failed to generate:\n\n${errorDetails}`);
      }

      // Some succeeded - show them and optionally warn about failures
      setVariations(imageUrls);

      if (failedVariations.length > 0) {
        const warningMessage = `⚠️ ${imageUrls.length} of ${variationCount} variations generated successfully.\n\nFailed variations:\n${failedVariations
          .map((v) => `Variation ${v.index}: ${v.error}`)
          .join("\n")}`;
        console.warn(warningMessage);
        // Optionally set a warning state here if you want to display it
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate variations");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelect = () => {
    if (selectedIndex !== null && variations[selectedIndex]) {
      onSelect(variations[selectedIndex]);
      onClose();
    }
  };

  const handleClose = () => {
    // Clean up blob URLs
    variations.forEach((url) => URL.revokeObjectURL(url));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Image Variations</DialogTitle>
          <DialogDescription>
            Scene {scene.sequence}: {scene.lyricCleaned}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt Editor */}
          <div className="space-y-2">
            <Label htmlFor="variation-prompt">Edit Prompt (Optional)</Label>
            <textarea
              id="variation-prompt"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          {/* Generate Button */}
          {variations.length === 0 && (
            <div className="flex items-center gap-4">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating {variationCount} Variations...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate {variationCount} Variations
                  </>
                )}
              </Button>
              <div className="text-sm text-muted-foreground">
                Cost: ${cost.toFixed(2)}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* Variations Grid */}
          {variations.length > 0 && (
            <div>
              <Label className="mb-2 block">Select Your Preferred Variation</Label>
              <div className="grid grid-cols-3 gap-4">
                {variations.map((url, index) => (
                  <div
                    key={index}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedIndex === index
                        ? "border-primary ring-2 ring-primary"
                        : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <img
                      src={url}
                      alt={`Variation ${index + 1}`}
                      className="w-full aspect-video object-cover"
                    />
                    {selectedIndex === index && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                      Variation {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {variations.length > 0 && (
            <>
              <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
                Generate More
              </Button>
              <Button
                onClick={handleSelect}
                disabled={selectedIndex === null}
              >
                Use Selected Variation
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
