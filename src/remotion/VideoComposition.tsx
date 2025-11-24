import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { VideoCompositionProps } from "../types";
import { Scene } from "./Scene";
import { SceneGroup } from "./SceneGroup";
import { Outro } from "./Outro";
import { SongInfoOverlay } from "./SongInfoOverlay";

export const VideoComposition = ({
  scenes,
  audioPath,
  sceneGroups,
  lyricLines,
  useGrouping,
  outroConfig,
  songInfoConfig,
  sunoStyleText,
}: VideoCompositionProps) => {
  const { fps } = useVideoConfig();

  // Sort scene groups by start time to ensure correct ordering
  // This is critical for determining the chronologically last group for outro timing
  const sortedSceneGroups = sceneGroups
    ? [...sceneGroups].sort((a, b) => a.start - b.start)
    : undefined;

  // Log when VideoComposition mounts/renders
  console.log('[VideoComposition] 🎥 Component rendering:', {
    useGrouping,
    sceneGroupsCount: sortedSceneGroups?.length,
    scenesCount: scenes?.length,
    hasAudio: !!audioPath,
    outroEnabled: outroConfig?.enabled,
  });

  // Convert seconds to frames
  const secondsToFrames = (seconds: number) => Math.floor(seconds * fps);

  // Transition duration for crossfades (0.5 seconds)
  const transitionDurationSeconds = 0.5;
  const transitionDurationFrames = secondsToFrames(transitionDurationSeconds);

  // Debug audio
  console.log("VideoComposition audioPath:", audioPath || "MISSING");

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Audio track - Audio component works in both Player preview and final render */}
      {audioPath && (
        <>
          <Audio src={audioPath} volume={1} />
          {console.log("✓ Audio component rendered with src:", audioPath)}
        </>
      )}
      {!audioPath && console.error("✗ No audioPath provided to VideoComposition")}

      {/* Render scenes or scene groups based on mode */}
      {useGrouping && sortedSceneGroups && lyricLines ? (
        // Render scene groups with time-synchronized lyrics
        sortedSceneGroups.map((group, index) => {
          const isFirstGroup = index === 0;
          const isLastGroup = index === sortedSceneGroups.length - 1;

          // Filter lyric lines that belong to this group
          const groupLines = lyricLines.filter((line) =>
            group.lyricLineIds.includes(line.id)
          );

          // Calculate start frame with overlap (start earlier except for first group)
          const startFrame = isFirstGroup
            ? secondsToFrames(group.start)
            : secondsToFrames(group.start - transitionDurationSeconds);

          // Calculate duration with extended transitions
          let durationInFrames = secondsToFrames(group.duration);

          // Extend duration at the start (overlap with previous group)
          if (!isFirstGroup) {
            durationInFrames += transitionDurationFrames;
          }

          // Extend duration at the end (overlap with next group, or fade-out time for last group)
          // Last group also needs this extension so it can properly fade out before outro
          durationInFrames += transitionDurationFrames;

          return (
            <Sequence
              key={group.id}
              from={startFrame}
              durationInFrames={durationInFrames}
            >
              <SceneGroup
                sceneGroup={group}
                lyricLines={groupLines}
                startFrame={startFrame}
                durationInFrames={durationInFrames}
              />
            </Sequence>
          );
        })
      ) : (
        // Legacy mode: Render individual scenes
        scenes.map((scene, index) => {
          const isFirstScene = index === 0;
          const isLastScene = index === scenes.length - 1;

          // Calculate start frame with overlap (start earlier except for first scene)
          const startFrame = isFirstScene
            ? secondsToFrames(scene.start)
            : secondsToFrames(scene.start - transitionDurationSeconds);

          // Calculate duration with extended transitions
          let durationInFrames = secondsToFrames(scene.duration);

          // Extend duration at the start (overlap with previous scene)
          if (!isFirstScene) {
            durationInFrames += transitionDurationFrames;
          }

          // Extend duration at the end (overlap with next scene, or fade-out time for last scene)
          // Last scene also needs this extension so it can properly fade out before outro
          durationInFrames += transitionDurationFrames;

          return (
            <Sequence
              key={scene.sequence}
              from={startFrame}
              durationInFrames={durationInFrames}
            >
              <Scene
                scene={scene}
                startFrame={startFrame}
                durationInFrames={durationInFrames}
              />
            </Sequence>
          );
        })
      )}

      {/* Outro/Credits Sequence */}
      {outroConfig?.enabled && (() => {
        // Calculate outro start time (after last scene/group ends + transition buffer)
        // Add transition buffer so the last group's video has time to complete/fade
        const lastEndTime = useGrouping && sortedSceneGroups && sortedSceneGroups.length > 0
          ? sortedSceneGroups[sortedSceneGroups.length - 1].end
          : scenes[scenes.length - 1]?.end || 0;

        // Start outro after transition buffer to allow last scene to complete
        const outroStartFrame = secondsToFrames(lastEndTime + transitionDurationSeconds);
        const outroDurationFrames = secondsToFrames(outroConfig.duration);

        // Collect unique VIDEO items from scene groups (excluding reused groups)
        // Only videos are shown in the outro grid
        const mediaItems: { path: string; type: 'image' | 'video' }[] = [];
        const seenPaths = new Set<string>();

        if (sortedSceneGroups) {
          for (const group of sortedSceneGroups) {
            if (group.imagePath && !group.isReusedGroup && !seenPaths.has(group.imagePath)) {
              // Determine media type from mediaVersions
              const activeVersion = group.mediaVersions?.find(v => v.id === group.activeMediaId);
              const mediaType = activeVersion?.type || 'image';

              // Only include videos in the outro
              if (mediaType === 'video') {
                seenPaths.add(group.imagePath);
                mediaItems.push({
                  path: group.imagePath,
                  type: mediaType,
                });
              }
            }
          }
        }

        console.log('[VideoComposition] 🎬 Outro enabled:', {
          outroStartFrame,
          outroDurationFrames,
          videoCount: mediaItems.length,
        });

        return (
          <Sequence
            key="outro"
            from={outroStartFrame}
            durationInFrames={outroDurationFrames}
          >
            <Outro
              mediaItems={mediaItems}
              duration={outroConfig.duration}
              appName={outroConfig.appName}
              githubUrl={outroConfig.githubUrl}
              aiCredits={outroConfig.aiCredits}
              githubQrImage={outroConfig.githubQrImage}
              bitcoinQrImage={outroConfig.bitcoinQrImage}
            />
          </Sequence>
        );
      })()}

      {/* Song Info Overlay - renders on top of everything at the start */}
      {songInfoConfig?.enabled && (songInfoConfig.songTitle || songInfoConfig.artistName) && (
        <Sequence
          key="song-info"
          from={0}
          durationInFrames={secondsToFrames(songInfoConfig.displayDuration)}
        >
          <SongInfoOverlay
            songTitle={songInfoConfig.songTitle}
            artistName={songInfoConfig.artistName}
            showStyle={songInfoConfig.showStyle}
            style={songInfoConfig.style || sunoStyleText || ''}
            displayDuration={songInfoConfig.displayDuration}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
