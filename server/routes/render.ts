import { Router, Request, Response } from "express";
import multer from "multer";
import { renderQueue, RenderJobInput } from "../render-queue";
import path from "path";
import fs from "fs";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, "../uploads"),
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
router.post("/render", upload.single("audioFile"), async (req: Request, res: Response) => {
  try {
    const { scenes, metadata } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({
        error: "Missing audio file",
      });
    }

    if (!scenes) {
      return res.status(400).json({
        error: "Missing scenes data",
      });
    }

    // Parse JSON fields
    const parsedScenes = JSON.parse(scenes);
    const parsedMetadata = metadata ? JSON.parse(metadata) : {};

    // Convert file path to URL for Remotion
    const filename = path.basename(audioFile.path);
    const audioUrl = `http://localhost:3002/uploads/${filename}`;

    const input: RenderJobInput = {
      audioPath: audioUrl, // Use HTTP URL for Remotion
      scenes: parsedScenes,
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
    console.error("Error creating render job:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create render job",
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
