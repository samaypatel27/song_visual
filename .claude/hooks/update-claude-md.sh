#!/usr/bin/env bash
# update-claude-md.sh
# Updates the dynamic sections of CLAUDE.md before each commit.
# Called automatically by the PreToolUse hook when a git commit is detected.

set -e

REPO="c:/Users/sudhi/Documents/Coding Projects/song_visual"
CLAUDE_MD="$REPO/CLAUDE.md"

cd "$REPO"

TODAY=$(date +"%Y-%m-%d")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log -1 --pretty=format:"%h — %s" 2>/dev/null || echo "none")
GIT_LOG=$(git log --oneline -5 2>/dev/null || echo "no history")

# Replace the Last Updated block
python3 - <<PYEOF
import re

with open("$CLAUDE_MD", "r", encoding="utf-8") as f:
    content = f.read()

# Update Last Updated block
last_updated = """## Last Updated

<!-- AUTO-UPDATED BY PRE-COMMIT HOOK -->
- **Date:** $TODAY
- **Branch:** $BRANCH
- **Last commit:** $LAST_COMMIT"""

content = re.sub(
    r"## Last Updated\n\n<!-- AUTO-UPDATED BY PRE-COMMIT HOOK -->.*?(?=\n---|\n## )",
    last_updated + "\n\n",
    content,
    flags=re.DOTALL
)

# Update Recent Git Log block
git_log_block = """## Recent Git Log

<!-- AUTO-UPDATED BY PRE-COMMIT HOOK -->
\`\`\`
$GIT_LOG
\`\`\`
"""

content = re.sub(
    r"## Recent Git Log\n\n<!-- AUTO-UPDATED BY PRE-COMMIT HOOK -->.*",
    git_log_block,
    content,
    flags=re.DOTALL
)

with open("$CLAUDE_MD", "w", encoding="utf-8") as f:
    f.write(content)

print("CLAUDE.md updated successfully.")
PYEOF

# Stage the updated CLAUDE.md so it's included in the commit
git add "$CLAUDE_MD"
