#!/usr/bin/env bash
# sync-rule-templates.sh
# Clones the ai-rules repo from SpaceMalamute and copies rule template .md files
# into src/main/assets/rule-templates/, preserving directory structure.
# Excludes JSON files and SKILL.md files.

set -euo pipefail

REPO_URL="https://github.com/SpaceMalamute/ai-rules.git"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATES_DIR="$PROJECT_ROOT/src/main/assets/rule-templates"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "==> Cloning ai-rules repo into temp directory..."
git clone --depth 1 --quiet "$REPO_URL" "$TMP_DIR/ai-rules"

SOURCE_DIR="$TMP_DIR/ai-rules/configs"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: configs/ directory not found in the repo."
  exit 1
fi

echo "==> Cleaning existing templates..."
rm -rf "$TEMPLATES_DIR"
mkdir -p "$TEMPLATES_DIR"

echo "==> Copying .md rule templates (excluding SKILL.md and JSON files)..."
cd "$SOURCE_DIR"
find . -type f -name "*.md" ! -name "SKILL.md" | while read -r file; do
  dest="$TEMPLATES_DIR/$file"
  mkdir -p "$(dirname "$dest")"
  cp "$file" "$dest"
done

FILE_COUNT=$(find "$TEMPLATES_DIR" -type f -name "*.md" | wc -l | tr -d ' ')
echo "==> Done. Copied $FILE_COUNT template files into $TEMPLATES_DIR"
