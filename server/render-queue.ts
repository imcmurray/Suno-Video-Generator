import { v4 as uuidv4 } from "uuid";

export interface RenderJob {
  id: string;
  status: "pending" | "rendering" | "completed" | "failed";
  progress: number; // 0-100
  outputPath?: string;
  error?: string;
  input?: RenderJobInput;
  createdAt: Date;
  completedAt?: Date;
}

export interface RenderJobInput {
  audioPath: string;
  scenes: any[];
  sceneGroups?: any[];
  lyricLines?: any[];
  useGrouping?: boolean;
  metadata: any;
  outroConfig?: {
    enabled: boolean;
    duration: number;
    appName: string;
    githubUrl: string;
    aiCredits?: string;
    githubQrImage?: string;
    bitcoinQrImage?: string;
  };
  songInfoConfig?: {
    enabled: boolean;
    songTitle: string;
    artistName: string;
    showStyle: boolean;
    style: string;
    displayDuration: number;
  };
}

class RenderQueue {
  private jobs: Map<string, RenderJob> = new Map();
  private queue: string[] = [];
  private currentJobId: string | null = null;

  createJob(input: RenderJobInput): string {
    const id = uuidv4();
    const job: RenderJob = {
      id,
      status: "pending",
      progress: 0,
      input,
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    this.queue.push(id);

    console.log(`Job ${id} created and added to queue`);
    return id;
  }

  getJob(id: string): RenderJob | undefined {
    return this.jobs.get(id);
  }

  updateJobProgress(id: string, progress: number): void {
    const job = this.jobs.get(id);
    if (job) {
      job.progress = Math.round(progress * 100) / 100; // Round to 2 decimals
      this.jobs.set(id, job);
    }
  }

  markJobAsRendering(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = "rendering";
      this.currentJobId = id;
      this.jobs.set(id, job);
      console.log(`Job ${id} started rendering`);
    }
  }

  markJobAsCompleted(id: string, outputPath: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = "completed";
      job.progress = 100;
      job.outputPath = outputPath;
      job.completedAt = new Date();
      this.jobs.set(id, job);
      this.currentJobId = null;
      console.log(`Job ${id} completed: ${outputPath}`);
    }
  }

  markJobAsFailed(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = "failed";
      job.error = error;
      job.completedAt = new Date();
      this.jobs.set(id, job);
      this.currentJobId = null;
      console.error(`Job ${id} failed:`, error);
    }
  }

  getNextPendingJob(): string | null {
    // If already rendering a job, don't start another
    if (this.currentJobId) {
      return null;
    }

    const pendingJobId = this.queue.find((id) => {
      const job = this.jobs.get(id);
      return job?.status === "pending";
    });

    return pendingJobId || null;
  }

  isRendering(): boolean {
    return this.currentJobId !== null;
  }

  getAllJobs(): RenderJob[] {
    return Array.from(this.jobs.values());
  }

  cleanupOldJobs(olderThanHours: number = 24): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

    for (const [id, job] of this.jobs) {
      if (job.completedAt && job.completedAt < cutoffTime) {
        this.jobs.delete(id);
        const index = this.queue.indexOf(id);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
        console.log(`Cleaned up old job ${id}`);
      }
    }
  }
}

export const renderQueue = new RenderQueue();
