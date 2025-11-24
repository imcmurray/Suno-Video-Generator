import React from "react";
import { Music, Film, Upload, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { useProject, DEFAULT_OUTRO_CONFIG, DEFAULT_SONG_INFO_CONFIG } from "../lib/project-context";
import { createBlobURL, revokeBlobURL } from "../lib/blob-manager";

export const IntroOutroEditor: React.FC = () => {
  const { project, updateOutroConfig, updateSongInfoConfig } = useProject();

  if (!project) {
    return null;
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Intro & Outro</h1>
        <p className="text-muted-foreground">
          Configure the song info overlay at the start and credits sequence at the end of your video
        </p>
      </div>

      {/* Song Info Overlay Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Song Info Overlay (Intro)
          </CardTitle>
          <CardDescription>
            Display song title, artist name, and style/description at the start of the video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Song Info</p>
              <p className="text-sm text-muted-foreground">
                Shows in top-left corner with staggered animation
              </p>
            </div>
            <Button
              variant={project.songInfoConfig?.enabled ? "default" : "outline"}
              onClick={() => {
                const currentConfig = project.songInfoConfig || DEFAULT_SONG_INFO_CONFIG;
                updateSongInfoConfig({ enabled: !currentConfig.enabled });
              }}
            >
              {project.songInfoConfig?.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {project.songInfoConfig?.enabled && (
            <div className="pt-4 border-t space-y-4">
              {/* Song Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Song Title</label>
                <Input
                  value={project.songInfoConfig?.songTitle || ""}
                  onChange={(e) => updateSongInfoConfig({ songTitle: e.target.value })}
                  placeholder="My Amazing Song"
                />
                <p className="text-xs text-muted-foreground">Appears first with slide-in animation</p>
              </div>

              {/* Artist Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Artist Name</label>
                <Input
                  value={project.songInfoConfig?.artistName || ""}
                  onChange={(e) => updateSongInfoConfig({ artistName: e.target.value })}
                  placeholder="Your Artist Name"
                />
                <p className="text-xs text-muted-foreground">Appears second, 0.3s after title</p>
              </div>

              {/* Show Style Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Style/Description</p>
                  <p className="text-xs text-muted-foreground">
                    Optional text below artist name (style, call-to-action, etc.)
                  </p>
                </div>
                <Button
                  variant={project.songInfoConfig?.showStyle ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const currentConfig = project.songInfoConfig || DEFAULT_SONG_INFO_CONFIG;
                    updateSongInfoConfig({ showStyle: !currentConfig.showStyle });
                  }}
                >
                  {project.songInfoConfig?.showStyle ? "Shown" : "Hidden"}
                </Button>
              </div>

              {/* Style Text (only if showStyle is enabled) */}
              {project.songInfoConfig?.showStyle && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Style / Description</label>
                  <Input
                    value={project.songInfoConfig?.style || project.metadata?.sunoStyleText || ""}
                    onChange={(e) => updateSongInfoConfig({ style: e.target.value })}
                    placeholder="Melodic Pop, Upbeat • Subscribe for more!"
                  />
                  <p className="text-xs text-muted-foreground">
                    Appears third, 0.6s after title. Use for style info, hashtags, or call-to-action.
                  </p>
                </div>
              )}

              {/* Display Duration */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Duration</label>
                <Select
                  value={String(project.songInfoConfig?.displayDuration || DEFAULT_SONG_INFO_CONFIG.displayDuration)}
                  onValueChange={(value) => updateSongInfoConfig({ displayDuration: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 seconds</SelectItem>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="7">7 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  All elements fade out together at the end
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outro/Credits Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Outro Credits Sequence
          </CardTitle>
          <CardDescription>
            Add a credits sequence at the end showing all videos used, AI credits, and branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Outro</p>
              <p className="text-sm text-muted-foreground">
                20-second credits sequence with ripple animation
              </p>
            </div>
            <Button
              variant={project.outroConfig?.enabled ? "default" : "outline"}
              onClick={() => {
                const currentConfig = project.outroConfig || DEFAULT_OUTRO_CONFIG;
                updateOutroConfig({ enabled: !currentConfig.enabled });
              }}
            >
              {project.outroConfig?.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {project.outroConfig?.enabled && (
            <div className="pt-4 border-t space-y-4">
              {/* App Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">App Name</label>
                <Input
                  value={project.outroConfig?.appName || DEFAULT_OUTRO_CONFIG.appName}
                  onChange={(e) => updateOutroConfig({ appName: e.target.value })}
                  placeholder="Suno Video Generator"
                />
              </div>

              {/* GitHub URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub URL</label>
                <Input
                  value={project.outroConfig?.githubUrl || DEFAULT_OUTRO_CONFIG.githubUrl}
                  onChange={(e) => updateOutroConfig({ githubUrl: e.target.value })}
                  placeholder="github.com/username/repo"
                />
              </div>

              {/* AI Credits */}
              <div className="space-y-2">
                <label className="text-sm font-medium">AI Credits Text</label>
                <Input
                  value={project.outroConfig?.aiCredits || DEFAULT_OUTRO_CONFIG.aiCredits}
                  onChange={(e) => updateOutroConfig({ aiCredits: e.target.value })}
                  placeholder="Videos by Grok • Music by Suno AI • Lyrics by Claude"
                />
                <p className="text-xs text-muted-foreground">Use • to separate credits</p>
              </div>

              {/* QR Codes Section */}
              <div className="pt-4 border-t">
                <p className="font-medium mb-3">QR Codes (appear in last 5 seconds)</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* GitHub QR Code */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">GitHub QR Code</label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {project.outroConfig?.githubQrImage ? (
                        <div className="relative">
                          <img
                            src={project.outroConfig.githubQrImage}
                            alt="GitHub QR"
                            className="w-24 h-24 mx-auto object-contain"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-0 right-0 w-6 h-6"
                            onClick={() => {
                              if (project.outroConfig?.githubQrImage) {
                                revokeBlobURL(project.outroConfig.githubQrImage);
                              }
                              updateOutroConfig({ githubQrImage: undefined });
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = createBlobURL(file, { versionLabel: 'qr-github' });
                                updateOutroConfig({ githubQrImage: url });
                              }
                            }}
                          />
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Upload QR</p>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Bitcoin QR Code */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bitcoin QR Code</label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {project.outroConfig?.bitcoinQrImage ? (
                        <div className="relative">
                          <img
                            src={project.outroConfig.bitcoinQrImage}
                            alt="Bitcoin QR"
                            className="w-24 h-24 mx-auto object-contain"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-0 right-0 w-6 h-6"
                            onClick={() => {
                              if (project.outroConfig?.bitcoinQrImage) {
                                revokeBlobURL(project.outroConfig.bitcoinQrImage);
                              }
                              updateOutroConfig({ bitcoinQrImage: undefined });
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = createBlobURL(file, { versionLabel: 'qr-bitcoin' });
                                updateOutroConfig({ bitcoinQrImage: url });
                              }
                            }}
                          />
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Upload QR</p>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Summary */}
              <div className="pt-4 border-t text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Outro Preview:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Ripple animation of all video thumbnails</li>
                  <li>AI credits: {project.outroConfig?.aiCredits || DEFAULT_OUTRO_CONFIG.aiCredits}</li>
                  <li>App name: {project.outroConfig?.appName || DEFAULT_OUTRO_CONFIG.appName}</li>
                  <li>GitHub: {project.outroConfig?.githubUrl || DEFAULT_OUTRO_CONFIG.githubUrl}</li>
                  {(project.outroConfig?.githubQrImage || project.outroConfig?.bitcoinQrImage) && (
                    <li>QR codes appear in last 5 seconds</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
