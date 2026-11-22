#!/usr/bin/env bash
# Build a Charon release on this machine and ship it to hetzner.
#
#   scripts/release-beast.sh                  build charon:<short-sha>, copy it to hetzner
#   scripts/release-beast.sh --deploy         same, then deploy to app.charonx.dev
#   scripts/release-beast.sh --allow-dirty    build uncommitted changes (tag still says HEAD)
#
# No public registry and no push: the image is built for linux/amd64 on this
# machine, saved, and loaded into the remote Docker daemon.
set -euo pipefail

REMOTE="${CHARON_REMOTE:-hetzner}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY=0
ALLOW_DIRTY=0

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --deploy) DEPLOY=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

cd "$REPO_DIR"
SHA="$(git rev-parse --short HEAD)"
IMAGE="charon:$SHA"

if [ "$ALLOW_DIRTY" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit first, or pass --allow-dirty." >&2
  git status --short >&2
  exit 1
fi

# Idempotent: a commit that already has an image is reused, not rebuilt.
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "==> $IMAGE exists, skipping build"
else
  echo "==> Building $IMAGE for linux/amd64"
  docker buildx build --platform linux/amd64 --load -t "$IMAGE" .
fi

echo "==> Copying $IMAGE to $REMOTE"
docker save "$IMAGE" | ssh "$REMOTE" docker load

# Opt-in, and last: swapdock deploys from its own checkout, so it only uses this
# image once its registry entry points at charon:<sha>.
if [ "$DEPLOY" -eq 1 ]; then
  echo "==> Deploying chats"
  ssh "$REMOTE" swapdock up chats
else
  echo "==> Not deployed. When ready: ssh $REMOTE swapdock up chats"
fi
