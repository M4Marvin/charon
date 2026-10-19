#!/bin/sh
# Charon installer for macOS and Linux.
#
#   curl -fsSL https://github.com/M4Marvin/charon/releases/latest/download/install.sh | sh
#
# The release asset is pinned to a published tag; do not pipe a mutable branch.
# You can also download the script, read it, and run it directly.
#
# What it does, in order:
#   1. Detects your OS and CPU.
#   2. Uses Node.js 22+ if you already have it; otherwise downloads a private
#      copy of Node into ~/.charon/runtime. Nothing is installed system-wide.
#   3. Downloads the Charon release for your platform and verifies its SHA-256.
#   4. Writes ~/.charon/bin/charon and starts the app.
#
# It never uses sudo. It never edits your shell profile unless you pass
# --add-to-path. Read this file before running it; that is always allowed.
#
# Environment:
#   CHARON_HOME      Install directory (default: ~/.charon)
#   CHARON_VERSION   Release tag, e.g. v1.2.0 (default: latest)
#   CHARON_PORT      HTTP port (default: 3000)
#   CHARON_NO_START  Set to 1 to install without starting
#   CHARON_NO_OPEN   Set to 1 to start without opening a browser
#   CHARON_SOURCE    Path to a local release tarball (for testing)
#   CHARON_DRY_RUN   Set to 1 to print the plan and exit
set -eu

REPO="M4Marvin/charon"
NODE_MAJOR_MIN=22
CHARON_HOME="${CHARON_HOME:-$HOME/.charon}"
CHARON_VERSION="${CHARON_VERSION:-latest}"
CHARON_PORT="${CHARON_PORT:-3000}"
CHARON_NO_START="${CHARON_NO_START:-0}"
CHARON_NO_OPEN="${CHARON_NO_OPEN:-0}"
CHARON_SOURCE="${CHARON_SOURCE:-}"
CHARON_DRY_RUN="${CHARON_DRY_RUN:-0}"
ADD_TO_PATH=0

say() { printf '%s\n' "$*"; }
step() { printf '  %s %s\n' "$1" "$2"; }
die() { printf '\n  x %s\n\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<'EOF'
Charon installer

Usage:
  install.sh [options]

Options:
  --dir <path>       Install directory (default: ~/.charon)
  --port <number>    HTTP port (default: 3000)
  --version <tag>    Release tag (default: latest)
  --no-start         Install only; do not start Charon
  --no-open          Start Charon without opening a browser
  --add-to-path      Add ~/.charon/bin to PATH in your shell profile
  --dry-run          Print the plan and exit
  --uninstall        Stop Charon and remove the app, keeping your data
  --purge            Remove the app and your data (asks for confirmation)
  -h, --help         Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) CHARON_HOME="$2"; shift 2 ;;
    --port) CHARON_PORT="$2"; shift 2 ;;
    --version) CHARON_VERSION="$2"; shift 2 ;;
    --no-start) CHARON_NO_START=1; shift ;;
    --no-open) CHARON_NO_OPEN=1; shift ;;
    --add-to-path) ADD_TO_PATH=1; shift ;;
    --dry-run) CHARON_DRY_RUN=1; shift ;;
    --uninstall) DO_UNINSTALL=1; shift ;;
    --purge) DO_PURGE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

# Normalize a trailing slash so the destructive-path guards cannot be bypassed.
CHARON_HOME="$(printf '%s' "$CHARON_HOME" | sed 's:/*$::')"
[ -n "$CHARON_HOME" ] || CHARON_HOME="/"

APP_DIR="$CHARON_HOME/app"
BIN_DIR="$CHARON_HOME/bin"
DATA_DIR="$CHARON_HOME/data"
RUNTIME_DIR="$CHARON_HOME/runtime"
SHIM="$BIN_DIR/charon"

if [ "${DO_UNINSTALL:-0}" = "1" ] || [ "${DO_PURGE:-0}" = "1" ]; then
  case "$CHARON_HOME" in
    ""|"/"|"$HOME") die "Refusing to modify $CHARON_HOME. Choose a Charon-specific directory." ;;
  esac
  # Never delete a directory that is not recognizably a Charon install.
  if [ ! -f "$APP_DIR/bin/charon.mjs" ] && [ ! -f "$DATA_DIR/instance.json" ] && [ ! -f "$SHIM" ]; then
    die "No Charon installation found at $CHARON_HOME. Refusing to delete anything."
  fi
  if [ -x "$SHIM" ]; then
    "$SHIM" stop || true
  fi
  if [ "${DO_PURGE:-0}" = "1" ]; then
    say "This deletes $CHARON_HOME, including your chats and characters."
    printf 'Type delete to confirm: '
    if [ -r /dev/tty ]; then
      read -r answer < /dev/tty
    else
      die "No terminal available. Re-run with --purge in an interactive shell."
    fi
    [ "$answer" = "delete" ] || die "Cancelled. Nothing was deleted."
    rm -rf "$CHARON_HOME"
    say "  Removed $CHARON_HOME"
  else
    rm -rf "$APP_DIR" "$BIN_DIR" "$RUNTIME_DIR"
    say "  Removed the app. Your data is still in $DATA_DIR"
  fi
  exit 0
