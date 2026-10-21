#!/usr/bin/env bash
# Publishes the branch to https://github.com/Hesamsamani/zirobam (branch main), which GitHub Pages serves at
# https://hesamsamani.me/zirobam/ (the workflow in .github/workflows/pages.yml builds and deploys it).
#
#   bash scripts/publish.sh --dry-run    does everything except the push, and says what it would push
#   bash scripts/publish.sh              pushes (only when the owner asked for it)
#
# The commits of this repository carry the owner's own email address. The published history must not: this script
# makes a COPY of the branch, rewrites every author and committer email that is not already a public one to the
# GitHub no-reply address of the logged-in `gh` user, checks the result, and pushes the copy. The repository itself
# is not touched and has no `origin`. The rewrite is deterministic, so a later publish has the same hashes for the
# commits that were published before, and the push is a plain fast-forward.
#
# Needs: git, gh (logged in). BRANCH can be set to publish another branch (default: bilingual).
set -euo pipefail

REMOTE_URL="${REMOTE_URL:-https://github.com/Hesamsamani/zirobam.git}"
BRANCH="${BRANCH:-bilingual}"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

repo="$(git rev-parse --show-toplevel)"
id="$(gh api user --jq .id)"
login="$(gh api user --jq .login)"
NOREPLY="${id}+${login}@users.noreply.github.com"
export NOREPLY

if [ -n "$(git -C "$repo" status --porcelain --untracked-files=no)" ]; then
  echo "note: there are uncommitted changes; only what is committed on $BRANCH is published" >&2
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git clone --quiet --no-hardlinks --single-branch --branch "$BRANCH" "$repo" "$work/copy"
cd "$work/copy"
git remote remove origin

# every email that is not already public (the AI co-author, the upstream author, GitHub no-reply) becomes the no-reply address
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --env-filter '
for who in AUTHOR COMMITTER; do
  eval "mail=\$GIT_${who}_EMAIL"
  case "$mail" in
    noreply@anthropic.com|ford@ftrain.com|*@users.noreply.github.com) ;;
    *) export "GIT_${who}_EMAIL=$NOREPLY" ;;
  esac
done
' -- HEAD >/dev/null 2>&1

echo "== checks on the copy that would be published =="
bad=0
emails="$(git log --format='%ae%n%ce' | sort -u)"
echo "emails in the history:"
echo "$emails" | sed 's/^/  /'
while IFS= read -r mail; do
  case "$mail" in
    noreply@anthropic.com|ford@ftrain.com|*@users.noreply.github.com) ;;
    *) echo "FAIL: a private email is left in the history: $mail" >&2; bad=1 ;;
  esac
done <<< "$emails"
if git grep -nIiE '[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo)\.[a-z]+' -- . ':!package-lock.json' >/dev/null; then
  echo "FAIL: a personal email address is in a file:" >&2
  git grep -nIiE '[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo)\.[a-z]+' -- . ':!package-lock.json' >&2 || true
  bad=1
fi
if git grep -nIiE 'ghp_[A-Za-z0-9]{20}|github_pat_[A-Za-z0-9_]{20}|BEGIN (RSA|OPENSSH|EC|PRIVATE)' >/dev/null; then
  echo "FAIL: something that looks like a secret is in a file" >&2
  bad=1
fi
if git grep -nIF 'C:\Users' -- . ':!scripts/publish.sh' >/dev/null; then
  echo "FAIL: a local user path is in a file:" >&2
  git grep -nIF 'C:\Users' -- . ':!scripts/publish.sh' >&2 || true
  bad=1
fi
[ "$bad" = "0" ] || { echo "nothing was pushed" >&2; exit 1; }
echo "ok: $(git rev-list --count HEAD) commits, head $(git rev-parse --short HEAD), no private email, secret or local path"

if [ "$DRY" = "1" ]; then
  echo "dry run: would push HEAD to $REMOTE_URL (main)"
  exit 0
fi
git push "$REMOTE_URL" HEAD:main
echo "pushed to $REMOTE_URL (main); the workflow publishes https://hesamsamani.me/zirobam/"
