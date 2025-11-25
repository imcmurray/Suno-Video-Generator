# suno-video-generator

Automated pipeline for creating professional HD music videos from Suno AI-generated songs.

## Tech Stack

- **Frontend**: React 18, Vite, Radix UI, Tailwind CSS
- **Backend**: Express 5, TypeScript, Multer
- **Video**: Remotion 4.0.377
- **AI**: OpenAI API
- **Validation**: Zod

## Development

```bash
npm run dev:all    # Start both Vite and Express servers
npm run dev        # Remotion studio only
npm run build      # Render video
```

## Project Structure

```
src/               # React frontend (Vite)
server/            # Express 5 backend
  index.ts         # Main server entry
remotion/          # Remotion compositions
uploads/           # Temporary uploaded files
outputs/           # Rendered videos
```

## Security Agents

This project includes specialized security review agents in `.claude/agents/`.

### Running a Security Review

```
/read .claude/agents/security-reviewer/CLAUDE.md
Review server/ for security vulnerabilities
```

### Fixing Security Issues

```
/read .claude/agents/code-fixer/CLAUDE.md
Fix the issues from the security review
```

### Full Workflow

See `.claude/agents/WORKFLOW.md` for complete instructions.

### Key Security Areas

1. **File Uploads** - Multer configuration must validate types/sizes
2. **OpenAI Key** - Must remain server-side only (no VITE_ prefix)
3. **CORS** - Must be explicitly configured, not wildcard
4. **Remotion Renders** - User inputs must be validated/whitelisted
5. **Path Traversal** - All file paths must be validated
6. **Temp Files** - Cleanup uploaded/rendered files

## Code Style

- TypeScript strict mode
- Zod for all request validation
- Async/await (Express 5 handles errors)
- Tailwind for styling (use tailwind-merge for conflicts)
