# Security Review Report

**File(s) Reviewed**:
- /home/ianm/Development/suno-video-generator/server/index.ts
- /home/ianm/Development/suno-video-generator/server/routes/render.ts
- /home/ianm/Development/suno-video-generator/server/renderer.ts
- /home/ianm/Development/suno-video-generator/server/render-queue.ts

**Review Date**: 2025-11-24
**Remediation Date**: 2025-11-24
**Overall Risk Level**: ~~HIGH~~ → **MEDIUM** (after fixes)

---

## Remediation Summary

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| #1 Missing File Type Validation | Critical | ✅ **FIXED** | Added strict MIME type + extension whitelist |
| #2 Unsafe File Extension Handling | Critical | ✅ **FIXED** | Extensions sanitized (lowercase) and validated |
| #3 No Input Validation (Zod) | Critical | ✅ **FIXED** | Zod schemas for all JSON.parse calls |
| #4 No Authentication | High | ⏸️ Deferred | Acceptable for localhost-only usage |
| #5 Path Traversal Risk | High | ✅ **FIXED** | Output directory validation added |
| #6 Overly Permissive CORS | High | ⏸️ Deferred | Acceptable for localhost-only usage |
| #7 Missing Security Headers | High | ⏸️ Deferred | Acceptable for localhost-only usage |
| #8 No Rate Limiting | Medium | ⏸️ Deferred | Acceptable for localhost-only usage |
| #9 Verbose Error Messages | Medium | ✅ **FIXED** | Generic errors to client, full logs server-side |
| #10 Orphaned File Cleanup | Medium | ✅ **FIXED** | cleanupUploadedFiles() on all error paths |
| #11 Dependency Vulnerability | Low | ✅ **FIXED** | npm audit fix applied |

**Fixed**: 7 of 11 findings
**Deferred**: 4 findings (acceptable for local development)

---

## Executive Summary

This security review identified **11 security vulnerabilities** across the Express backend server, ranging from Critical to Low severity. **7 issues have been remediated** including all Critical severity findings. The remaining 4 High/Medium issues (authentication, CORS, Helmet, rate limiting) are deferred as acceptable for localhost-only usage but should be addressed before production deployment.

## Findings

