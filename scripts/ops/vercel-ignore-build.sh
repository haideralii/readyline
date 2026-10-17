#!/usr/bin/env bash
# Vercel "Ignored Build Step" (batch 46, D-2206). Pasted into the Vercel
# project as `bash scripts/ops/vercel-ignore-build.sh` (Settings, Git,
# Ignored Build Step). Vercel reads the exit code the opposite way round from
# a test: 0 means "nothing to build, skip", 1 means "build".
#
# Skip unless the commit is on main and changes something other than the
# product folder and markdown files, so a status or chat commit on main
# builds nothing. This is the second layer only: a build this script cancels
# is still a created deployment and counts against Vercel Hobby's 100 a day
# (Vercel docs, project settings, read 16 Oct 2026), so previews are turned
# off before any deployment exists, in vercel.json's git.deploymentEnabled
# (D-2239). The ref check below stays as a guard for a branch that slips
# through that setting.
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
