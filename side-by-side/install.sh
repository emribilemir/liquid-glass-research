#!/bin/bash
# Liquid Glass side by side: your Spotify home page under macOS's own Liquid Glass bar (left) and under the mcloud
# theme's bar in Chrome (right), two windows that scroll together.
#
#   curl -fsSL https://raw.githubusercontent.com/emribilemir/liquid-glass-research/main/side-by-side/install.sh | bash
#
# Options (after "bash -s --" when piped):
#   --resnap        copy the Spotify page again (otherwise the first copy is reused)
#   --ref <ref>     mcloud branch or tag to compare (default: main)
#   --theme <dir>   a local mcloud checkout instead of downloading one
#   --route <path>  the Spotify page to copy (default: / , the home page)
# Needs macOS 26 or later, the Xcode command line tools (swiftc), Google Chrome and Spotify. Everything goes into
# ~/Library/Application Support/LiquidGlassSideBySide; delete that folder to remove it.
set -euo pipefail

REPO=emribilemir/liquid-glass-research THEME_REPO=bulutakbulutt/mcloud
DIR="$HOME/Library/Application Support/LiquidGlassSideBySide"
REF=main THEME="" ROUTE=/ RESNAP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --resnap) RESNAP=1 ;;
    --ref) REF="$2"; shift ;;
    --theme) THEME="$2"; shift ;;
    --route) ROUTE="$2"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

die() { echo "$*" >&2; exit 1; }
[ "$(uname)" = Darwin ] || die "This runs on macOS only: it shows macOS's own Liquid Glass."
[ "$(id -u)" -ne 0 ] || die "Run it as yourself, not as root."
[ "$(sw_vers -productVersion | cut -d. -f1)" -ge 26 ] || die "Liquid Glass needs macOS 26 (Tahoe) or later."
xcrun --find swiftc >/dev/null 2>&1 || die "The Xcode command line tools are missing. Install them with: xcode-select --install"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || die "Google Chrome was not found in /Applications (set CHROME=<path to its binary> to use another Chromium)."
SPOTIFY=$(mdfind "kMDItemCFBundleIdentifier == 'com.spotify.client'" 2>/dev/null | head -1)
[ -n "$SPOTIFY" ] || [ -d /Applications/Spotify.app ] || die "Spotify was not found."
mkdir -p "$DIR"

# The program: next to this script in a clone, otherwise from GitHub.
HERE=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "$(dirname "${BASH_SOURCE[0]}")/SideBySide.swift" ]; then HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); fi
if [ -n "$HERE" ]; then SRC="$HERE/SideBySide.swift"; else
  SRC="$DIR/SideBySide.swift"; echo "Downloading the program..."
  curl -fsSL "https://raw.githubusercontent.com/$REPO/main/side-by-side/SideBySide.swift" -o "$SRC.new" && mv "$SRC.new" "$SRC"
fi
BIN="$DIR/SideBySide"
if [ ! -x "$BIN" ] || [ "$SRC" -nt "$BIN" ] || ! cmp -s "$SRC" "$DIR/.built.swift"; then
  echo "Building (about a minute the first time)..."
  swiftc -O -target "$(uname -m)-apple-macosx26.0" "$SRC" -o "$BIN" 2>"$DIR/build.log" || { cat "$DIR/build.log" >&2; die "The build failed."; }
  cp "$SRC" "$DIR/.built.swift"
fi

# The theme the right window runs.
if [ -z "$THEME" ]; then
  THEME="$DIR/mcloud"; echo "Downloading mcloud ($REF)..."
  rm -rf "$THEME.new"; mkdir -p "$THEME.new"
  curl -fsSL "https://codeload.github.com/$THEME_REPO/tar.gz/$REF" | tar -xz -C "$THEME.new" --strip-components=1 || die "Could not download mcloud at \"$REF\"."
  rm -rf "$THEME"; mv "$THEME.new" "$THEME"
fi
[ -f "$THEME/dev/preview.html" ] || die "$THEME is not an mcloud checkout (dev/preview.html is missing)."

# The page: Spotify restarts with its DevTools port, the program scrolls through the page and saves it, and
# Spotify restarts normally.
quit_spotify() { osascript -e 'quit app "Spotify"' >/dev/null 2>&1 || true; for _ in $(seq 40); do pgrep -qf "Spotify.app/Contents/MacOS/Spotify" || return 0; sleep 0.5; done; }
if [ "$RESNAP" = 1 ] || [ ! -f "$DIR/page/page.json" ]; then
  echo "Copying your Spotify page: Spotify will restart twice and scroll by itself for a few seconds."
  quit_spotify
  open -a Spotify --args --remote-debugging-port=9229
  for _ in $(seq 60); do curl -s -m 1 http://127.0.0.1:9229/json/list | grep -q xpui && break; sleep 1; done
  sleep 8; open -a Spotify
  rm -rf "$DIR/page"; "$BIN" snap "$DIR/page" "$ROUTE" || { quit_spotify; open -a Spotify; die "Copying the page failed."; }
  quit_spotify; open -a Spotify
fi

echo "Opening the two windows. Scroll either one; close the left window to quit."
exec "$BIN" "$DIR/page" "$THEME"
