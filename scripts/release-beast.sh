#!/usr/bin/env bash
# Build a Charon release on this machine and ship it.
#
#   scripts/release-beast.sh              build charon:<sha>, copy it to hetzner
#   scripts/release-beast.sh --download   build amd64 + arm64, publish both to files.charonx.dev/dl/
#   scripts/release-beast.sh --deploy     build, copy to hetzner, deploy chats
#   scripts/release-beast.sh --allow-dirty
#
# No public registry and no push: images are built for linux/amd64 and
# linux/arm64 on this machine, saved, and either loaded into the remote Docker
# daemon or gzipped and published for people running Charon locally.
set -euo pipefail

REMOTE="${CHARON_REMOTE:-hetzner}"
R2_REMOTE="${CHARON_R2_REMOTE:-r2:charonx-media}"
PUBLIC_BASE="${CHARON_PUBLIC_BASE:-https://files.charonx.dev}"
RCLONE="${CHARON_RCLONE:-$HOME/.local/bin/rclone}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY=0
DOWNLOAD=0
ALLOW_DIRTY=0

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --deploy) DEPLOY=1 ;;
    --download) DOWNLOAD=1 ;;
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
build_image() { # <arch> <tag>
  if docker image inspect "$2" >/dev/null 2>&1; then
    echo "==> $2 exists, skipping build"
  else
    echo "==> Building $2 for linux/$1"
    docker buildx build --platform "linux/$1" --load -t "$2" .
  fi
}

build_image amd64 "$IMAGE"

if [ "$DOWNLOAD" -eq 1 ]; then
  [ -x "$RCLONE" ] || { echo "rclone not found at $RCLONE" >&2; exit 1; }
  build_image arm64 "$IMAGE-arm64"

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  : >"$tmp/latest.txt"
  printf 'version %s\n' "$SHA" >>"$tmp/latest.txt"
  printf 'published %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$tmp/latest.txt"

  for arch in amd64 arm64; do
    tag="$IMAGE"
    [ "$arch" = arm64 ] && tag="$IMAGE-arm64"
    key="dl/charon-$SHA-$arch.tar.gz"
    echo "==> Packing $tag"
    docker save "$tag" | gzip -6 >"$tmp/charon-$arch.tar.gz"
    sha256="$(sha256sum "$tmp/charon-$arch.tar.gz" | cut -d' ' -f1)"
    bytes="$(stat -c %s "$tmp/charon-$arch.tar.gz")"
    echo "==> Uploading $(numfmt --to=si "$bytes") to $R2_REMOTE/$key"
    "$RCLONE" copyto "$tmp/charon-$arch.tar.gz" "$R2_REMOTE/$key" --s3-no-check-bucket \
      --header-upload "Cache-Control: public, max-age=31536000, immutable"
    printf '%s  charon-%s.tar.gz\n' "$sha256" "$arch" >"$tmp/charon-$arch.tar.gz.sha256"
    "$RCLONE" copyto "$tmp/charon-$arch.tar.gz.sha256" "$R2_REMOTE/$key.sha256" --s3-no-check-bucket \
      --header-upload "Cache-Control: public, max-age=31536000, immutable"
    printf '%s %s/%s %s %s\n' "$arch" "$PUBLIC_BASE" "$key" "$sha256" "$bytes" >>"$tmp/latest.txt"
    remote_len="$(curl -fsSI "$PUBLIC_BASE/$key" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}')"
    [ "$remote_len" = "$bytes" ] || { echo "size mismatch on $arch: remote=$remote_len local=$bytes" >&2; exit 1; }
  done

  "$RCLONE" copyto "$tmp/latest.txt" "$R2_REMOTE/dl/latest.txt" --s3-no-check-bucket \
    --header-upload "Cache-Control: no-cache"
  echo "==> Published $PUBLIC_BASE/dl/latest.txt ($SHA, amd64 + arm64)"
fi

if [ "$DEPLOY" -eq 1 ] || [ "$DOWNLOAD" -eq 0 ]; then
  echo "==> Copying $IMAGE to $REMOTE"
  docker save "$IMAGE" | ssh "$REMOTE" docker load
fi

if [ "$DEPLOY" -eq 1 ]; then
  echo "==> Deploying chats"
  ssh "$REMOTE" swapdock up chats
else
  echo "==> Not deployed. When ready: ssh $REMOTE swapdock up chats"
fi
