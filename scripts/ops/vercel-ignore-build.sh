#!/usr/bin/env bash
# Vercel "Ignored Build Step" (batch 46, D-2206). Pasted into the Vercel
# project as `bash scripts/ops/vercel-ignore-build.sh` (Settings, Git,
# Ignored Build Step). Vercel reads the exit code the opposite way round from
# a test: 0 means "nothing to build, skip", 1 means "build".
#
# Skip unless the commit is on main and changes something other than the
# product folder and markdown files. Previews stop (CI's Playwright run
# against a production build covers what they did), and a status or chat
# commit on main costs no deployment against Vercel Hobby's 100 a day.
set -u

ref="${VERCEL_GIT_COMMIT_REF:-}"
if [ "$ref" != "main" ]; then
  echo "skip: ref '$ref' is not main"
  exit 0
fi

# A first commit or a clone without the parent cannot be judged: build.
if ! git rev-parse --verify --quiet HEAD^ >/dev/null; then
  echo "build: no parent commit to compare with"
  exit 1
fi

# `*.md` in a git pathspec matches at any depth; product/ is excluded whole.
if git diff --quiet HEAD^ HEAD -- . ':(exclude)product' ':(exclude)*.md'; then
  echo "skip: only product/ or markdown changed"
  exit 0
fi

echo "build: code changed on main"
exit 1
