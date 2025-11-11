import React, { useState } from "react";
import { ProjectProvider } from "./lib/project-context";
import { ThemeProvider } from "./lib/theme-context";
import { ProjectSetup } from "./components/ProjectSetup";
import { PromptEditor } from "./components/PromptEditor";
import { ImageGeneration } from "./components/ImageGeneration";
import { VideoPreview } from "./components/VideoPreview";
import { ThemeToggle } from "./components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import "./styles/globals.css";

type AppStep = "setup" | "edit" | "generate" | "preview";

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>("setup");

  const renderStep = () => {
    switch (currentStep) {
      case "setup":
        return <ProjectSetup onComplete={() => setCurrentStep("edit")} />;
      case "edit":
        return <PromptEditor onNext={() => setCurrentStep("generate")} />;
      case "generate":
        return <ImageGeneration onNext={() => setCurrentStep("preview")} />;
      case "preview":
        return <VideoPreview />;
      default:
        return <ProjectSetup onComplete={() => setCurrentStep("edit")} />;
    }
  };

  const getStepNumber = (step: AppStep): number => {
    const steps: AppStep[] = ["setup", "edit", "generate", "preview"];
    return steps.indexOf(step) + 1;
  };

  return (
    <ThemeProvider>
      <ProjectProvider>
        <div className="min-h-screen bg-background">
          {/* Header with Theme Toggle - Always visible */}
          <header className="border-b bg-card">
            <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Suno Video Generator</span>
              </div>
              <ThemeToggle />
            </div>
          </header>

          {/* Navigation Tabs - Only show after setup */}
          {currentStep !== "setup" && (
            <div className="border-b bg-card">
              <div className="container max-w-7xl mx-auto px-4">
                <Tabs value={currentStep} onValueChange={(v) => setCurrentStep(v as AppStep)}>
                  <TabsList className="h-14">
                    <TabsTrigger value="setup">
                      <span className="hidden sm:inline">1. Setup</span>
                      <span className="sm:hidden">1</span>
                    </TabsTrigger>
                    <TabsTrigger value="edit">
                      <span className="hidden sm:inline">2. Edit Prompts</span>
                      <span className="sm:hidden">2</span>
                    </TabsTrigger>
                    <TabsTrigger value="generate">
                      <span className="hidden sm:inline">3. Generate Images</span>
                      <span className="sm:hidden">3</span>
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <span className="hidden sm:inline">4. Preview & Render</span>
                      <span className="sm:hidden">4</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          )}

        {/* Main Content */}
        <main>{renderStep()}</main>

          {/* Footer */}
          <footer className="border-t mt-16 py-8 bg-card">
            <div className="container max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
              <p>Suno Video Generator - Create professional music videos with AI</p>
              <p className="mt-2">
                Powered by Remotion • OpenAI DALL-E 3 • TypeScript
              </p>
            </div>
          </footer>
        </div>
      </ProjectProvider>
    </ThemeProvider>
  );
};

export default App;
