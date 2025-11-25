# Security Review & Fix Workflow

This dual-agent system provides automated security code review and remediation using Claude Code.

**Configured for: suno-video-generator**
- React 18 + Vite frontend
- Express 5 + TypeScript backend  
- Remotion video rendering
- Multer file uploads
- OpenAI integration

## Quick Start

```bash
# Step 1: Run the Security Reviewer
claude
> /read .claude/agents/security-reviewer/CLAUDE.md
> Review server/index.ts and all files in server/ for security issues

# Step 2: Run the Code Fixer on the findings  
> /read .claude/agents/code-fixer/CLAUDE.md
> Fix issues in security-review-*.md

# Step 3: Re-review to verify fixes
> /read .claude/agents/security-reviewer/CLAUDE.md
> Re-review server/ and compare against remediation-report-*.md
```

## Project-Specific Reviews

### Full Security Audit
```
Review this suno-video-generator project for security issues:
1. Check server/index.ts for CORS, error handling, and middleware
2. Audit all multer file upload configurations
3. Verify OpenAI API key is not exposed to frontend
4. Check Remotion render endpoints for injection
5. Review all API endpoints for input validation
6. Check for path traversal in media file serving
```

### Backend-Focused Review
```
Review the Express backend in server/:
- CORS configuration
- Multer file upload security (types, sizes, filenames)
- OpenAI key exposure
- Error handling and information leakage
- Path traversal vulnerabilities
- Missing Zod validation on request bodies
```

### Frontend Review
```
Review src/ for:
- XSS vulnerabilities in React components
- Secrets or API keys in client code
- Unsafe URL handling in links
- Exposed environment variables (VITE_*)
```

### Remotion Pipeline Review
```
Review Remotion-related code for:
- User input passed to render configurations
- Command injection via composition parameters
- Unsafe file path handling
- Missing cleanup of rendered files
```

## Setup

### 1. Add to Claude Code Settings

Create profiles in your `~/.claude/settings.json`:

```json
{
  "profiles": {
    "security-reviewer": {
      "systemPrompt": "@file:./agents/security-reviewer/CLAUDE.md",
      "model": "claude-sonnet-4-5-20250929"
    },
    "code-fixer": {
      "systemPrompt": "@file:./agents/code-fixer/CLAUDE.md",
      "model": "claude-sonnet-4-5-20250929"
    }
  }
}
```

### 2. Or Use Project-Level CLAUDE.md

Add to your project's `CLAUDE.md`:

```markdown
## Available Agents

### Security Review Mode
When asked to do a security review, follow instructions in `./agents/security-reviewer/CLAUDE.md`

### Code Fix Mode  
When asked to fix security issues, follow instructions in `./agents/code-fixer/CLAUDE.md`
```

## Workflow Patterns

### Pattern A: Full Codebase Audit

```bash
# Comprehensive review
claude --profile security-reviewer "
  Perform a comprehensive security audit of this project:
  1. Start with authentication and authorization code
  2. Review all API endpoints
  3. Check database interactions
  4. Examine file handling
  5. Review third-party integrations
"

# Batch fix
claude --profile code-fixer "
  Read security-review-*.md and fix all Critical and High severity issues.
  Defer Medium and Low for now.
"
```

### Pattern B: Pre-Commit Review

```bash
# Review only staged changes
git diff --cached > /tmp/staged-changes.diff
claude --profile security-reviewer "Review this diff for security issues: /tmp/staged-changes.diff"
```

### Pattern C: Pull Request Review

```bash
# Review PR changes
gh pr diff 123 > /tmp/pr-changes.diff
claude --profile security-reviewer "Review this PR diff: /tmp/pr-changes.diff"
```

### Pattern D: Continuous Loop

```bash
#!/bin/bash
# security-loop.sh - Run until no Critical/High issues remain

while true; do
  claude --profile security-reviewer "Review ./src and save report" 
  
  # Check if any Critical/High issues
  if ! grep -q "Critical\|High" security-review-*.md; then
    echo "No Critical/High issues remaining!"
    break
  fi
  
  claude --profile code-fixer "Fix all Critical and High issues from the latest review"
  
  # Prevent infinite loop
  read -p "Continue review cycle? (y/n) " -n 1 -r
  [[ ! $REPLY =~ ^[Yy]$ ]] && break
done
```