### [CRITICAL] [FIXED] Finding #1: Missing File Type Validation on Multer Uploads
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:22-27`
- **Category**: Security
- **CWE/OWASP**: CWE-434 (Unrestricted Upload of File with Dangerous Type) / OWASP A03:2021 Injection
- **Description**: Multer configuration accepts ANY file type without validation. No `fileFilter` function is implemented to restrict uploads to expected MIME types (audio/video/image files).
- **Impact**: Attackers can upload executable files (.exe, .sh, .js), PHP shells, or malicious payloads disguised with allowed extensions. These files are stored in `/server/uploads/` and served via static middleware at `/uploads/*`, creating potential for:
  - Remote code execution if combined with other vulnerabilities
  - Serving malware to other users
  - Storage exhaustion attacks
  - Bypassing file extension checks by manipulating `file.originalname`
- **Evidence**:
```typescript
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  // MISSING: fileFilter validation
});
```
- **Remediation**: Add a strict `fileFilter` to validate MIME types and magic bytes:
```typescript
const ALLOWED_MIME_TYPES = [
  'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav',
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'image/jpeg', 'image/png', 'image/jpg'
];

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type: ${file.mimetype}. Only audio/video/image files allowed.`));
    }

    // Additional: validate file extension matches mimetype
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.wav', '.mp3', '.mp4', '.mov', '.avi', '.jpg', '.jpeg', '.png'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error(`Invalid file extension: ${ext}`));
    }

    cb(null, true);
  }
});
```
- **Priority**: Fix immediately

### [CRITICAL] [FIXED] Finding #2: File Extension Trusted from User Input
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:14-18`
- **Category**: Security
- **CWE/OWASP**: CWE-22 (Path Traversal) / CWE-434
- **Description**: File extension is extracted directly from `file.originalname` (user-controlled input) without sanitization. An attacker can manipulate the extension by sending crafted filenames.
- **Impact**:
  - Upload files with dangerous extensions (.exe, .php, .sh, .js) that bypass client-side checks
  - Double extension attacks: `malicious.php.jpg` → saved as `.php.jpg` but might execute as PHP
  - Path traversal attempts: `../../../etc/passwd` as extension
- **Evidence**:
```typescript
filename: (req, file, cb) => {
  // Extract extension from original filename
  const ext = path.extname(file.originalname); // VULNERABLE - trusts user input
  const randomName = crypto.randomBytes(16).toString('hex');
  cb(null, `${randomName}${ext}`);
}
```
- **Remediation**: Whitelist allowed extensions and sanitize:
```typescript
filename: (req, file, cb) => {
  const ALLOWED_EXTENSIONS: { [key: string]: string } = {
    'audio/wav': '.wav',
    'audio/mpeg': '.mp3',
    'audio/x-wav': '.wav',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'image/jpeg': '.jpg',
    'image/png': '.png'
  };

  const ext = ALLOWED_EXTENSIONS[file.mimetype] || '.bin';
  const randomName = crypto.randomBytes(16).toString('hex');
  cb(null, `${randomName}${ext}`);
}
```
- **Priority**: Fix immediately

### [CRITICAL] [FIXED] Finding #3: No Input Validation/Sanitization on JSON.parse
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:65-66, 141, 179, 195, 223`
- **Category**: Security
- **CWE/OWASP**: CWE-502 (Deserialization of Untrusted Data)
- **Description**: Multiple `JSON.parse()` calls on user-supplied data (`req.body`) without validation. No Zod schemas are used despite the library being available as a dependency.
- **Impact**:
  - Prototype pollution attacks via crafted JSON with `__proto__` keys
  - Type confusion leading to unexpected behavior
  - DoS via deeply nested objects causing stack overflow
  - Injection of malicious properties that break rendering logic
- **Evidence**:
```typescript
// Line 65-66
const parsedGroups = JSON.parse(sceneGroups);
const parsedLines = JSON.parse(lyricLines);

// Line 141
let parsedOutroConfig = outroConfig ? JSON.parse(outroConfig) : undefined;

// Line 179
const parsedSongInfoConfig = songInfoConfig ? JSON.parse(songInfoConfig) : undefined;

// Line 223
const parsedMetadata = metadata ? JSON.parse(metadata) : {};
```
- **Remediation**: Implement Zod validation schemas for all inputs:
```typescript
import { z } from 'zod';

const SceneGroupSchema = z.object({
  id: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  displayMode: z.enum(['contain', 'cover', 'ken-burns']).optional(),
  imagePath: z.string().optional(),
  mediaFileKey: z.string().optional(),
  // ... other fields
});

const RenderInputSchema = z.object({
  sceneGroups: z.array(SceneGroupSchema).optional(),
  lyricLines: z.array(z.any()).optional(),
  metadata: z.object({}).passthrough(),
  useGrouping: z.enum(['true', 'false']).optional(),
  outroConfig: z.object({
    enabled: z.boolean(),
    duration: z.number(),
    // ... other fields
  }).optional(),
});

// In route handler:
try {
  const validated = RenderInputSchema.parse({
    sceneGroups: sceneGroups ? JSON.parse(sceneGroups) : undefined,
    lyricLines: lyricLines ? JSON.parse(lyricLines) : undefined,
    // ...
  });
} catch (error) {
  return res.status(400).json({ error: 'Invalid input data', details: error.errors });
}
```
- **Priority**: Fix immediately

### [HIGH] Finding #4: No Authentication or Authorization
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:39, 258, 282`
- **Category**: Security
- **CWE/OWASP**: CWE-306 (Missing Authentication for Critical Function) / OWASP A01:2021 Broken Access Control
- **Description**: All endpoints (`/api/render`, `/api/render/:id/status`, `/api/render/:id/download`) are completely open without any authentication or authorization checks.
- **Impact**:
  - Anyone can upload unlimited files and queue render jobs → DoS via resource exhaustion
  - Anyone can download any rendered video by guessing UUIDs
  - Anyone can check status of any job
  - No rate limiting to prevent abuse
  - Potential for massive storage/compute costs
- **Evidence**:
```typescript
// POST /api/render - No auth check
router.post("/render", upload.any(), async (req: Request, res: Response) => {
  // ... directly processes uploads
});

// GET /api/render/:id/download - No ownership validation
router.get("/render/:id/download", (req: Request, res: Response) => {
  const { id } = req.params;
  const job = renderQueue.getJob(id);
  // ... allows download if job exists
});
```
- **Remediation**: Implement authentication middleware and ownership checks:
```typescript
// Add API key middleware
const requireAuth = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = apiKey; // In production, decode JWT or validate against DB
  next();
};

// Apply to routes
router.post("/render", requireAuth, upload.any(), async (req, res) => { ... });

// Check ownership before download
router.get("/render/:id/download", requireAuth, (req, res) => {
  const job = renderQueue.getJob(id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  // Validate ownership (store userId with job)
  if (job.userId !== req.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  // ... proceed with download
});
```
- **Priority**: Fix immediately

### [HIGH] [FIXED] Finding #5: Path Traversal Risk in Download Endpoint
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:299, 305-306`
- **Category**: Security
- **CWE/OWASP**: CWE-22 (Path Traversal)
- **Description**: While `job.outputPath` is internally generated (good), there's no validation that the file path is within the expected `/server/outputs/` directory before serving it.
- **Impact**: If the `renderQueue` or `outputPath` is ever manipulated (via other vulnerabilities or bugs), an attacker could potentially read arbitrary files from the server filesystem.
- **Evidence**:
```typescript
if (!fs.existsSync(job.outputPath)) {
  return res.status(404).json({ error: "Video file not found" });
}

const filename = path.basename(job.outputPath);
res.download(job.outputPath, `music-video-${id}.mov`, (err) => {
  // ... serves file directly
});
```
- **Remediation**: Validate the path is within the expected directory:
```typescript
const outputsDir = path.join(__dirname, "../outputs");
const resolvedPath = path.resolve(job.outputPath);
const resolvedOutputsDir = path.resolve(outputsDir);

// Ensure the file is within outputs directory
if (!resolvedPath.startsWith(resolvedOutputsDir + path.sep)) {
  console.error(`Path traversal attempt detected: ${job.outputPath}`);
  return res.status(403).json({ error: "Invalid file path" });
}

if (!fs.existsSync(resolvedPath)) {
  return res.status(404).json({ error: "Video file not found" });
}

res.download(resolvedPath, `music-video-${id}.mov`, (err) => { ... });
```
- **Priority**: Next sprint

### [HIGH] Finding #6: Overly Permissive CORS with Credentials
- **Location**: `/home/ianm/Development/suno-video-generator/server/index.ts:11-17`
- **Category**: Security
- **CWE/OWASP**: CWE-942 (Overly Permissive CORS Policy) / OWASP A05:2021 Security Misconfiguration
- **Description**: CORS is configured with `credentials: true` and hardcoded to a single origin. While better than `origin: '*'`, the `credentials: true` flag is risky if not needed, and the hardcoded localhost URL will break in production.
- **Impact**:
  - If cookies/auth tokens are used, they can be sent in cross-origin requests
  - Hardcoded `http://localhost:3001` will fail in production
  - No environment-based configuration for different deployment stages
- **Evidence**:
```typescript
app.use(cors({
  origin: "http://localhost:3001", // Vite dev server (hardcoded)
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 200
}));
```
- **Remediation**: Use environment-based configuration and disable credentials if not needed:
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false, // Disable unless you're using cookies/sessions
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'], // Add auth header
  optionsSuccessStatus: 200
}));
```
- **Priority**: Next sprint

### [HIGH] Finding #7: Missing Security Headers (Helmet.js)
- **Location**: `/home/ianm/Development/suno-video-generator/server/index.ts` (entire file)
- **Category**: Security
- **CWE/OWASP**: OWASP A05:2021 Security Misconfiguration
- **Description**: No security headers are configured (X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, etc.). Express 5 doesn't include helmet by default.
- **Impact**:
  - Vulnerable to clickjacking attacks (missing X-Frame-Options)
  - MIME-sniffing vulnerabilities (missing X-Content-Type-Options)
  - XSS attacks not mitigated by CSP
  - Information disclosure via Server header
- **Evidence**:
```typescript
// index.ts - No helmet or security headers configured
const app = express();
// ... middleware
// MISSING: app.use(helmet());
```
- **Remediation**: Install and configure Helmet:
```bash
npm install helmet
```
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'no-referrer' },
}));
```
- **Priority**: Next sprint

### [MEDIUM] Finding #8: No Rate Limiting on Upload Endpoint
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:39`
- **Category**: Security
- **CWE/OWASP**: CWE-770 (Allocation of Resources Without Limits) / OWASP A04:2021 Insecure Design
- **Description**: The `/api/render` endpoint accepts 100MB files without rate limiting, allowing an attacker to exhaust disk space or memory.
- **Impact**:
  - Denial of Service via rapid upload of large files
  - Storage exhaustion (uploads directory fills disk)
  - Memory exhaustion during multipart parsing
  - Network bandwidth saturation
- **Evidence**:
```typescript
router.post("/render", upload.any(), async (req: Request, res: Response) => {
  // No rate limiting
  // Accepts up to 100MB files
});
```
- **Remediation**: Install and configure express-rate-limit:
```bash
npm install express-rate-limit
```
```typescript
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many upload requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/render", uploadLimiter, upload.any(), async (req, res) => { ... });
```
- **Priority**: Next sprint

### [MEDIUM] [FIXED] Finding #9: Verbose Error Messages Leak Implementation Details
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:247-250`, `/server/renderer.ts:114-116`
- **Category**: Security
- **CWE/OWASP**: CWE-209 (Information Exposure Through Error Message) / OWASP A04:2021 Insecure Design
- **Description**: Error messages return full exception details to clients, potentially leaking internal paths, library versions, or logic details.
- **Impact**:
  - Information disclosure helps attackers understand internal architecture
  - File paths, dependency versions, and stack traces aid in crafting exploits
  - Users see confusing technical errors instead of helpful messages
- **Evidence**:
```typescript
// routes/render.ts:249
res.status(500).json({
  error: error instanceof Error ? error.message : "Failed to create render job",
});

// renderer.ts:115
const errorMessage = error instanceof Error ? error.message : String(error);
renderQueue.markJobAsFailed(jobId, errorMessage); // Full error stored
```
- **Remediation**: Return generic errors to clients, log details server-side:
```typescript
} catch (error) {
  console.error("Error creating render job:", error); // Full error in logs

  // Generic error to client
  res.status(500).json({
    error: "Failed to create render job. Please try again or contact support.",
    errorId: jobId, // Allow user to reference this in support requests
  });
}

// In renderer.ts, sanitize errors before storing:
const safeErrorMessage = process.env.NODE_ENV === 'development'
  ? (error instanceof Error ? error.message : String(error))
  : 'Render failed'; // Generic in production
renderQueue.markJobAsFailed(jobId, safeErrorMessage);
```
- **Priority**: Next sprint

### [MEDIUM] [FIXED] Finding #10: No Cleanup for Orphaned Uploaded Files
- **Location**: `/home/ianm/Development/suno-video-generator/server/routes/render.ts:39-252`
- **Category**: Quality
- **CWE/OWASP**: CWE-404 (Improper Resource Shutdown or Release)
- **Description**: If an error occurs during job creation (after files are uploaded but before job is queued), uploaded files remain in `/server/uploads/` indefinitely. Only the audio file gets cleaned up (line 101-111 in renderer.ts).
- **Impact**:
  - Disk space exhaustion from accumulating orphaned video/image files
  - Privacy concerns (uploaded content not properly deleted)
  - Media files (QR codes, videos) left in uploads directory forever
- **Evidence**:
```typescript
// routes/render.ts:39
router.post("/render", upload.any(), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    // ... processing

  } catch (error) {
    console.error("Error creating render job:", error);
    // MISSING: cleanup of files array
    res.status(500).json({ ... });
  }
});

// Only audio file cleanup exists in renderer.ts:101-111
```
- **Remediation**: Add cleanup on error path:
```typescript
router.post("/render", upload.any(), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];

  try {
    // ... existing code
  } catch (error) {
    console.error("Error creating render job:", error);

    // Cleanup uploaded files on error
    files.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`Cleaned up uploaded file: ${file.path}`);
        }
      } catch (cleanupError) {
        console.error(`Failed to cleanup file ${file.path}:`, cleanupError);
      }
    });

    res.status(500).json({ ... });
  }
});
```
- **Priority**: Backlog

### [LOW] [FIXED] Finding #11: Dependency Vulnerability - glob Package
- **Location**: `/home/ianm/Development/suno-video-generator/package.json` (transitive dependency)
- **Category**: Security
- **CWE/OWASP**: CWE-78 (Command Injection)
- **Description**: npm audit reports HIGH severity CVE in `glob` package (version 10.2.0-10.4.5) - command injection via CLI. This is a transitive dependency (not directly used in this project).
- **Impact**:
  - If the glob CLI is ever invoked with user input, command injection is possible
  - Since this project doesn't directly use glob CLI, risk is low
  - Should still update to prevent future issues
- **Evidence**:
```json
{
  "name": "glob",
  "severity": "high",
  "cwe": ["CWE-78"],
  "range": "10.2.0 - 10.4.5",
  "fixAvailable": true
}
```
- **Remediation**: Update dependencies:
```bash
npm audit fix
```
If auto-fix doesn't work:
```bash
npm update glob
# Or force update all dependencies
npm update
```
- **Priority**: Backlog

## Statistics

### Original Findings
- Critical: 3
- High: 4
- Medium: 3
- Low: 1
- Total: 11

### After Remediation (2025-11-24)
- ✅ Fixed: 7 (all Critical, 1 High, 2 Medium, 1 Low)
- ⏸️ Deferred: 4 (3 High, 1 Medium - acceptable for localhost)
- Remaining Risk: **MEDIUM** (production deployment requires addressing deferred items)

## Positive Security Practices Identified

1. **Randomized Filenames**: Uses `crypto.randomBytes(16)` to generate unpredictable filenames, preventing filename enumeration attacks
2. **File Size Limits**: 100MB limit configured in Multer prevents extremely large files
3. **Temp File Cleanup**: Audio files are properly cleaned up in both success and error paths (renderer.ts:101-129)
4. **UUID Job IDs**: Uses `uuid` library for unpredictable job IDs, reducing enumeration risk
5. **Express 5 Async Error Handling**: Automatic async error catching (though error messages need sanitization)
6. **Path.basename**: Uses `path.basename()` when downloading to prevent path disclosure (line 305)
7. **Proper CORS Configuration**: Not using wildcard `*` origin (though credentials flag is risky)
8. **JSON Body Size Limits**: `express.json({ limit: "100mb" })` prevents unbounded JSON parsing
9. **TypeScript**: Using TypeScript provides some type safety

## Recommended Actions

### Immediate (Before Production)
1. **[CRITICAL]** Implement file type validation with `fileFilter` in Multer configuration
2. **[CRITICAL]** Replace user-controlled extensions with MIME-type-based extension mapping
3. **[CRITICAL]** Add Zod validation schemas for all `JSON.parse()` calls
4. **[HIGH]** Implement authentication/authorization middleware for all endpoints
5. **[HIGH]** Add path traversal protection to download endpoint

### Next Sprint
6. **[HIGH]** Configure environment-based CORS and remove `credentials: true` if not needed
7. **[HIGH]** Install and configure Helmet.js for security headers
8. **[MEDIUM]** Add rate limiting to upload endpoint with express-rate-limit
9. **[MEDIUM]** Sanitize error messages sent to clients (keep details server-side only)

### Backlog
10. **[MEDIUM]** Implement cleanup for orphaned uploaded files on error paths
11. **[LOW]** Run `npm audit fix` to update glob dependency
12. **Enhancement**: Consider adding CSRF protection if authentication is cookie-based
13. **Enhancement**: Implement file cleanup job to remove old uploads/outputs (beyond 24hrs)
14. **Enhancement**: Add request logging middleware for audit trails

## Additional Recommendations

### Production Deployment Checklist
- [ ] Set `NODE_ENV=production` to disable development error messages
- [ ] Configure `ALLOWED_ORIGINS` environment variable for CORS
- [ ] Set up API key or JWT-based authentication
- [ ] Configure proper file storage (S3, etc.) instead of local filesystem
- [ ] Set up monitoring/alerting for failed render jobs
- [ ] Implement database for job persistence (currently in-memory only)
- [ ] Add HTTPS/TLS termination at load balancer or reverse proxy
- [ ] Configure firewall rules to restrict server access
- [ ] Set up automated security scanning in CI/CD pipeline
- [ ] Review and restrict file system permissions on uploads/outputs directories

### Testing Recommendations
- Fuzz test file upload with malformed files, double extensions, path traversal attempts
- Test JSON.parse with prototype pollution payloads (`{"__proto__": {"isAdmin": true}}`)
- Attempt to download jobs with manipulated UUIDs
- Test rate limiting by scripting rapid upload requests
- Verify CORS configuration doesn't allow unexpected origins

---

**Report Generated**: 2025-11-24
**Reviewer**: Claude Code Security Review Agent
**Next Review**: Recommended after implementing Critical/High severity fixes