fi

detect_os() {
  case "$(uname -s)" in
    Darwin) OS=darwin ;;
    Linux) OS=linux ;;
    *) die "Unsupported operating system: $(uname -s). Use the Docker image instead." ;;
  esac
  if [ "$OS" = "linux" ]; then
    if [ -f /etc/alpine-release ] || ldd --version 2>&1 | grep -qi musl; then
      die "Alpine and other musl-based Linux systems are not supported by the Node installer, because the release bundles glibc native modules. Use the Docker image instead: docker run -d --name charon --restart unless-stopped -p 127.0.0.1:3000:3000 -v charon-data:/app/data ghcr.io/m4marvin/charon:latest"
    fi
  fi
}

detect_arch() {
  case "$(uname -m)" in
    arm64|aarch64) ARCH=arm64 ;;
    x86_64|amd64) ARCH=x64 ;;
    *) die "Unsupported CPU architecture: $(uname -m)." ;;
  esac
}

download() {
  url="$1"; dest="$2"
  if have curl; then
    curl -fsSL --retry 3 --connect-timeout 20 "$url" -o "$dest"
  elif have wget; then
    wget -q "$url" -O "$dest"
  else
    die "Neither curl nor wget is available. Install one, or use the Docker image."
  fi
}

sha256() {
  if have shasum; then shasum -a 256 "$1" | awk '{print $1}';
  elif have sha256sum; then sha256sum "$1" | awk '{print $1}';
  else die "No SHA-256 tool found (shasum or sha256sum)."; fi
}

node_ok() {
  "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=14)?0:1)' >/dev/null 2>&1
}

find_or_install_node() {
  if have node && node_ok "$(command -v node)"; then
    NODE_BIN="$(command -v node)"
    step "OK" "Node.js $(node -v) found"
    return
  fi

  step ".." "Node.js 22.14+ not found; downloading a private copy"
  mkdir -p "$RUNTIME_DIR"
  shasums="$RUNTIME_DIR/SHASUMS256.txt"
  download "https://nodejs.org/dist/latest-v$NODE_MAJOR_MIN.x/SHASUMS256.txt" "$shasums"

  if [ "$OS" = "darwin" ]; then
    node_os="darwin"
    ext="tar.gz"
  else
    node_os="linux"
    ext="tar.gz"
  fi
  file="$(awk -v os="$node_os" -v arch="$ARCH" -v ext="$ext" '$2 ~ ("^node-v.*-" os "-" arch "\\." ext "$") {print $2; exit}' "$shasums")"
  [ -n "$file" ] || die "Could not find a Node.js build for $node_os-$ARCH."
  expected="$(awk -v f="$file" '$2 == f {print $1; exit}' "$shasums")"

  archive="$RUNTIME_DIR/$file"
  step ".." "Downloading $file"
  download "https://nodejs.org/dist/latest-v$NODE_MAJOR_MIN.x/$file" "$archive"
  actual="$(sha256 "$archive")"
  [ "$expected" = "$actual" ] || die "Node.js checksum mismatch. Refusing to continue."
  tar -xzf "$archive" -C "$RUNTIME_DIR"
  rm -f "$archive" "$shasums"
  node_dir="${file%.tar.gz}"
  NODE_BIN="$RUNTIME_DIR/$node_dir/bin/node"
  [ -x "$NODE_BIN" ] || die "Node.js did not extract as expected."
  step "OK" "Node.js $("$NODE_BIN" -v) installed in $RUNTIME_DIR"
}

release_url() {
  asset="$1"
  if [ "$CHARON_VERSION" = "latest" ]; then
    printf 'https://github.com/%s/releases/latest/download/%s' "$REPO" "$asset"
  else
    printf 'https://github.com/%s/releases/download/%s/%s' "$REPO" "$CHARON_VERSION" "$asset"
  fi
}

if [ "$CHARON_DRY_RUN" = "1" ]; then
  detect_os; detect_arch
  ASSET="charon-$OS-$ARCH.tar.gz"
  say "Charon installer (dry run)"
  say "  platform  $OS-$ARCH"
  say "  home      $CHARON_HOME"
  say "  asset     $ASSET"
  say "  release   $(release_url "$ASSET")"
  say "  port      $CHARON_PORT"
  exit 0
fi

say ""
say "Charon installer"
say ""
step ".." "Detecting your platform"
detect_os
detect_arch
ASSET="charon-$OS-$ARCH.tar.gz"
step "OK" "$OS-$ARCH"

