#!/bin/bash
# Fresh cloud clones have no origin/HEAD, which breaks /security-review's `git diff origin/HEAD...`.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"
git symbolic-ref -q refs/remotes/origin/HEAD >/dev/null && exit 0
git remote set-head origin master >/dev/null 2>&1 || true
