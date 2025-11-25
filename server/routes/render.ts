import { Router, Request, Response } from "express";
import multer from "multer";
import { renderQueue, RenderJobInput } from "../render-queue";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { z } from "zod";

// ============================================================================
// FILE TYPE VALIDATION - Strict whitelist for security
// ============================================================================
const ALLOWED_AUDIO_MIMES = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_MIMES = [...ALLOWED_AUDIO_MIMES, ...ALLOWED_VIDEO_MIMES, ...ALLOWED_IMAGE_MIMES];
const ALLOWED_EXTENSIONS = new Set(['.wav', '.mp3', '.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png', '.webp', '.gif']);

const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedMime = ALLOWED_MIMES.includes(file.mimetype);
  const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);

  if (isAllowedMime && isAllowedExt) {
    cb(null, true);
  } else {
    console.warn(`File rejected: ${file.originalname} (mime: ${file.mimetype}, ext: ${ext})`);
    cb(new Error(`Invalid file type. Allowed: audio (wav, mp3), video (mp4, mov, webm), images (jpg, png, webp, gif)`));
  }
};

// ============================================================================
// ZOD SCHEMAS - Input validation for request data
// ============================================================================
const MediaVersionSchema = z.object({
  id: z.string(),
  path: z.string(),
  type: z.enum(['image', 'video']),
  isActive: z.boolean(),
  duration: z.number().optional(),
});

const SceneGroupSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  start: z.number(),
  end: z.number(),
  duration: z.number(),
  imagePath: z.string().optional(),
  mediaVersions: z.array(MediaVersionSchema).optional(),
  mediaFileKey: z.string().optional(),
  activeMediaId: z.string().optional(),
  isReusedGroup: z.boolean().optional(),
  originalGroupId: z.string().optional(),
  displayMode: z.string().optional(),
  kenBurnsPreset: z.string().optional(),
  coverVerticalPosition: z.number().optional(),
}).passthrough(); // Allow additional fields

const LyricLineSchema = z.object({
  id: z.string(),
  text: z.string(),
  start: z.number(),
  end: z.number(),
  groupId: z.string().optional(),
}).passthrough();

const SceneSchema = z.object({
  lyric: z.string().optional(),
  start: z.number(),
  end: z.number(),
  imagePath: z.string().optional(),
}).passthrough();

const OutroConfigSchema = z.object({
  enabled: z.boolean(),
  duration: z.number(),
  appName: z.string(),
  githubUrl: z.string(),
  aiCredits: z.string().optional(),
  githubQrImage: z.string().optional(),
  bitcoinQrImage: z.string().optional(),
  githubQrFileKey: z.string().optional(),
  bitcoinQrFileKey: z.string().optional(),
}).passthrough();

const SongInfoConfigSchema = z.object({
  enabled: z.boolean(),
  songTitle: z.string(),
  artistName: z.string(),
  showStyle: z.boolean(),
  style: z.string(),
  displayDuration: z.number(),
}).passthrough();

