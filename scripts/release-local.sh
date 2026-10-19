#!/usr/bin/env bash
# Build and publish a Charon release locally. No GitHub Actions.
#
#   scripts/release-local.sh v0.1.0
#
# Requirements: git, gh (authenticated), pnpm, node, npm, tar, zip, sha256sum.
# The tag must already exist and point at the commit you want to release.
set -euo pipefail

TAG="${1:-}"
if [ -z "$TAG" ]; then
  echo "usage: $0 <tag>  (for example v0.1.0)" >&2
  exit 2
fi
git rev-parse --verify "$TAG" >/dev/null

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CACHE="$ROOT/.release-cache"
PKGS="$CACHE/pkgs"
IMG="$CACHE/img"
ASSETS="$CACHE/assets"
STAGE="$CACHE/stage"
rm -rf "$CACHE"
mkdir -p "$PKGS" "$IMG" "$ASSETS"

echo "==> Building .output"
pnpm build

SHARP="$(node -p "require('./.output/server/node_modules/sharp/package.json').version")"
LIBVIPS="$(node -p "require('./.output/server/node_modules/sharp/package.json').optionalDependencies['@img/sharp-libvips-linux-x64']")"
echo "==> Sharp $SHARP / libvips $LIBVIPS"

echo "==> Fetching non-host Sharp binaries"
(
  cd "$PKGS"
  npm_config_cache="$CACHE/npm" npm_config_logs_dir="$CACHE/npm-logs" npm pack --silent     "@img/sharp-darwin-x64@$SHARP"     "@img/sharp-libvips-darwin-x64@$LIBVIPS"     "@img/sharp-darwin-arm64@$SHARP"     "@img/sharp-libvips-darwin-arm64@$LIBVIPS"     "@img/sharp-linux-arm64@$SHARP"     "@img/sharp-libvips-linux-arm64@$LIBVIPS"     "@img/sharp-win32-x64@$SHARP" >/dev/null
)
for file in "$PKGS"/*.tgz; do
  tmp="$(mktemp -d)"
  tar -xzf "$file" -C "$tmp"
  name="$(node -p "require('$tmp/package/package.json').name")"
  rm -rf "$IMG/${name#@img/}"
  mv "$tmp/package" "$IMG/${name#@img/}"
  rm -rf "$tmp"
done
cp -R .output/server/node_modules/@img/sharp-linux-x64 "$IMG/"
cp -R .output/server/node_modules/@img/sharp-libvips-linux-x64 "$IMG/"

stage() {
  rm -rf "$STAGE"
  mkdir -p "$STAGE"
  cp -R .output "$STAGE/.output"
  cp -R drizzle "$STAGE/drizzle"
  cp -R bin "$STAGE/bin"
  cp LICENSE NOTICE README.md "$STAGE/"
  printf 'Source for this release: https://github.com/%s/tree/%s\n' "$(git remote get-url origin | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?#\1#')" "$TAG" > "$STAGE/SOURCE.txt"
  find "$STAGE/.output/server/node_modules/@img" -mindepth 1 -maxdepth 1 -type d ! -name colour -exec rm -rf {} +
}

build_tar() {
  target="$1"; shift
  stage
  for dir in "$@"; do cp -R "$IMG/$dir" "$STAGE/.output/server/node_modules/@img/$dir"; done
  tar -czf "$ASSETS/charon-$target.tar.gz" -C "$STAGE" .
}

build_zip() {
  stage
  cp -R "$IMG/sharp-win32-x64" "$STAGE/.output/server/node_modules/@img/sharp-win32-x64"
  (cd "$STAGE" && zip -qr "$ASSETS/charon-windows-x64.zip" .)
}

echo "==> Packaging"
build_tar linux-x64 sharp-linux-x64 sharp-libvips-linux-x64
build_tar linux-arm64 sharp-linux-arm64 sharp-libvips-linux-arm64
build_tar darwin-x64 sharp-darwin-x64 sharp-libvips-darwin-x64
build_tar darwin-arm64 sharp-darwin-arm64 sharp-libvips-darwin-arm64
build_zip

(
  cd "$ASSETS"
  sha256sum *.tar.gz *.zip > SHA256SUMS.txt
  for file in *.tar.gz *.zip; do sha256sum "$file" > "$file.sha256"; done
)

echo "==> Publishing $TAG"
FILES=("$ASSETS"/charon-* "$ASSETS/SHA256SUMS.txt" scripts/install.sh scripts/install.ps1)
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "${FILES[@]}" --clobber
else
  gh release create "$TAG" --verify-tag --title "Charon $TAG" --generate-notes "${FILES[@]}"
fi
echo "==> Done: $(gh release view "$TAG" --json url --jq .url)"
