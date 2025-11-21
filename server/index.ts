import express from "express";
import cors from "cors";
import path from "path";
import { initializeBundle, processRenderQueue } from "./renderer";
import renderRoutes from "./routes/render";

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: "http://localhost:3001", // Vite dev server
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'], // Explicitly allow these methods
  allowedHeaders: ['Content-Type'], // Allow Content-Type header
  optionsSuccessStatus: 200 // For legacy browsers and Express 5 compatibility
}));
app.use(express.json({ limit: "100mb" })); // Support large audio files as data URIs
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Serve uploaded files with optimized settings for video streaming
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: 0, // Disable caching to prevent stale files during render
  etag: false, // Disable etag for better streaming performance
  lastModified: true, // Keep last modified headers
  acceptRanges: true, // Enable HTTP range requests for video seeking
  cacheControl: false, // Disable cache-control headers
}));

// API Routes
app.use("/api", renderRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Render server is running" });
});

// Start server
async function startServer() {
  try {
    console.log("Starting render server...");

    // Initialize Remotion bundle
    console.log("Initializing Remotion bundle...");
    await initializeBundle();

    // Start render queue processor
    console.log("Starting render queue processor...");
    processRenderQueue();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n✓ Render server running on http://localhost:${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      console.log(`✓ API endpoint: http://localhost:${PORT}/api/render\n`);
    });
  } catch (error) {
    console.error("Failed to start render server:", error);
    process.exit(1);
  }
}

startServer();
