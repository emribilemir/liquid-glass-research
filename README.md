# Liquid Glass research

How macOS 26's Liquid Glass really behaves, measured against Apple's own glass, and how close an SVG
`backdrop-filter` in Chromium can get to it. Started for [mcloud](https://github.com/bulutakbulutt/mcloud), a Spicetify
theme that makes Spotify look like Apple Music, whose floating player uses the resulting filter.

**The full write-up is [research/RESEARCH.md](research/RESEARCH.md).** In short:

- Apple Music's player is an `NSGlassView`, a private subclass of `NSGlassEffectView`; at the regular style it renders
  the same as `NSGlassEffectView` and SwiftUI `.glassEffect(.regular)`.
- **Focus changes the glass.** In a focused window it is nearly clear (fine detail stays); in a background window it is
  diffuse. Borderless test windows cannot become key, so naive measurements get the wrong state.
- The focused glass is not a blur: a luminance tone (black 32, white 185, hue kept), a darken halo that dims bright
  detail toward darker surroundings while blacks stay, a soft mirror fold at the rim drawn at device resolution, and a
  highlight along the top and bottom edges only.
- Ground truth in motion: Apple Music can be scrolled synthetically with trackpad-style events, and its own frames
  give the content behind the player.
- Fitted SVG filter error (mean abs per channel inside the bar): 21.9 for a hand-tuned glass, 2.83 on test patterns
  and 5.97 against frames of Apple Music scrolling.

## See it side by side

On a Mac with macOS 26 or later, Google Chrome, Spotify and the Xcode command line tools (`xcode-select --install`):

```sh
curl -fsSL https://raw.githubusercontent.com/emribilemir/liquid-glass-research/main/side-by-side/install.sh | bash
```

It copies your Spotify home page (Spotify restarts twice and scrolls by itself for a few seconds), then opens two
windows over that copy: on the left macOS's own Liquid Glass bar (SwiftUI `.glassEffect`, the glass Apple Music's
player uses), on the right [mcloud](https://github.com/bulutakbulutt/mcloud)'s bar in Chrome. Scroll either window
and both follow. Run the same command again to reopen it; add options after `bash -s --`: `--resnap` copies the page
again, `--ref <branch>` compares another mcloud branch, `--theme <dir>` a local mcloud checkout. Everything lives in
`~/Library/Application Support/LiquidGlassSideBySide`; delete that folder to remove it.

## Layout

| Path | What |
| --- | --- |
| `research/RESEARCH.md` | Findings, method, results, dead ends, open questions |
| `side-by-side/` | The side-by-side viewer (`install.sh`, `SideBySide.swift`) |
| `research/fit/` | Fit backgrounds (`bg/`) and native captures (`apple/` focused, `apple-unfocused/`) |
| `research/music-scroll/` | Barless content and reference frames from Apple Music scrolling |
| `research/scenes/`, `research/grid/` | Real scenes behind Music's player, grid/edge probes |
| `research/compare/` | Side-by-side images and videos (native vs SVG) |
| `research/params/` | Fitted parameter sets and fit logs |
| `research/*.py` | Analysis scripts (PNG decoding, scoring, edge and line probes) |
| `tools/` | Native lab apps (Swift), capture scripts, Chromium fit harness, motion tests; see [tools/README.md](tools/README.md) |

`research/local/` (frame sequences, ~130MB) is not in git; the tools regenerate it.

Measured on macOS 27.0.1, MacBook built-in Retina display (2x, P3), System Settings › Appearance › Liquid Glass at the
leftmost setting. Album artwork and Apple Music screenshots in `research/` are third-party content, included only as
measurement data.
