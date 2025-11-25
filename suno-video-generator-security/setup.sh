#!/bin/bash
# setup-security-agents.sh
# Run this from your suno-video-generator project root

set -e

echo "Setting up security review agents..."

# Create directory structure
mkdir -p .claude/agents/security-reviewer
mkdir -p .claude/agents/code-fixer

# Check if files exist in current directory
if [ -f "security-reviewer/CLAUDE.md" ]; then
    cp security-reviewer/CLAUDE.md .claude/agents/security-reviewer/
    cp code-fixer/CLAUDE.md .claude/agents/code-fixer/
    cp WORKFLOW.md .claude/agents/
    echo "✓ Copied agent files from current directory"
else
    echo "Error: Agent files not found. Make sure you're in the directory with the downloaded files."
    exit 1
fi

# Append to existing CLAUDE.md or create new one
if [ -f "CLAUDE.md" ]; then
    echo ""
    echo "Found existing CLAUDE.md. Add these lines to enable security agents:"
    echo ""
    echo "## Security Agents"
    echo ""
    echo "Security review agents available in \`.claude/agents/\`."
    echo "See \`.claude/agents/WORKFLOW.md\` for usage instructions."
    echo ""
else
    echo "No CLAUDE.md found. Creating one..."
    cat > CLAUDE.md << 'EOF'
# suno-video-generator

## Security Agents

Security review agents available in `.claude/agents/`.
See `.claude/agents/WORKFLOW.md` for usage instructions.

### Quick Security Review
```
/read .claude/agents/security-reviewer/CLAUDE.md
Review server/ for security vulnerabilities
```

### Fix Security Issues
```
/read .claude/agents/code-fixer/CLAUDE.md
Fix the issues from the security review
```
EOF
    echo "✓ Created CLAUDE.md"
fi

echo ""
echo "✓ Setup complete!"
echo ""
echo "Usage:"
echo "  1. Start Claude Code: claude"
echo "  2. Load reviewer: /read .claude/agents/security-reviewer/CLAUDE.md"
echo "  3. Run review: Review server/ for security issues"
echo "  4. Load fixer: /read .claude/agents/code-fixer/CLAUDE.md"  
echo "  5. Fix issues: Fix the security issues from the review"
