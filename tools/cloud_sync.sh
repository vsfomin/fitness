#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if ! git remote get-url origin >/dev/null 2>&1; then
  exit 0
fi

lock=.sync.lock
if ! mkdir "$lock" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$lock"' EXIT INT TERM

git add -A
if git diff --cached --quiet; then
  exit 0
fi

git commit -m "Backup $(date '+%Y-%m-%d %H:%M:%S %Z')"
branch=$(git symbolic-ref --short HEAD)
git push -u origin "$branch"