mkdir -p "$CHARON_HOME" "$BIN_DIR" "$DATA_DIR"
find_or_install_node

tmp="$(mktemp -d "${TMPDIR:-/tmp}/charon.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM

if [ -n "$CHARON_SOURCE" ]; then
  step ".." "Using local tarball $CHARON_SOURCE"
  cp "$CHARON_SOURCE" "$tmp/$ASSET"
  if [ "${CHARON_ALLOW_UNVERIFIED:-0}" != "1" ]; then
    die "A local tarball is unverified. Re-run with CHARON_ALLOW_UNVERIFIED=1 if you built it yourself."
  fi
  step "!!" "Unverified local build (allowed by CHARON_ALLOW_UNVERIFIED=1)"
else
  step ".." "Downloading Charon $CHARON_VERSION"
  download "$(release_url "$ASSET")" "$tmp/$ASSET"
  download "$(release_url "$ASSET.sha256")" "$tmp/$ASSET.sha256" ||
    die "The release checksum is unavailable. Refusing to install an unverified download."
  expected="$(awk '{print $1; exit}' "$tmp/$ASSET.sha256")"
  [ -n "$expected" ] || die "The release checksum file is empty. Refusing to install."
  actual="$(sha256 "$tmp/$ASSET")"
  [ "$expected" = "$actual" ] || die "Charon checksum mismatch. Refusing to install."
  step "OK" "Download verified (sha256)"
fi

step ".." "Extracting to $APP_DIR"
rm -rf "$APP_DIR.new"
mkdir -p "$APP_DIR.new"
tar -xzf "$tmp/$ASSET" -C "$APP_DIR.new"
[ -f "$APP_DIR.new/bin/charon.mjs" ] || die "The release is missing bin/charon.mjs."
[ -d "$APP_DIR.new/.output" ] || die "The release is missing .output/."
[ -d "$APP_DIR.new/drizzle" ] || die "The release is missing drizzle/."
# Stop the old server before swapping its files. Otherwise the running process
# keeps serving the previous version (and Windows cannot replace locked .node
# files at all).
if [ -x "$SHIM" ]; then
  "$SHIM" stop >/dev/null 2>&1 || true
fi
rm -rf "$APP_DIR.old"
if [ -d "$APP_DIR" ]; then mv "$APP_DIR" "$APP_DIR.old"; fi
mv "$APP_DIR.new" "$APP_DIR"
rm -rf "$APP_DIR.old"

cat > "$SHIM" <<EOF
#!/bin/sh
CHARON_HOME="$CHARON_HOME"
CHARON_DATA_DIR="$DATA_DIR"
PORT="$CHARON_PORT"
export CHARON_HOME CHARON_DATA_DIR PORT
exec "$NODE_BIN" "$APP_DIR/bin/charon.mjs" "\$@"
EOF
chmod 755 "$SHIM"
printf '{"version":"%s","installedAt":"%s"}\n' "$CHARON_VERSION" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$CHARON_HOME/install.json"
chmod 600 "$CHARON_HOME/install.json" 2>/dev/null || true
step "OK" "Installed $SHIM"

if [ "$ADD_TO_PATH" = "1" ]; then
  case ":${PATH}:" in
    *":$BIN_DIR:"*) ;;
    *)
      line="export PATH=\"$BIN_DIR:\$PATH\""
      for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
        [ -f "$rc" ] || continue
        if ! grep -q "charon:path" "$rc" 2>/dev/null; then
          printf '\n# charon:path\n%s\n' "$line" >> "$rc"
          step "OK" "Added $BIN_DIR to PATH in $rc"
        fi
        break
      done
      ;;
  esac
else
  case ":${PATH}:" in
    *":$BIN_DIR:"*) ;;
    *) say ""; say "  The 'charon' command is at $SHIM"; say "  Add it to PATH with: export PATH=\"$BIN_DIR:\$PATH\"";;
  esac
fi

if [ "$CHARON_NO_START" = "1" ]; then
  say ""
  say "  Installed. Start it with: $SHIM"
  exit 0
fi

say ""
step ".." "Starting Charon"
if [ "$CHARON_NO_OPEN" = "1" ]; then
  CHARON_NO_OPEN=1 "$SHIM" start --no-open || die "Charon did not start. Run: $SHIM logs"
else
  "$SHIM" start || die "Charon did not start. Run: $SHIM logs"
fi

say ""
say "  Charon is running at http://localhost:$CHARON_PORT"
say ""
say "  Next     Create your account, then follow the setup steps in the browser."
say "  Data     $DATA_DIR (copy this folder to back up)"
say "  Stop     $SHIM stop"
say "  Update   $SHIM update"
say "  Help     $SHIM --help"
say ""