// Helper function for safe JSON parsing with Zod validation
function safeParseJson<T>(json: string | undefined, schema: z.ZodType<T>, fieldName: string): T | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    return schema.parse(parsed);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const firstError = e.errors[0];
      throw new Error(`Invalid ${fieldName}: ${firstError?.path.join('.')} - ${firstError?.message}`);
    }
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid ${fieldName}: malformed JSON`);
    }
    throw e;
  }
}

// ============================================================================
// FILE CLEANUP HELPER - Clean up uploaded files on error
// ============================================================================
const cleanupUploadedFiles = (files: Express.Multer.File[] | undefined) => {
  if (!files) return;
  for (const file of files) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`Cleaned up uploaded file: ${file.path}`);
      }
    } catch (e) {
      console.error(`Failed to cleanup file ${file.path}:`, e);
    }
  }
};

// Output directory for path traversal protection
const OUTPUT_DIR = path.resolve(__dirname, '../output');

const router = Router();

// Configure multer for file uploads with extension preservation
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../uploads"),
  filename: (req, file, cb) => {
    // Extract and sanitize extension (force lowercase for consistency)
    const ext = path.extname(file.originalname).toLowerCase();
    // Generate random filename + preserve sanitized extension
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: fileFilter, // Strict file type validation
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * POST /api/render
 * Create a new render job
 */
router.post("/render", upload.any(), async (req: Request, res: Response) => {
  try {
    const { scenes, sceneGroups, lyricLines, metadata, useGrouping, outroConfig, songInfoConfig } = req.body;
    const files = req.files as Express.Multer.File[];

    // Find audio file
    const audioFile = files.find(f => f.fieldname === "audioFile");
    if (!audioFile) {
      cleanupUploadedFiles(files);
      return res.status(400).json({
        error: "Missing audio file",
      });
    }

    // Create file map: fieldname -> server HTTP URL
    const fileUrlMap = new Map<string, string>();
    files.forEach(file => {
      const filename = path.basename(file.path);
      const url = `http://localhost:3002/uploads/${filename}`;
      fileUrlMap.set(file.fieldname, url);
      console.log(`Uploaded file: ${file.fieldname} -> ${url}`);
    });

    let inputProps: any;

    if (useGrouping === "true" && sceneGroups) {
      // Grouping mode: process scene groups with Zod validation
      const parsedGroups = safeParseJson(sceneGroups, z.array(SceneGroupSchema), 'sceneGroups');
      const parsedLines = safeParseJson(lyricLines, z.array(LyricLineSchema), 'lyricLines');

      if (!parsedGroups || !parsedLines) {
        cleanupUploadedFiles(files);
        return res.status(400).json({ error: "Missing required fields: sceneGroups and lyricLines" });
      }

      console.log(`Processing ${parsedGroups.length} scene groups for render`);

      // Debug: Log display settings for first group
      if (parsedGroups.length > 0) {
        console.log('[Render] First group display settings:', {
          displayMode: parsedGroups[0].displayMode,
          kenBurnsPreset: parsedGroups[0].kenBurnsPreset,
          coverVerticalPosition: parsedGroups[0].coverVerticalPosition,
        });
      }

      // Replace media file keys with server HTTP URLs
      const groupsWithUrls = parsedGroups.map((group: any) => {
        if (group.mediaFileKey) {
          // Get server URL for this group's media
          const url = fileUrlMap.get(group.mediaFileKey);
          if (url) {
            console.log(`Group ${group.id}: ${group.mediaFileKey} -> ${url}`);

            // Update mediaVersions array to use server URL instead of blob URL
            const updatedMediaVersions = group.mediaVersions?.map((version: any) => {
              // If this version's path matches the active media, update it to server URL
              if (version.id === group.activeMediaId) {
                return { ...version, path: url };
              }
              return version;
            });

            return {
              ...group,
              imagePath: url,
              mediaFileKey: undefined,
              mediaVersions: updatedMediaVersions
            };
          } else {
            console.warn(`No uploaded file found for ${group.mediaFileKey}`);
            return group;
          }
        } else if (group.isReusedGroup && group.originalGroupId) {
          // Reused group: copy imagePath from original group
          const originalGroup = parsedGroups.find((g: any) => g.id === group.originalGroupId);
          if (originalGroup) {
            const originalUrl = fileUrlMap.get(`media_${originalGroup.id}`);
            console.log(`Reused group ${group.id}: copying from ${group.originalGroupId} -> ${originalUrl}`);

            // Update mediaVersions for reused group
            const updatedMediaVersions = group.mediaVersions?.map((version: any) => {
              if (version.id === group.activeMediaId) {
                return { ...version, path: originalUrl };
              }
              return version;
            });

            return {
              ...group,
              imagePath: originalUrl,
              mediaVersions: updatedMediaVersions
            };
          }
        }
        return group;
      });

      // Debug: Verify display settings are preserved after URL mapping
      if (groupsWithUrls.length > 0) {
        console.log('[Render] After URL mapping, first group display settings:', {
          displayMode: groupsWithUrls[0].displayMode,
          kenBurnsPreset: groupsWithUrls[0].kenBurnsPreset,
          coverVerticalPosition: groupsWithUrls[0].coverVerticalPosition,
        });
      }

      // Parse outro config if provided and map QR image file keys to URLs
      let parsedOutroConfig = safeParseJson(outroConfig, OutroConfigSchema, 'outroConfig');
      if (parsedOutroConfig) {
        console.log('[Render] Received outroConfig:', JSON.stringify(parsedOutroConfig));
        console.log('[Render] Available file keys:', Array.from(fileUrlMap.keys()));

        // Map QR image file keys to server HTTP URLs
        if (parsedOutroConfig.githubQrFileKey) {
          const url = fileUrlMap.get(parsedOutroConfig.githubQrFileKey);
          if (url) {
            parsedOutroConfig.githubQrImage = url;
            console.log(`[Render] GitHub QR image mapped: ${parsedOutroConfig.githubQrFileKey} -> ${url}`);
          } else {
            console.warn(`[Render] GitHub QR file key not found in uploads: ${parsedOutroConfig.githubQrFileKey}`);
          }
          delete parsedOutroConfig.githubQrFileKey;
        }
        if (parsedOutroConfig.bitcoinQrFileKey) {
          const url = fileUrlMap.get(parsedOutroConfig.bitcoinQrFileKey);
          if (url) {
            parsedOutroConfig.bitcoinQrImage = url;
            console.log(`[Render] Bitcoin QR image mapped: ${parsedOutroConfig.bitcoinQrFileKey} -> ${url}`);
          } else {
            console.warn(`[Render] Bitcoin QR file key not found in uploads: ${parsedOutroConfig.bitcoinQrFileKey}`);
          }
          delete parsedOutroConfig.bitcoinQrFileKey;
        }
        console.log('[Render] Final outro config:', {
          enabled: parsedOutroConfig.enabled,
          duration: parsedOutroConfig.duration,
          appName: parsedOutroConfig.appName,
          githubUrl: parsedOutroConfig.githubUrl,
          aiCredits: parsedOutroConfig.aiCredits,
          githubQrImage: parsedOutroConfig.githubQrImage || 'NOT SET',
          bitcoinQrImage: parsedOutroConfig.bitcoinQrImage || 'NOT SET',
        });
      }

      // Parse song info config with Zod validation
      const parsedSongInfoConfig = safeParseJson(songInfoConfig, SongInfoConfigSchema, 'songInfoConfig');
      if (parsedSongInfoConfig) {
        console.log('[Render] Received songInfoConfig:', JSON.stringify(parsedSongInfoConfig));
      }

      inputProps = {
        scenes: [], // Empty for backward compatibility
        sceneGroups: groupsWithUrls,
        lyricLines: parsedLines,
        useGrouping: true,
        audioPath: `http://localhost:3002/uploads/${path.basename(audioFile.path)}`,
        outroConfig: parsedOutroConfig,
        songInfoConfig: parsedSongInfoConfig,
      };
    } else {
      // Legacy mode: process scenes with Zod validation
      const parsedScenes = safeParseJson(scenes, z.array(SceneSchema), 'scenes') || [];
      let parsedOutroConfig = safeParseJson(outroConfig, OutroConfigSchema, 'outroConfig');

      // Map QR image file keys to URLs (same as grouping mode)
      if (parsedOutroConfig) {
        if (parsedOutroConfig.githubQrFileKey) {
          const url = fileUrlMap.get(parsedOutroConfig.githubQrFileKey);
          if (url) parsedOutroConfig.githubQrImage = url;
          delete parsedOutroConfig.githubQrFileKey;
        }
        if (parsedOutroConfig.bitcoinQrFileKey) {
          const url = fileUrlMap.get(parsedOutroConfig.bitcoinQrFileKey);
          if (url) parsedOutroConfig.bitcoinQrImage = url;
          delete parsedOutroConfig.bitcoinQrFileKey;
        }
      }

      // Parse song info config for legacy mode with Zod validation
      const parsedSongInfoConfig = safeParseJson(songInfoConfig, SongInfoConfigSchema, 'songInfoConfig');

      inputProps = {
        scenes: parsedScenes,
        audioPath: `http://localhost:3002/uploads/${path.basename(audioFile.path)}`,
        outroConfig: parsedOutroConfig,
        songInfoConfig: parsedSongInfoConfig,
      };
    }

    const parsedMetadata = safeParseJson(metadata, z.record(z.unknown()), 'metadata') || {};

    const input: RenderJobInput = {
      audioPath: inputProps.audioPath,
      scenes: inputProps.scenes || [],
      sceneGroups: inputProps.sceneGroups,
      lyricLines: inputProps.lyricLines,
      useGrouping: inputProps.useGrouping,
      outroConfig: inputProps.outroConfig,
      songInfoConfig: inputProps.songInfoConfig,
      metadata: {
        ...parsedMetadata,
        _tempAudioFilePath: audioFile.path, // Store original path for cleanup
      },
    };

    const jobId = renderQueue.createJob(input);

    res.json({
      jobId,
      status: "pending",
      message: "Render job created successfully",
    });
  } catch (error) {
    // Log full error server-side for debugging
    console.error("Error creating render job:", error);

    // Clean up uploaded files on error
    const files = req.files as Express.Multer.File[] | undefined;
    cleanupUploadedFiles(files);

    // Return sanitized error message to client (don't leak internal details)
    // Only expose validation errors, not stack traces or system info
    const isValidationError = error instanceof Error &&
      (error.message.startsWith('Invalid ') || error.message.includes('file type'));

    res.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : "Failed to create render job",
    });
  }
});