## Example Commands

```bash
# Review specific file
claude --profile security-reviewer "Review ./src/api/auth.py"

# Review with specific focus
claude --profile security-reviewer "Review ./src for SQL injection vulnerabilities only"

# Fix specific severity
claude --profile code-fixer "Fix only CRITICAL issues from security-review-2024-01-15.md"

# Fix with constraints
claude --profile code-fixer "Fix issues but don't modify any test files"

# Interactive fixing
claude --profile code-fixer "Walk me through each fix before applying it"
```

## React Project Commands

```bash
# Full React app security audit
claude --profile security-reviewer "
  Review this React project for security issues:
  - Check all components for XSS vulnerabilities
  - Look for exposed secrets in client code
  - Audit npm dependencies
  - Check API calls for injection risks
"

# Review React components only
claude --profile security-reviewer "Review ./src/components for XSS and unsafe patterns"

# Review API layer
claude --profile security-reviewer "Review ./src/api and ./src/services for security issues"

# Next.js specific review
claude --profile security-reviewer "
  Review this Next.js project:
  - Check API routes in ./pages/api
  - Look for secrets in NEXT_PUBLIC_ env vars
  - Audit getServerSideProps for injection
  - Check middleware for auth bypasses
"

# Fix React-specific issues
claude --profile code-fixer "
  Fix React security issues from the review:
  - Add DOMPurify for any dangerouslySetInnerHTML
  - Move secrets to backend API routes
  - Add URL sanitization
  - Fix any postMessage vulnerabilities
"

# Dependency audit
claude --profile security-reviewer "
  Run npm audit and review package.json for:
  - Known CVEs in dependencies
  - Outdated security-critical packages
  - Unnecessary dependencies that increase attack surface
"
```

## Output Files

The agents generate these files in your project root:

| File | Created By | Purpose |
|------|-----------|---------|
| `security-review-[timestamp].md` | Security Reviewer | Detailed findings report |
| `remediation-report-[timestamp].md` | Code Fixer | Record of applied fixes |

## Tips

1. **Start Narrow**: Review one file or module at a time for manageable findings
2. **Fix by Severity**: Address Critical/High first, defer Low to avoid scope creep
3. **Verify Fixes**: Re-run the reviewer after fixes to confirm resolution
4. **Version Control**: Commit between review cycles for easy rollback
5. **Custom Rules**: Extend the agent prompts with your org's specific requirements

## Extending the Agents

### Add Custom Security Rules

Edit `security-reviewer/CLAUDE.md` to add:

```markdown
## Organization-Specific Rules

- All API endpoints must use our AuthMiddleware
- Database connections must use connection pooling
- PII must never be logged, even at DEBUG level
- External API calls require timeout configuration
```

### Add Framework-Specific Guidance

For Django projects, add to the reviewer:

```markdown
## Django-Specific Checks

- Verify CSRF protection on all forms
- Check for unsafe template rendering (|safe filter)
- Validate SECRET_KEY is not committed
- Ensure DEBUG=False in production settings
```

For React projects, add to the reviewer:

```markdown
## React-Specific Rules

- All user content must be sanitized before dangerouslySetInnerHTML
- No secrets in REACT_APP_ or NEXT_PUBLIC_ env vars
- JWT tokens stored in httpOnly cookies, not localStorage
- All external URLs validated before use in href/src
- Form inputs validated with zod/yup before submission
- Error boundaries around async operations
- No source maps in production builds
```

For Next.js projects:

```markdown
## Next.js-Specific Rules

- API routes must validate request body/params
- getServerSideProps must not expose server secrets to props
- Middleware must properly validate auth tokens
- Dynamic routes must sanitize parameters
- Check next.config.js for security headers
- Verify CORS configuration in API routes
```

For Node.js/Express backends:

```markdown
## Express-Specific Rules

- helmet.js must be configured
- Rate limiting on authentication endpoints
- CORS properly configured (no wildcard with credentials)
- Session cookies must be httpOnly, secure, sameSite
- All database queries parameterized
- File uploads validated (type, size, name)
- No child_process with user input
```