/**
 * GET /api/render/:id/status
 * Get the status of a render job
 */
router.get("/render/:id/status", (req: Request, res: Response) => {
  const { id } = req.params;

  const job = renderQueue.getJob(id);
  if (!job) {
    return res.status(404).json({
      error: "Job not found",
    });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
});

/**
 * GET /api/render/:id/download
 * Download the rendered video
 */
router.get("/render/:id/download", (req: Request, res: Response) => {
  const { id } = req.params;

  const job = renderQueue.getJob(id);
  if (!job) {
    return res.status(404).json({
      error: "Job not found",
    });
  }

  if (job.status !== "completed" || !job.outputPath) {
    return res.status(400).json({
      error: "Video not ready for download",
      status: job.status,
    });
  }

  // Path traversal protection: ensure outputPath is within allowed directory
  const resolvedPath = path.resolve(job.outputPath);
  if (!resolvedPath.startsWith(OUTPUT_DIR + path.sep) && resolvedPath !== OUTPUT_DIR) {
    console.error(`Path traversal attempt blocked: ${job.outputPath} -> ${resolvedPath}`);
    return res.status(403).json({
      error: "Access denied",
    });
  }

  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({
      error: "Video file not found",
    });
  }

  const filename = path.basename(job.outputPath);
  res.download(job.outputPath, `music-video-${id}.mov`, (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to download video",
        });
      }
    }
  });
});

export default router;
