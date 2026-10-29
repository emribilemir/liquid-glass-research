# Liquid Glass research: matching Apple Music's player in an SVG filter

What we learned measuring macOS 26's Liquid Glass (macOS 27.0.1, MacBook built-in Retina, 2x) and fitting the theme's
`#am-glass` SVG backdrop filter to it. The tools are one level up (`dev/glass`); this folder holds the data.

## Which glass Apple Music uses

- `strings /System/Applications/Music.app/Contents/MacOS/Music` shows `NSGlassView` properties
  (`topControlPlatter`, `topVolumePlatter`, `sliderAreaGlassView`), Swift classes `MPTransportPlatter`,
  `MPScrubberPlatter`, `MPTitlePlatter`, and calls to `set_variant:` and `setStyle:`.
- `NSGlassView` is a private subclass of `NSGlassEffectView` (public, macOS 26). Its private properties (dumped with
  the ObjC runtime): `_variant`, `_subvariant`, `_interactionState`, `_subduedState`, `_tintOpacityReduced`,
  `_scrimState`, `_contentLensing`, `_adaptiveAppearance`, `_useReducedShadowRadius`, `_inverseMeshed`, ...
- Over the same background, `NSGlassView`, `NSGlassEffectView` (style `.regular`) and SwiftUI
  `.glassEffect(.regular, in: .capsule)` render the same pixels. `_variant` 0, 1 and 12 match the default; 2-11 differ.
  `.clear` style differs a lot.
- The System Settings › Appearance › Liquid Glass slider is `NSGlassTintAmount` in the global domain. The user keeps it
  at the leftmost (0). Passing `-NSGlassTintAmount 0.5` or `1` to a test app changes the glass visibly; 0 matches Music.

## What Apple Music's player really is (verified 2026-10-26)

The `NSGlassView` properties in Music's binary are not the main player: `otool -oV` on
`/System/Applications/Music.app/Contents/MacOS/Music` puts `topControlPlatter`, `topVolumePlatter` and
`selectorContainer` (typed `NSGlassView`) on `VideoHUDLockup` (the video HUD), and `sliderAreaGlassView` on
`SpeakerButtonController` (the volume slider). `MPTransportPlatter`, `MPScrubberPlatter` and `MPTitlePlatter` subclass
`AMPBindableView`, not a glass view.

The running process tells the rest. `heap <pid of Music>` (works without special rights) lists live objects:

- `MediaCoreUI.NowPlayingView` (24), with `MediaCoreUI.(HideWhenVolumePlatterExpanded)`, `ToggleButton`s: the player
  bar is SwiftUI in the private framework `MediaCoreUI`.
- `SwiftUI.GlassContainer.Entry` (10): glass inside a `GlassEffectContainer`.
- `DesignLibrary.GlassMaterialProvider` in `AnimatableStatefulMaterialProviderBox` (14): SwiftUI's glass material, with
  animated state (hover/press, i.e. likely `.interactive()`).
- `_NSGlassEffectViewMaterialContext` (9): the AppKit glass views behind them. `CABackdropLayer` (45).

`MediaCoreUI` lives only in the dyld shared cache; `tools/sections.swift` dlopens it and dumps its strings and Swift
reflection names. It has a Metal `MaterialRenderer` ("Reflect, saturate + scrim treatment", lightening/darkening scrim
opacities from artwork luminance) for the full-bleed artwork background, and fields `glassGroup`,
`_hasGlassGroupSiblings`, `isPlatterExpanded`, `platterFrame` on the player's views. No custom highlight or rim layer
showed up; the edge look should come from the SwiftUI glass itself, in a container.

**Rebuilt and confirmed.** `tools/Lab3.swift` draws a SwiftUI `.glassEffect(.regular, in: Capsule())`, alone, in a
`GlassEffectContainer`, and with `.interactive()`, at Music's geometry (701x54pt at 40, 40.5) over the barless content
from Music's scroll frames, focused. Against Music's own frames (glyph-free stretches, every band from the top edge to
the bottom edge) all four SwiftUI variants differ by **0.3** per channel on average: Music's player is exactly this
glass; container and interactive state change nothing when static. (`research/local/lab3`, script in the commit.)
So any SwiftUI `.glassEffect` capsule is a perfect reference generator for the player, at any background.

## Ground truth: the scene behind Music's real player

The player floats over the content, so a capture with the player in place cannot be compared to "what is behind it"
directly. Making Music's window taller moves the player down (it is pinned to the bottom) while the content stays, so
the content that was under the player becomes visible: two window captures (`screencapture -l <id> -o`) give the
background and the reference (`scenes/scene*-bg.png`, `scenes/scene*-ref.png`; the player is 701x55pt, 40pt margin).
Synthetic scroll-down events (`CGEvent` scroll wheel, arrow keys) did not scroll Music's home; scroll-up did.

## Focus changes everything

- macOS glass has two looks by window focus. In a key (focused) window it is nearly clear: a 4pt checker keeps its
  pattern, faces and fabric stay readable. In a background window it is diffuse: a 1pt dot spreads over +-10pt.
- Borderless `NSWindow`s cannot become key, so the first test app always rendered the background state, and the
  first Music captures were taken while Music was in the background. The first fit (σ ≈ 6pt, two blurs) therefore
  matched the diffuse glass and looked far blurrier than Music. The user caught it by eye.
- Test windows now subclass `NSWindow` (`canBecomeKey`), retake focus every 50ms and publish their key state; the
  capture script keeps a shot only if the window was key before and after it. Apple Music is activated before each
  capture of it. Any test of glass must check focus.

## The focused glass, measured

Patterns behind the glass (2x, `fit/bg`): stripes, single lines at known distances from the rim, a grey ramp, an 8pt
grid, a 4pt checker, step edges, and real scenes. Native captures in `fit/apple` (focused) and `fit/apple-unfocused`.

- **Tone** (uniform greys, centre of the bar), in -> out: 0->32, 32->62, 64->89, 96->113, 128->134, 160->152,
  192->166, 224->177, 255->185. It works on luminance and keeps the hue: applying the curve to each channel turned
  orange into olive. Unfocused: 0->20, 128->127, 255->180.
- **Local contrast, not blur.** At a black/white step the dark side stays at 32 right up to the edge while the bright
  side rises to ~160 at once and creeps to 184 over ~30pt. Fine bright detail is dimmed (1pt grid lines 255 -> 118;
  checker white 146 instead of 185) while black stays black. A symmetric blur cannot do both; a `darken` blend
  (min of the image and a 9.5pt blur, mixed at 70%) fits it.
- **No magnification** across the face of the bar (stripe centroids stay put) and **no light from outside**: lines
  placed outside the bar never appear inside it.
- **Rim:** the outermost ~2pt show content from 14-16pt further in, folding back over ~4pt, flat from ~14pt in. The
  edge mirrors what is just inside it (text near the top shows upside down at the rim, in Music and in the lab).
- **Edge highlight (top and bottom only).** The outermost device pixel along the top and bottom edges mixes ~13%
  toward a "brighter than white" level (~2.2x), fading over ~5px: over black 32 -> 85, 62, 43, 40...; over white
  184 -> 217, 203, 191... None at the middle of the round ends (it follows the vertical part of the edge normal, fitted
  as |n_y|^3.5). It is present in the plain lab glass and in Music's real player alike (`compare/music-focused-highlight.png`);
  the first fits missed it because they sampled the middle of the bar.
- **Rim softness.** The bend lives in the outermost ~2px; a displacement map at CSS size gives it two steps on a 2x
  screen and a hard fold. Drawn at device resolution with knots every 0.5px it matches Apple's soft fold.

## The fit

`fit.mjs` renders the same backgrounds in Chromium (2x) with a parametric filter and compares with the native
captures (mean abs per channel inside the bar). Coordinate descent over the parameters. Results (`params/`):

| model | error |
| --- | --- |
| theme before this work (hand-tuned lens, white to 0.6) | 21.9 |
| fitted to the unfocused glass (σ 4 + 4.25, luminance tone) | 2.2 vs unfocused targets |
| focused, per-channel tone | ~13 |
| focused, luminance tone, slight blur | 7.4 |
| focused + darken halo | 4.2 |
| + top/bottom highlight, device-resolution maps, rim knots every 0.5px (shipped) | 2.9 |

Shipped parameters (`glassStates.focused` in `theme.js`, `params/fit-hi.log`): pre-blur 0.4px; displacement
`[15,15.6,18.1,15.7,12.25,10.9,7.5,5,0.75,0]` px at `[0,.5,1,1.5,2,3,4,6,9,14]` px from the edge; darken blend with a
9.5px blur at 70%; luminance tone with gain 1.1; highlight table `[.13,.072,.027,...]` every 0.5px toward 2.23x,
|n_y|^3.5; no saturation boost. The theme keeps only the focused look (the user's choice).

Things that did not work: a wide halo mixed in plainly (raises the black cells of the grid), blurring in linearRGB
(far off), one blur after the bend only (aliases stripes at the rim into sharp slivers), a squircle bend (folds).

## Chromium pitfalls found on the way

- On P3 screens Chromium converts the filter's `feImage` maps from sRGB to P3; red takes ~18% of green, so a vertical
  shift leaked into a sideways one ("the page slides left"). The map is two grey images recombined as R=G=x, B=y,
  with blue's ~9% share of x undone on `(color-gamut: p3)`.
- `feComposite arithmetic` on partly transparent pixels (blur near the region edge) wrecks colours; force alpha 1 first.
- Untagged PNGs drawn in a native view are treated as sRGB and converted; retag them with the screen's colour space
  when the pixels came off that screen.

## Motion

`ScrollLab` (native, focused) and `motion/ours.mjs` (Spotify on its debug port, focused) scroll the same 2x page under
the glass in the same steps (`compare/scroll-side-by-side.mp4`; frames in `local/`, not in git). Per-frame error 4.3;
change of the rim band between frames: native 5.8, ours 6.4. Frame times while scrolling Spotify are unchanged by the
device-resolution maps (p95 ~18ms with and without the glass).

## Scrolling Apple Music itself (ground truth in motion)

- Synthetic scrolling works when it looks like a trackpad: `swipe.swift` warps the cursor over Music's content and
  posts `CGEvent` scroll events through the HID tap with `scrollWheelEventIsContinuous = 1` and scroll phases
  (began 1, changed 2, ended 4). Plain wheel events posted to Music's pid (no phase, cursor elsewhere) were ignored
  going down. Music is activated first and re-activated if it loses focus; frames are window captures.
- 50 steps of -160px over 50 events moved the content exactly 6px (3pt) per step (alignment error ~0.1).
- Scrolling down moves the content up, so what passes behind the player is visible above it a few frames later. That
  gives the barless content (`music-scroll/content.png`) for the first ~30 frames; `music-scroll/ref/00NN.png` are
  Music's frames (2x, 1562 wide, player at x 40pt, top 40.5pt, 701x54pt in this crop).
- `motion/ours-music.mjs` scrolls the same content under our glass in Spotify in the same steps (focused).
- **Colour:** the stitched PNG must carry the display's profile (`sips -e display.icc`, extracted from a capture with
  `sips -x`); untagged, Spotify treats it as sRGB and converts it to P3, which made everything look paler.
- Results (shipped glass 644fe5e, aligned, glyph-free stretches only): outside the bar 0.0, middle of the bar 5.0,
  bottom 5pt band 4.7, top 5pt band 13.2 (`compare/music-vs-ours-scroll.mp4`, `compare/music-vs-ours-top-edge.png`).
  The top-band gap: where the rim mirrors bright content from inside, ours is brighter (mirror band ~142 vs Music
  ~121, edge pixel 182 vs 141); on dark content the two match row for row.
- Fitting directly to these Music frames (`fit.mjs`, patterns `mf00..mf30`, `barTop` 40.5, `barH` 54, Music's icons
  masked): 6.5 -> 5.45, preferring a weaker top highlight on bright content, a slightly shallower mirror
  (`[13,15.6,14.1,14.7,14.25,10.9,8.5,3,0.75,0]`) and a wider darken blur (19px). The highlight table it found is
  noisy (negative entries): it needs a constrained shape (e.g. a*exp(-d/b)) before shipping. `params/fit-music.log`.

### Fitting to lab patterns and Music's frames together

Each change from the Music-frame fit was tried alone on both sets (lab: 18 patterns; music: 11 Music frames):
the exponential highlight shape hurt the lab set (2.89 -> 4.11; the table's sharper falloff is right), while a wider
darken blur (13.5px), gain 1.05 and a softer mirror peak (16.1 instead of 18.1px at 1px from the edge) each helped
both. Combined and shipped: lab 2.83 (was 2.89), Music frames 5.97 (was 6.52). The remaining Music gap sits in the
top band over bright content; frames there may also carry Music's hover and title-strip effects.

## The rim mapping, measured directly (why the edge "sticks")

`research/probe-top-native.json`: one 1px white line on black, moved from -4pt to +26pt from the top edge in 0.5pt
steps (61 captures, `Lab3` SwiftUI glass at Music's geometry, focused); for each display row of the glass, the source
row it shows (response-weighted). Display distance from the top edge -> source distance:

| display (pt) | 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 12.5+ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| source (pt) | 21.2 | 18.3 | 16.7 | 15.2 | 14.1 | 12.4 | 11.3 | 10.6 | 10.2 | 10.1 | 10.1 | 10.4 | 10.8 | 11.4 | 12.1 | = display |

- The outer ~7pt mirror content from 21pt down to 10pt in (a fold), the band from ~4pt to ~11pt magnifies a sliver
  around 10pt in (it shows nearly the same row for ~7pt of height), and the glass is flat from ~12.5pt. The first ~9pt
  of content behind the rim never show. As content scrolls, the magnified band holds the same row for a while: that
  is the edge "sticking" the user sees in Apple Music.
- Used as the SVG displacement profile directly (`params/measured-lens.json`), it scores about the same as the fitted
  profile on Music's frames (top band 2-7pt: 7.57 vs 7.53) and worse on fine patterns (checker 7.0 -> 12.0), so it is
  not shipped yet. Both fitted and measured profiles already produce the plateau.

### Remaining gap at the outermost 2pt

- Comparing at 40.5pt was misleading: Chromium snaps the backdrop region to whole CSS pixels, so the harness bar
  started one device pixel lower than Music's. Music frames shifted by one row (`fit/*/mg*.png`, bar at 40pt) fix it:
  the outermost 2pt error drops from 28.7 to 12.6.
- Over dark content our edge matches Music row for row (133, 116, 100 vs 140, 115, 102); over bright content our
  highlight is stronger (184, 176, 169 vs 200, 187, 176). Lowering the highlight target from 2.23x to 1.73-1.9x white
  (what the lab's uniform fields gave) helps Music's frames slightly (4.77 -> 4.68) and the lab slightly less (2.83 ->
  2.90); the outermost-2pt error stays ~12, so most of it is the first one or two device rows themselves.

### Shipped: highlight refit (mcloud 2026-10-26)

Joint fit on aligned Music frames (`mg*`) and the lab set; only changes that improve both sets were kept. The free fit
made the highlight table zig-zag and cost the lab a little, so smooth neighbours were scored instead. Chosen
(`params/cand-9041.json`): highlight toward 2.0x white (was 2.23x), table `[.13,.085,.032,.019,.014,.011,.009,.007,
.005,.004,.003,.002,.001,.0005,0]`: Music frames 4.77 -> 4.68, lab 2.827 -> 2.823. In Spotify over a bright card the
top edge reads 193, 179, 172 vs Music's 184, 176, 169 (was 200, 187, 176); over dark 137, 116, 102 vs 133, 116, 100.
Lab scores move by +-0.03 between near-identical settings (sampling noise), so differences below that mean little.

The player is snapped to whole pixels in the theme (CSS `round()` on its left edge, width rounded to even) so the
rim and highlight do not fall on half pixels on 1x screens.

### Rim aliasing at the round ends (open)

Over text, the round ends of our glass look pixelated where Music's are smooth. Chromium's feDisplacementMap samples
the page without filtering; the outer ~3 device px compress ~21pt of page into ~2pt, so it aliases. Apple filters.

Tried (all scored with fit.mjs on the lab set, Music frames mg00..mg30 and the text scene mgcaptext; frame times in
live Spotify with `rim-aa/ab2.mjs`, 3s sinusoidal scroll, frames >20ms counted):

| Variant | lab | Music+text | drops / 3s |
| --- | --- | --- | --- |
| shipped (pre-blur 0.4) | 2.823 | 4.630 | ~1 |
| + rim AA pass (2nd displacement of 1px-blurred copy, mask = outer 3px) | 2.804 | 4.629 | 3-10, p95 up to 33ms |
| rim post-blur 0.6 instead | worse | worse | 2-6 |
| AA in primitive subregions (caps only) | - | - | ~75 |
| global pre-blur 0.6 / 0.8 | 3.804 / 5.021 | 4.625 / 4.727 | - |

The AA pass looks smoother but still not Apple's thin continuous arc, and costs frames, so it is not shipped.
`rim-aa/rim-aa.patch` is the mcloud change (mask packed into the x map's blue channel; red takes no blue in P3
conversion). Next: find where the drops come from (extra composites vs. the second displacement) or a cheaper AA.

## medfa12/liquid-glass-react checked against our measurements (2026-10-27)

[medfa12/liquid-glass-react](https://github.com/medfa12/liquid-glass-react) (commit a7d3c5e) is a WebGL2 port of
macOS 26/27's QuartzCore glass shader, from disassembly plus fitting. Read against our native data; scripts and logs
in `arc-lens/`. Not shipped in mcloud yet (the user wants the research settled first).

**Their lens curve is Apple's; their numbers are not Music's.** The shader displaces by
`A*(1 - sqrt((2-t)*t))`, `t = d/H` (a circle arc, strongest at the rim, zero from `H` in). Fitted to our top-edge
probe (`probe-top-native.json`, display distance -> source distance) with only `A` and `H`: **rms 0.20pt, max
0.49pt** (`arc-lens/lensfit.py`, A 26.3, H 13.3). A free 4-parameter arc `1-(1-(1-t)^p)^(1/q)` lands on p 1.9, q 1.8,
i.e. the circle again. The fold, the plateau around 10pt and the "first ~9pt never show" all fall out of this one
curve: source = d + A(1-arc) has its minimum at ~7pt. Their default lobes (inner +4, outer -13 at a 75px reference
size) give 3-5pt at Music's size and miss the mapping entirely.

**The arc scales with the radius.** Fitting only `A`, `H` in `fit.mjs` (`arcA`/`arcH`, coordinate descent):

| set | bar | A | H | A/r | H/r |
| --- | --- | --- | --- | --- | --- |
| lab patterns | 55pt | 27.76 | 13.65 | 1.01 | 0.50 |
| Music frames `mg*` | 54pt | 27.26 | 13.27 | 1.01 | 0.49 |

Two independent sets, two sizes, same ratios. So the profile is **A = r, H = r/2** (`arcKA` 1.01, `arcKH` 0.495).
Against the shipped 10-knot fitted table (`cand-9041`), on all 27 patterns:

| | total | lab mean | Music mean | checker | grid | caps, outer 3pt |
| --- | --- | --- | --- | --- | --- | --- |
| shipped table | 3.926 | 2.403 | 4.679 | 6.93 | 3.33 | 12.49 |
| arc, A = r, H = r/2 | **3.806** | **2.292** | **4.622** | **5.63** | **2.99** | **11.31** |

Two constants beat the fitted table on both sets. The round ends look closer by eye too
(`compare/arc-vs-shipped-left-end.png`): over vertical stripes Apple mirrors the stripe into a thin, even D-shaped
ring; the shipped table makes it thick and ragged at the corners, the arc reproduces the thin ring. What remains is
the staircase on curved edges, where Apple's ring is smooth: that is filtering, not shape (below). The prediction
A = r, H = r/2 for other heights (the toast) is untested natively; a Lab3 capsule at 36pt and 80pt would settle it.
Same filter structure, so frame cost should be unchanged (not yet measured in Spotify).

The round end's outermost ~1pt is the one place the arc does not fit: `probe-left-native.json` gives 16.6pt at the
rim where the top edge gives 21.2 (from 1.5pt in, left and top agree to ~0.1pt). Open.

**Apple filters the compressed rim.** A 1pt line 15pt in (`h15`) lands where the arc compresses source ~2.8x. A
point-sampled render puts it in one device row at full strength; the native capture spreads it over three rows
(28, 40, 12 over the black level) with about the light a 1pt line has on the face divided by the compression
(`arc-lens/rimfilter.py`). That is area sampling plus ~1 device px of softening (their renderer samples a mip chain
with `LINEAR_MIPMAP_LINEAR`); `feDisplacementMap` samples the nearest pixel, which is the left-end pixelation. With
the arc the compression is analytic (`ds/dd = 1 - (A/H)(1-t)/sqrt(t(2-t))`), so an AA pass can be sized from it
instead of a fixed 3px mask. Averaging several displacement taps across the pixel footprint in SVG did **not** work:
on a pixel-aligned page each tap rounds to a neighbouring pixel and blurs the whole face (face error 2.1 -> 4.8).

**Parts of their model that Music's player does not have** (focused, regular, Liquid Glass slider at 0; `fit/apple`):

- No chromatic aberration: |R-B| at most 2 over stripes and checker inside the bar (their default `aberrationAmount` 3).
- ~~No dark edge line~~ **Wrong, corrected the same day:** over black the outermost pixel brightens 31 -> 85, but a
  multiplicative dark line cannot show over black. Over bright content Music's glass does have one (see "Apple Music
  scrolled 1pt per frame" below), as their macOS 27 `edgeLineOpacity` 0.74 says.
- No light from outside: lines outside the bar never appear in it; their inner lobe (+4) samples outward at the rim.
- Symmetric light: over black, top and bottom edges read 85, 62, 43, 40 alike, the caps' middles get none, top-left
  and top-right match. That fits a pair of opposed lobes along y (their macOS 27 key-fill structure) with no tilt,
  not their `keyFillDir` (0.35, -0.94). Our `|n_y|^3.5` model stands.

**Their blur and colour numbers describe a background window.** Their regular glass measures an edge-transition sigma
of 13.9px (`glass.ts`), blur radius 28-45, and nothing in the repo makes a test window key. Our unfocused glass is
sigma ~6pt (~12px at 2x); the focused glass Music shows is nearly clear (pre-blur 0.4px). Their face matrix lifts
black to 0.128 (33/255, ours 32) but takes white to 0.307 (78, ours 185). Use their structure, not their constants.

**In motion the arc tracks the native glass better.** The 60 native scroll frames (`local/motion/native`, ScrollLab's
`NSGlassView`, 55pt; offsets recovered from the page above the bar: exactly 8 device px per frame) rendered with
`fit.mjs` (`FITDIR` with `bg/` = crops of `local/motion/content.png`), `arc-lens/temporal.py`:

| band | error shipped | error arc | change per frame native / shipped / arc | change error shipped | change error arc |
| --- | --- | --- | --- | --- | --- |
| rim 0-2pt | 8.92 | 8.53 | 5.91 / 6.21 / 6.21 | 6.41 | **4.54** |
| rim 2-7pt | 4.21 | 4.14 | 5.60 / 6.28 / 6.28 | 2.79 | 2.69 |
| rim 7-14pt | 3.56 | 3.44 | 5.54 / 6.07 / 6.05 | 2.57 | 2.27 |
| face | 2.52 | 2.53 | 5.74 / 5.95 / 5.96 | 1.78 | 1.79 |
| caps 0-3pt | 13.31 | 11.83 | 10.43 / 12.78 / 12.93 | 9.71 | **7.51** |

(change = mean |frame i+1 - frame i| in the band; change error = mean |our change - native change|.) Over all 60
frames: 3.584 -> 3.493. The arc follows how the native rim changes from frame to frame clearly better (outer 2pt
-29%, caps -23%), but both profiles change *more* per frame at the rim than native (caps 12.8 vs 10.4): that excess is
the point-sampling flicker, and the profile shape does not remove it. It is the filtering gap again.

**Sub-pixel sweep, native.** `arc-lens/sweepgen.py` makes a 1pt line at 8-24pt from the top edge (`mgs*`) and from
the left end (`mgv*`) every 0.125pt (a quarter device pixel); `arc-lens/native.sh` captures Lab3 (`BAR_Y=40`, so
Chromium's bar sits on the same whole pixels; 258 captures, all key) and `arc-lens/subpx.py` measures the line's image
in the mirror band (display 0-7pt) and the flat band against the line position. (Native capture fails while the
screen is locked: no window can become key, `lsappinfo front` shows `loginwindow`.)

| | mirror: centroid jitter | light flicker | peak | difference to native, outer 14pt |
| --- | --- | --- | --- | --- |
| native, top edge | 0.027pt | 2.2% | 51 | - |
| shipped, top edge | 0.034pt | 4.2% | 87 | 4.92 |
| arc, top edge | 0.022pt | 4.1% | 88 | **3.93** |
| native, left end | 0.027pt | 2.1% | 51 | - |
| shipped, left end | 0.036pt | 3.8% | 88 | 4.84 |
| arc, left end | 0.023pt | 3.6% | 87 | **3.59** |

- **The round end follows the same arc.** Response-weighted source per display row/column, native: 22.1, 18.9, 16.9,
  15.4, 14.3, 13.4, 12.7, 12.1, 11.6pt at 0, 0.5 ... 4pt from the edge, identical at the top edge and at the left end;
  the arc gives the same within ~0.3pt at both. The earlier left-end probe (16.6pt at the rim) was taken with the bar
  at 40.5pt, half a point off the pixel grid; it does not describe the glass.
- **Position is right, light is not.** Native's mirrored line dims toward the rim (peak per row 23, 39, 46, then ~65)
  and its total light in the mirror band falls smoothly as the line moves out (166, 267, 182, 121, 92, 74, 63, 39 ...
  per 1pt). Ours stays ~90 per row and the total jumps (278, 430, 286, 183, 187, 84, 136, 95, 4, 88, 38, 2, 86):
  point sampling hits the compressed line or misses it. Apple averages over each pixel's footprint. This is the
  left-end pixelation, the excess flicker in motion, and the old "mirror band too bright over bright content".
- Thin lines on the face are also dimmer and wider natively (peak 50 vs our 66 above the dark level, width 0.61pt vs
  0.52pt): a separate, smaller tone/softness gap.

**Apple Music scrolled 1pt per frame.** `swipe -150 150` on Music's Home (window 980x600pt, player 701x54pt at
column 479, row 1054 in device px: its left end sits on a half point). Music scrolls in exact whole device pixels
(2px per step, alignment error 0.02), so content behind the real player never sits on a sub-pixel. The page behind
the player is rebuilt from what scrolls out above it (`music/` in the scratch run; 84 frames have it complete), cropped
so the bar sits at 40pt, and rendered with `fit.mjs` (frames `mgm*`: masked to clean columns 860-1240 and the outer
ring of both round ends; one tile has animated artwork and the icons sit elsewhere). Music's glass also casts a faint
shadow, ~2 levels, just below the bar. `arc-lens/musicmotion.py`:

| band | error shipped | error arc | change per frame Music / shipped / arc | change error shipped | change error arc |
| --- | --- | --- | --- | --- | --- |
| rim 0-2pt | 16.12 | 14.16 | 3.61 / 4.68 / 4.67 | 4.61 | **3.02** |
| rim 2-7pt | 8.00 | 7.59 | 4.02 / 4.70 / 4.69 | 2.82 | 2.45 |
| rim 7-14pt | 6.22 | 5.95 | 3.99 / 4.51 / 4.52 | 2.59 | 2.20 |
| face | 4.62 | 4.62 | 4.05 / 4.32 / 4.32 | 1.72 | 1.73 |
| caps 0-3pt | 25.31 | 25.38 | 1.93 / 3.19 / 3.10 | 3.65 | 3.70 |

The same picture as the lab: the arc follows Music's rim in motion better (-35% at the outer 2pt), and both of ours
change more per frame than Music at the rim (+30%) and at the round ends (+65%).

**Music's glass has a dark edge line.** Over flat bright content (frame 10-60, page luma 105 behind the round end) the
outermost device pixel at the middle of Music's round end reads **60**, the next 94, then the face 107-116; ours reads
a flat 119. By angle around the left end (outermost pixel minus the page, median over frames): -34 at the middle,
-27 at +-22 deg, -16 at +-37 deg, ~0 from +-52 deg toward the top and bottom, where the highlight takes over;
relative to the face just inside, the outermost pixel is 25-36 darker all the way round. Ours is +13 to +46 there.
Over black (most lab patterns) a multiplicative line cannot show, which is why the first fits never needed it; it
also matches the old gap where our top edge read too bright over bright content (193 vs 184). This is medfa12's
macOS 27 edge line (`edgeLineOpacity` 0.74, ~1px). The native checker and scene2 crops
(`compare/arc-vs-shipped-left-end.png`) show the same dark arc on the left end.

Fitted in `fit.mjs` (`line`, `lineW`, `linePow`: the glass is multiplied by `1 - line*(1-smoothstep(0, lineW, d))*|n_x|^linePow`
after the highlight, as a `feBlend mode="multiply"` with a baked map; an `feComposite arithmetic` with k1 = -0.4 came
out wrong across the whole bar in Chromium) on the lab patterns, the earlier Music frames and every 6th `mgm` frame:
**line 0.70**, width 1.35pt, |n_x|^2 (`arc-lens/arcline.json`). The strength agrees with medfa12's decoded 0.74. A
uniform line (no angle weight) made the fit worse: the top/bottom highlight table was fitted without a line and
already absorbs it there; a joint refit of line and highlight could make the line uniform, as Apple's probably is.

| | lab mean | Music frames `mg*` | Music run `mgm*` (every 6th) | caps 0-3pt, all 84 `mgm` | other bands |
| --- | --- | --- | --- | --- | --- |
| arc | 2.292 | 4.622 | 6.347 | 25.38 | - |
| arc + edge line | 2.308 | 4.622 | **6.130** | **18.88** | unchanged |

`compare/music-ends-arc-edge-line.png`: Music, shipped, arc, arc + line at both round ends (frame 30). The left end's
dark crescent now reads like Music's; at the right end, over illustrated artwork, ours still shows stair-stepped
mirrored shapes where Music's are smooth: the filtering gap.

**Refit (the user found the line too dark, and it was).** At the left end's middle over flat red, Music's outermost
pixel is -34 against the page and the second -10; the 0.70/1.35pt line gave -51 and -22: too dark and too wide (the
joint fit widened it to cover our round end's face being ~10 levels too bright, a tone gap the line should not
absorb). Scored instead on the line alone, the outermost two pixels relative to the third, +-60 deg around the left
end, every 6th `mgm` frame (`arc-lens/linescore.py`): Music -13, -28, -34, -36, -36, -33, -28, -10. Best: **line 0.4,
width 1pt, |n_x|^1** -> -13, -24, -32, -37, -37, -32, -24, -14 (error 3.01; |n_x|^2 at 0.5/1pt: 3.85; 0.7/1.35pt
|n_x|^2: far off). `arc-lens/arcline.json` now holds 0.4 / 1.0 / 1.

**Supersampling by scale does not work in Chromium.** A 2x element shrunk with `transform: scale(.5)` carrying the
same displacement (`arc-lens/supersample-test.mjs`) renders byte-identical to the 1x element: the backdrop filter runs
at screen resolution regardless of the element's transform, so there is no free 4-sample anti-aliasing. The output
also shows the point sampling plainly: a 1pt line compressed at the rim comes out as two rows of full white.

**Where this leaves the player (2026-10-27).** Ship-ready by measurement: the arc lens (A = r, H = r/2) and the edge
line (0.4, 1pt, |n_x|, after the refit below); both are map changes plus one multiply blend, no extra displacement. Still open, and now
the largest gap: area sampling of the compressed rim (light per row and flicker, above). Smaller: thin lines on the
face, the faint shadow under the bar, a uniform line with a refitted highlight. Frame times in Spotify not yet
measured for the arc + line filter.

**Worth knowing, not tested yet:** the adaptive content colour (`luminanceColorMap.png`, logistic centred at 0.5,
k 10.25, 0.349-0.800; Rec.709 luma) is for glyphs on glass, not the panel; Music's player glyphs over bright artwork
could be checked against it. Their capsule SDF is a superellipse (exponent 6.5) fitted to a rounded rect; our
player is a capsule and the round-end probe matches plain capsule distance from 1.5pt in.

## Rim anti-aliasing, measured and made cheap (2026-10-28)

Tools: `fit.mjs` options `mip`, `taps`, `post` (+ `postC`, `postMag`, `postAniso`), `dither`, `bleed` (+ `bleedW`,
`bleedDk`); `arc-lens/runsweep2.sh <variant...>` renders the native sub-pixel sweep for variants and scores them with
`subpx.py`; `arc-lens/blurprof.py` measures the line's width and light against display position;
`rim-aa/ab3.mjs`, `rim-aa/ab4.mjs` time variants in the live client. Ideas also from a review by Claude Fable (map
dithering, collapsing the map build, anisotropic blur, no bilinear knob in Skia's displacement).

**What Apple's rim does, from the native sweep.** The mirrored line is *not* wider than ours anywhere (0.54 vs 0.56px
at 2pt, 1.47 vs 1.29px at 4pt, ...), so Apple does not blur the squeezed rim. Two things differ: (1) light: Apple's
mirrored line carries ~60% of ours across the band (face ~75%), flat colour matches; (2) smoothness: most of the
mirrored light sits in the plateau 4-11pt in, where the arc **magnifies** the page up to ~7x, and Chromium magnifies
nearest-neighbour: each page pixel becomes a block of identical rows that jumps as content moves. That is the
"pixel-based vs vector" look the user describes, more than the squeezed outer pixels.

| variant (top edge / left end) | mirror flicker | line width | peak | diff to native |
| --- | --- | --- | --- | --- |
| Apple | 2.2% / 2.1% | 0.50 / 0.51pt | 51 | - |
| arc + line | 4.1% / 3.6% | 0.43pt | 88 | 3.93 / 3.47 |
| taps x2 / x4 (spread by squeeze) | 4.0 / 3.4%, 3.8 / 3.3% | 0.43pt | 86 | ~same |
| fake mipmaps (source blur by squeeze) | 3.2% / 2.7% | 0.60pt | 73 | 4.06 / 3.74 |
| blur after the bend, where it squeezes | 3.4% / 2.6% | 0.66pt | 69 | worse |
| blue-noise map dither | 4.1% / 3.6% | 0.44pt | 85 | 3.76 / 3.41 |
| blur after the bend where it squeezes *or magnifies* | 2.2% / 1.6% | 0.71pt | 67 | 4.48 / 3.90 |
| **vertical blur 1px where it magnifies** (`post` 1, `postC` 2, `postMag` 2, `postAniso`) | 2.8% / 2.5% | 0.51pt | 87 | 4.00 / 3.49 |
| + darken result mixed in near the rim (`bleed` .6, `bleedW` 12, `bleedDk`) | 2.7% / 3.1% | 0.51 / 0.45pt | 81 | **3.68 / 3.16** |
| + blur along the normal (`postAniso` 2: vertical by n_y^2, sideways by n_x^2) | **2.7% / 2.5%** | **0.51 / 0.50pt** | 81 | **3.68 / 3.12** |

The last row is `arc-lens/candidate.json`: arc lens, edge line 0.4/1pt/|n_x|, a 1px blur along the edge normal mixed
in where the bend magnifies (weight (1/c - 1)/2), and the darken result (min of the page and its wide blur) mixed in
near the rim (0.6 at the edge, smoothstep to 0 at 12pt). Isotropic blurs lost on the grid and checker (they smear
across the edge); the directional one wins there. Edge bleed toward the wide blur itself (medfa12's) dimmed little and
widened the line; mixing toward the darken result dims thin bright detail and leaves width and flat colour alone.

| | lab mean | Music frames `mg*` | Music run, rim 0-2 / 2-7 / 7-14pt / caps (error) | change error 2-7 / 7-14pt |
| --- | --- | --- | --- | --- |
| arc + line | 2.293 | 4.622 | 14.16 / 7.59 / 5.95 / 20.63 | 2.45 / 2.20 |
| candidate (vertical blur) | 2.151 | 4.551 | 13.58 / 7.14 / 5.78 / 20.17 | 2.29 / 2.01 |
| candidate (along the normal) | **2.145** | **4.551** | - | - |

`compare/music-candidate-rim-aa.png`: Music, shipped, arc + line, candidate (vertical) at both ends and the top edge of
one Music frame; the mirrored content at the top edge loses its stair-steps. Still open: thin bright lines are
brighter than Apple's everywhere (peak 81 vs 51 in the rim, 66 vs 50 on the face): the darken/tone fit, not the rim.

**Why every AA pass was expensive: an SVG filter recomputes shared results.** In Spotify's Chromium a primitive result
read by k later primitives is computed k times: k steps that each average the previous result with itself cost
51-84ms (k = 2), ~230ms (4) and ~1.5s (6) per frame (`ab3.mjs`, `fan2..6`). The shipped `#am-glass` already pays for
it: the darken step reads the bent page three times and the tone reads "glass" twice, so the bend runs ~6 times a
frame. Each AA part alone was cheap (vertical blur 2 slow frames per 3 runs, darkening 0), but together inside the one
filter they multiplied: 399 slow frames in 5 runs, ~30 fps. One extra fake-mip level alone: 6 (cheap).

**The fix: split the glass into stacked layers.** Two plain capsules under the player (z-index 59, body-level
siblings, no backdrop root between them and the page): layer 1's `backdrop-filter` only bends; layer 2's does the
rest (darken, tone, highlight, AA) reading layer 1's result as its backdrop, a texture that is cheap to read many
times. Same picture (`ab4.mjs SHOT=dir`, mean difference 0.3-0.8 against the single filter, live content moving).
Frames > 20ms per 3s scroll, 4 runs (`ab4.mjs`, 2x Mac):

| | slow frames | p95 |
| --- | --- | --- |
| shipped single filter | 2 (36 with a warm-up run) | 16.8-18ms |
| split, same picture | **0** | 16.8ms |
| split + AA (vertical) | 1 | 16.8ms |
| split + AA (along the normal) | 4 | 16.8ms |
| AA in the single filter | 249 | 33.4ms |

So the layered glass is slightly cheaper than today and carries the AA for free. Not checked: Windows / 1x, the toast
(same structure), `prefers-reduced-transparency`, and whether hover/press states on the player need the layers to
follow it (they are separate elements). Skia's displacement samples nearest with no knob, and a 2x element shrunk with
`transform` filters at screen resolution (both above), so this is the practical path.

## Round-end edge stair-steps (2026-10-28, after shipping the two-layer glass)

The user saw slight aliasing on the outermost pixels of the right end. Measured:

- **Not the silhouette.** Over a flat white page, the boundary pixels of both ends take in-between values (the rounded
  clip of `backdrop-filter` is antialiased, headless and in the live client alike), and left and right give identical
  histograms: nothing is right-side specific in the geometry.
- **The outermost ring's content.** At the round ends the bend points at the end's centre, so along the curve the
  page is magnified by (r - d) / (r - d - shift): ~100x at the edge, ~3x at 1pt, ~1.2x at 7pt; the straight edges
  are 1:1 along the edge. The outer ring (~170 device px around) shows a circle only a few page pixels around, and
  nearest-neighbour sampling turns that into long runs with hard steps that follow the curve. It shows over detailed
  artwork (in the user's view, the right end).
- **Blurring along the curve barely helps** (`fit.mjs` `tanDiv`, `tanBlur`; caps error, outer 0-3pt / 3-7pt):

| | lab caps | Music caps | lab / Music overall |
| --- | --- | --- | --- |
| shipped candidate | 15.28 / 6.83 | 17.85 / 10.03 | 2.145 / 6.034 |
| + along the curve, existing 1px blurs, /2 | 15.93 / 6.95 | 17.62 / 9.94 | 2.147 / 6.026 |
| + along the curve, /4 | 14.82 / 6.87 | 17.69 / 9.98 | 2.142 / 6.030 |
| + own 2px blurs, /2 | 17.17 / 7.46 | 17.57 / 9.84 | 2.157 / 6.021 |
| + own 3px blurs, /3 | 16.14 / 7.39 | 17.52 / 9.84 | 2.153 / 6.019 |

  At most -2% on Music's ends, mixed on the lab: not shipped. A blur after the bend can only smear the few page
  pixels the nearest-neighbour lookup already picked; Apple filters while sampling (bilinear, mip levels), so its ring
  is a smooth gradient of the right pixels. Closing this needs filtered sampling in the displacement itself, which
  Chromium's `feDisplacementMap` does not offer.

## Exact bilinear sampling, thin-line darkening, shadow (2026-10-28, shipped on the research branch)

Ideas and review: Claude Fable. `fit.mjs` options `bilin`, `nmin` (+ `nminBlur`), `rimMip` (+ `rimMipC`), `layers` (the
harness now splits the filter like the theme; without it, steps that read a result twice made single-filter renders
time out).

- **Bilinear from 4 fixed taps.** The bend layer reads the composited backdrop, which is device pixels, and the
  geometry is fixed, so for each pixel the 4 page pixels around its source point and their weights are static: 4
  `feDisplacementMap`s, each with its own map aimed at one pixel centre (Chromium takes the nearest pixel to the
  displaced point; 8-bit step 0.45 device px, error <= 0.23), blended with two static weight masks (`in`/`over`).
  The face is pixel-identical (weights 0). It replaces the post-bend blur: native sweep flicker 2.1% / 1.9% (Apple
  2.2% / 2.1%, before 2.7% / 2.5%), line width 0.50 / 0.46pt (Apple 0.50 / 0.51), lab 2.145 -> 2.088, Music run
  6.034 -> 5.979, round ends 3-7pt lab 6.83 -> 5.99. Needs the bar on whole device pixels: used at integer screen
  scales; at 125%/150% the theme keeps one tap and the post-bend blur.
- **Thin-line darkening** (min with a 1px blur, 30%, second layer): mirror peak 79 -> 71, face 66 -> 58 (Apple 51/50),
  sweep difference 3.56 -> 3.03 / 3.10 -> 2.55, round ends on Music 17.24 -> 16.75, Music run 5.973 -> 5.921, lab
  equal (2.092 -> 2.079). Stronger (50%) gets closer on lines but costs the lab (2.236).
- **Rim mip** (a blurred copy displaced once, mixed in where the squeeze > 2.5): no gain anywhere; not shipped.
- **Shadow:** Music's bar darkens the page under it by ~1.1% for 4pt, 0.4% by 8pt, nothing above or beside it.
  `box-shadow: 0 4px 8px #00000005` matches it.

Live client (2x Mac): 0 slow frames in 5 scroll runs, p95 16.8ms. Over the page behind Music's player (frames 10/30/60),
difference to Music, main -> previous commit -> now: face 6.65/7.60/6.89 -> 6.01/6.89/6.25 -> 5.95/6.69/6.05, top rim
9.47/13.26/9.93 -> 8.72/11.59/7.84 -> 8.61/11.13/7.44, left end 6.86/5.75/6.68 -> 5.10/4.84/5.79 -> 4.92/4.71/5.72,
right end 15.82/11.79/12.14 -> 13.64/9.79/10.31 -> 13.41/9.57/10.43, under the bar 1.26/1.29/0.58 -> 0.31 or less
(`compare/glass-music-old-bilinear*.png`). Visible remaining gap: the round ends' outline over bright content, where
Music's dark rim makes the transition gradual and ours steps from bright glass to the dark page.

## Round-end outline (2026-10-28)

The visible gap after bilinear sampling: over bright content, our round ends stepped from bright glass to the dark page.

- **First fit, on Music's frames only (withdrawn):** Music's ends looked like a near-black outermost pixel plus ~7%
  darkening fading over ~20px, and a map with both (`1 - (0.85*exp(-d/0.4px) + 0.08*(1 - smoothstep(0, 20px, d)))*|n_x|`)
  matched Music's frames (left end 6.31 -> 4.97, right 20.59 -> 17.94).
- **Checked on macOS's own glass** (Lab3, `BAR_Y=40`; over Music's page it equals Music's frame pixel for pixel, one
  pixel to the left) on flat pages from black to white, flat colours and a Liked-style tile at 8-40pt into the left
  end: the glass inside the end is **not** darkened (-1..-4 at most) and the dark pixel lies **just outside** the
  shape: the page at ~0.47 (105 -> 49, 240 -> 113, 70 -> 28; 18 -> 6), fading along the curve faster than |n_x|
  (sum of the ring's deficit at ~23 deg: ~0.78 of the end's, so ~|n_x|^3), none at the top and bottom. The gradual
  darkening in Music's frame comes from its blur reaching the dark strip beside the bar; a backdrop-filter only sees
  what is under its box. The first fit darkened flat bright content (white: 179 -> 141 at the end) and was dropped.
- **The refracted tile edge** (the user's question: is the Liked tile's edge straight in our glass but rounder in
  Apple's?): both are straight in the flat middle and bend in at the top and bottom only; traced row by row the edge
  sits within 0.1-1.5px of Apple's, with the same ~1px sharpness.
- **Shipped: a hairline outside the glass in CSS** (`.am-glass-rim`): a 1-device-pixel border at 55% black just
  outside the glass box, masked by a horizontal gradient to (1 - x/R)^3 (stops at quarters of the radius). Being a
  border, it is antialiased along the curve; an in-glass line weighted per pixel centre showed stair-steps. Difference
  to Apple at the left end, all pixels / outer ring (device px -2..3):

| candidate | flat pages | tiles | Music's page |
| --- | --- | --- | --- |
| in-glass line, 1 device px, 0.9 | 6.10 / 11.36 | 6.15 / 24.74 | 5.02 / 12.24 |
| in-glass line, box-filtered 1px, 0.55 | 6.10 / 11.37 | 6.17 / 24.95 | 4.76 / 9.65 |
| CSS hairline 0.45, \|n_x\| | 5.96 / 9.21 | 4.41 / 15.22 | 4.63 / 10.32 |
| CSS hairline 0.55, \|n_x\| | 6.01 / 9.66 | 4.49 / 16.06 | 4.65 / 10.66 |
| CSS hairline 0.5, \|n_x\|^2 | 5.92 / 8.80 | 4.33 / 14.53 | 4.61 / 9.98 |
| **CSS hairline 0.55, \|n_x\|^3 (shipped)** | **5.91 / 8.77** | **4.32 / 14.42** | **4.59 / 9.91** |

  Centre row, Apple / ours: grey 105: 49, 117 / 47, 118; white: 113, 179 / 108, 179; black 18: 6, 48 / 8, 46.
  Scroll timing (5 runs, A/B with the hairline hidden): equal.
- **Page mix (the light halo on the left end over a white tile):** at the outermost pixels Apple's glass shows the
  page right under them, blended with the bent page. Fitted as w = (Apple - ours) / (flat response(page) - ours) on
  the tile pages: 0.45-0.58 at the edge pixel, 0.18-0.23 one in, ~0 two in, the same on white and the Liked tile.
  Shipped in the bend layer as w = 0.65*(1 - d/2.2 device px): taps 0 and 2 read the pixel itself, taps 1 and 3 the
  nearest bent pixel, `fx` = 1 - w (no extra primitive). Everywhere vs ends only (|n_x|^2): tiles 3.71 vs 3.89, outer
  ring 8.78 vs 10.41, Music's page top rim 6.40 vs 6.68, flat pages unchanged; 0.8 and a 3px fade score the same or worse.
- Left over: Music's blur of the page beside the bar (needs the glass to see outside its box).
- **Side-by-side viewer** (`side-by-side/`): `SideBySide snap` copies the open Spotify page a screen at a time
  (player, sidebar and toolbar hidden, sticky headers unstuck); the viewer shows it under SwiftUI's `.glassEffect`
  (left) and under the theme in Chrome (`dev/preview.html`, right), scrolled together over Chrome's DevTools protocol;
  the native window keeps focus so its glass stays in the focused look. `install.sh` does all of it.

## Toolbar glass buttons: Back, Share, More (2026-10-29)

How Music's toolbar buttons behave under the pointer (hover, press, hold, drag, release) and a Chromium copy of them
(`buttons/`). Measured on a playlist page, Music focused, Liquid Glass slider at 0.

**What they are.** Accessibility puts Back (`Go Back`), Share and More in Music's `AXToolbar`: they are ordinary
`NSToolbar` button items, not Music's own views. On macOS 26+ AppKit draws such buttons with SwiftUI; `heap` on the
running Music lists `DesignLibrary.MacToolbarButton<… AppKit.ButtonContent …>` (8), `DesignLibrary.MacToolbarPopUpButton`
(4, More), `DesignLibrary.MacGlassButton<AppKit.ButtonContent, AppKit.AppKitButton.OptionallyTintedModifier>`,
`DesignLibrary.MacButtonGlassForegroundStyle`, glass from `NSGlassEffectContainerView` (`GlassGroup`, `GlassViewState`:
adjacent items share one glass, which is why Share and More are one capsule) with `NSGlassEffectView`s, and the
interaction pieces `AppKit.GlassInteractionFill` (8), `SwiftUI.FlexInteractionGestureStateWriteModifier` (4),
`SwiftUI.OnGlassInteractionStateChangeWriteModifier` (4), `SwiftUI._HoverRegionModifier`. The in-page buttons
(shuffle, Play, +) are `MusicUI.ActionButton<Image>` with `MusicUI.TopToolbarButtonStyle`, not glass.
Strings from the frameworks (`tools/sections.swift` on AppKit, SwiftUI, DesignLibrary, MusicUI):

- AppKit: class `AppKit.FlexiGlass`; defaults `_NSEnableFlexiglass`, `NSGlassEffectViewEnableDefaultInteractivity`,
  `NSGlassEffectContainerViewAutomaticallySplitsGroups`, `NSMenuDisableFlexiglassForKeynote`; fields of the glass view
  state `isInteractive`, `interactionState`, `flexInteractionVariant`, `flexInteractionSources`, `_flexGestureState`.
- SwiftUI feature flags (`/System/Library/FeatureFlags/Domain/SwiftUI.plist`): `flexiGlassMacOS` and
  `flexiGlassMacOSPointer`, both `FeatureComplete` (on). "FlexiGlass" is the pointer-driven glass behaviour below.
- DesignLibrary: glass recipes `RegularRecipe`, `MenuRecipe`, `SidebarRecipe`, `IdentityRecipe`; per-control fields
  `buttonInteractionState`, `segmentInteractionState`, `pressedSegmentState`, `__flexState`, `_controlContentLensing`,
  `useLowProminenceOnStateInToolbar`, springs (`lowSpring`, `midSpring`, `highSpring`).

The public way to get the same in an app is the toolbar itself (`NSToolbar` items / SwiftUI `.toolbar`), or
`.glassEffect(.regular.interactive())`, `.buttonStyle(.glass)`, `NSButton.bezelStyle = .glass` for loose buttons;
whether those move exactly like the toolbar items has not been checked yet.

**Method.** `tools/buttons/rec` posts mouse events (CGEvent, HID tap) from a step script while ScreenCaptureKit records
Music's window at 60 fps, cursor hidden, cropped (`REC_DISPLAY=1` records the display so menus show); every frame
and event gets a host-clock time. `geom.py` tracks the outline (strongest brightness step along the centre row and
column, sub-pixel), `springfit.py` fits SwiftUI's `spring(response, dampingFraction)`, `segs.py` reads the light per
segment, `compare.py` lines up the settled state before every step of two recordings. Scripts are in
`tools/buttons/scripts/`; frames in `research/local/buttons/` (not in git). All sizes below are device pixels at 2x
unless they say pt.

**Shape at rest.** Back: a 36pt circle centred at (226, 26) in the window. Share + More: one 73x36pt capsule
(x 897.75-970.75); the AX frames are larger (Back 40x52, Share 36x52, More 41x52) because the hit area spans the
toolbar's height. Over Music's toolbar (page 48,43,42) the glass reads 77,68,69: about 13% white. A ~1.5px light line
runs along the top and bottom (+44, +29, +9 over the fill at the outermost three pixels, at 90 deg), fading toward the
sides; just outside the round sides there is a dark hairline (~ -25 against the page) that disappears at the top and
bottom, like the player's ends. No drop shadow.

**Hover.** Single button: the whole face lifts by +20 (luminance), fading in and out in ~0.1s, constant wherever the
pointer is on it (no light that follows the pointer). Group: a circle of the capsule's height minus 6pt (30pt) under
the hovered segment, +18, and it switches between segments **between two frames**, no slide and no fade. Entering
the toolbar also shows Music's title-bar band behind the buttons (+5 on the glass's backdrop); that is the window,
not the button.

**Press.** The glass grows by ~2.2pt on its long axis, uniformly: Back 71.8 -> 76.4px (x1.064), the capsule
145.8 -> 150.3px (x1.031), so `scale = 1 + 2.2pt / max(w, h)`. It overshoots to +2.7pt and settles:

| motion | response | dampingFraction | fit rms |
| --- | --- | --- | --- |
| press, Back | 0.265 s | 0.48 | 0.23px |
| press, capsule | 0.265 s | 0.48 | 0.27px |
| release, Back | 0.12 s (+35ms) | 0.78 | 0.07px |
| release, capsule | 0.21 s | 0.69 | 0.14px |

Light while pressed: a single button gains another +20 evenly (critically damped, ~0.25s). In the capsule the hover
circle stays on the pressed segment and a glow spreads from the pointer: +21 within ~17pt of it, +11 at the other
segment's centre (35pt), +7 at ~55pt; drag onto the neighbour and that segment's circle pops on while the glow moves
with the pointer (Share 29 / More 39).

**Hold and drag.** The pressed size holds as long as the button is held, wherever the pointer goes; letting go
outside cancels (no action), letting go inside acts. Dragged away, the light falls off with distance from the glass
(2pt out: 63% of the pressed light; 56pt: ~20%); held far away its level also depends on whether the window's toolbar
still counts as hovered (Music's band), between rest and hover. **The "flex" is tiny here:** dragging 200pt to the
right moves the right edge out by 0.3pt and the centre by 0.2pt, 274pt down adds 0.3pt at the bottom; fast 60pt
flicks change nothing visible. So on macOS toolbar buttons FlexiGlass is a sub-point lean toward the pointer, not the
jelly stretch of iOS.

**Menus.** More opens its menu on mouse **up** (~0.12s later, no fade-in; closes with a ~0.15s fade). Share opens
the share popover ~0.67s after mouse up, growing out of the button over ~0.17s; closes in ~0.14s. Menus and
popovers are separate windows (`REC_DISPLAY=1`).

**The glass at button size.** The first copy faked the glass in CSS (white fill, inset lines); that was wrong: the
buttons need the measured lens like the player, checked at their own size. `tools/buttons/BtnLab.swift` draws
macOS's glass at given shapes over a 2x background, focused (`capb.sh` keeps only shots taken while key).
- **Reference confirmed:** over Music's own backdrop around Back (`research/buttons/back-bg.png`: the page column by
  column from Music's frame, with the purple block's edge 3.5pt inside the button's right rim), a SwiftUI
  `.glassEffect(.regular, in: Circle())` 36pt at the same spot differs from Music's frame by **0.51** inside (glyph
  masked), 1.24 at the rim, 0.93 just outside (`labcmp.py`). `.interactive()` and a `GlassEffectContainer` are the
  same when static; `.buttonStyle(.glass)` is a different, lighter look (9.2 / 25). So the lab glass is the reference
  at button size, as Lab3 was for the player.
- **Lens curve:** 1pt line probes across the 36pt circle (`research/local/buttons/probe`): at the centre row nothing
  from the outer ~6pt of the page shows; displayed 0.25 / 0.75 / 1.25 / 2.25 / 3.25pt from the edge show the page
  at 14.4 / 11.5 / 10.5 / 8.5 / 7.5pt, then a fold at ~5pt and near identity inside 7pt. The player's lens curve
  scaled by the radius (`A = 1.01 r`, `L = 0.495 r`, r = 18pt) gives 13.9 / 10.7 / 8.9 / 6.1 / 4.1 shifted by the
  same amounts: the curve is the same at both sizes.
- **Tone:** over flat greys the button reads 0 -> 31.6, 32 -> 61.6, 64 -> 88.5, 96 -> 112.3, 128 -> 132.9,
  160 -> 150.2, 192 -> 164.3, 224 -> 175.4, 255 -> 183.0 (within 4 of the player's table; stored as
  `research/buttons/tone.json`, 33 entries by PCHIP). Colour gains more than on the player: purple 82,10,49 ->
  125,36,84, blue 40,90,220 -> 51,109,255, so `gain` fits to ~1.15 (player 1.05).
- **Rim:** on flat pages the light line is only along the top and bottom, as on the player (90 deg: 123 vs 123 over
  grey 64), symmetric; the bright spot seen at a red circle's upper left is page content (a light line) bent by the
  lens, not a specular. The dark hairline is **one device pixel** right outside the glass, the page at ~0.4-0.5
  there at the ends (grey 64 -> 26, 192 -> 99, white -> 100, Music's dark strip 43 -> 16), fading toward the top and
  bottom. Chromium cannot draw that in CSS: a 0.5px border is rounded up to 1px, a 0.5px box-shadow spread is
  dropped (not drawn at all), a 1px inset shadow covers two device pixels. `lgRim()` (lens.js) draws it as an SVG
  stroke of 1/dpr along the shape grown by half that, at opacity 0.55, under the same |n_x|^3 mask. (Until this the
  fit harness hid the rim behind its background image: the box had no stacking context. Fixed with `isolation`.)
- **Fit** (`buttons/fitlens.mjs`, the lens of `buttons/lens.js` against `research/buttons/fit/lab/`, 41 patterns
  cropped from the player's fit set plus flat greys and colours; error inside each shape and 3px around it):
  the player's parameters score 5.61; the exact (4-tap) bend and the hairline in the right band 4.77; on a
  16-pattern set, the measured tone 5.19 and a fit of the rest 4.09 (`research/buttons/params-fit1.json`,
  `fit1.log`): `lensA` 1.01 and `lensH` 0.497 stay (the curve above), `gain` 1.15, `darken` 1.19 over a 15px
  blur (thin bright detail dims more at this size), `pre` 0.37, highlight x0.85 with exponent 4.1. **Not yet in the
  copy**, which still uses the player's values for these.

**Reading past the edge.** Over Music's page the capsule's left end showed a thin red line where ours showed none:
macOS's glass reads the page **outside** its shape, a backdrop-filter only what is under its own box. Probes
(BtnLab, capsule over grey 64, red everywhere left of a line `e` pt outside its left end; red excess R-G on the
centre row, device px from the edge, `research/buttons/fit/*/out-red-*.png`):

| red from | edge px 0, 1 | 2 | 1-7pt inside |
| --- | --- | --- | --- |
| 0pt outside | 136*, 149 | 66 | 23 -> 17 |
| 1pt | 147 | 63 | 22 -> 16 |
| 4pt | 141 | 56 | 16 -> 12 |
| 8pt | 118 | 41 | 11 -> 8 |
| 16pt | 0 | 0 | 0 |

\* the pixel the edge cuts. A 1pt red line at the same distances barely shows (+2..+7): it is a blur, not a mirror.
Two parts: the outermost ~2 device px show the page ~10pt beyond the edge, blurred (weight ~0.6 then ~0.25), and
the whole glass mixes in a little (~+20 next to the red, fading inward and with distance) of a wide blur of the page
around it; nothing from 16pt out. The same holds for the blue page right of the capsule and green above both.

The copy now gives the lens a margin: the face element is 12pt larger than the glass on every side, `clip-path:
inset(12px round 999px)` shows only the glass, and the filter (`lens.js`, `state.margin`) adds two steps after the
bend: an outward read (`outerDist` along the outward normal, `outerBlur`, weight `outerMix` fading over `outerW`
device px; it replaces `pageMix`, and `outerEnd` of it where the edge faces sideways) and a wash. Findings while
fitting it:

- The read has to come **after** the darken halo, which otherwise pulls the read page back toward the glass's grey
  (weight 1 gave only 117 of Apple's 148), and before the tone.
- The wash is **colour only**: with bright green above the glass its luminance inside does not move (-1) while its
  hue shifts; a blur mixed in whole washed out the checker inside. It is the blur's chroma (R-L, G-L, B-L) added.
- **The player does the same, in the same points:** Lab3 (701x54 at 40,40) over the same probes reads, left end red
  1 / 4 / 8pt out 148,64 / 142,57 / 119,41, right end blue 97 / 94 / 80, top edge green 96,36 / 93,32 / 79,23, 16pt
  out nothing (`research/buttons/player-out/`, `tools/buttons/playerout.py`). So the distance does not scale with the
  radius; the round ends read ~0.75 of the straight edges. mcloud's player filter reads 0 everywhere.
- Fitted alone to the player probes (`outerMix` 1, `outerEnd` 0.75, `outerW` 1.9, `outerDist` 11.5, `outerBlur` 3)
  it matches them (left 143,50, right 101, top 91,34) but worsens the checker and grid (button set 4.39 -> 4.7):
  over fine detail Apple's edge is a thin, sharp dark line, which a blurred read smears. The joint fit
  (`research/buttons/params-outer.json`: `outerMix` 0.68, `outerEnd` 0.75, `outerW` 2.09, `washMix` 0.085 over
  10px) takes 4.89 (no margin) to **4.15** on the 15-pattern set and reaches ~77% of the probes' edge (left end
  114,48 at 1pt); on the scene, Apple's red line at the capsule's left end is 156,76,63 / 104,72,66 and ours
  148,78,64 / 109,75,69 (was 75,69,67 / 75,69,67). With the hairline drawn as an SVG stroke the same set scores
  **2.87** (3.94 with a 1px inset shadow; the edge read refits to the same values). Still open: the sharp line over detail, the wash reaching
  deeper (Apple +9 at 20pt in, ours +2), and putting the margin into mcloud's two-layer player glass.

**Chromium copy** (`buttons/glass-buttons.js` + `.css` + `lens.js`, demo `buttons/index.html`, `?scene=art` for a
colourful page): the glass is the player's lens (`lens.js`, mcloud's `glassFilter`/`glassLens` unchanged except for
fractional sizes) on its own face element, with the button-size parameters above; pressing resizes the face so the
lens is redrawn at the new size (scaling a backdrop-filter resamples it and blurs the rim). Springs are integrated
per element only while moving; per-element CSS variables for transform, segment light and
pointer glow; `.lg-glass` holds one `.lg-seg` (single button) or several (group). `buttons/verify.mjs` plays the same
step scripts in Chrome at 2x on a virtual clock and writes frames in rec's format, so the same scripts measure both.
Copy vs Music, settled states (`compare.py`, `segs.py`):

| state | Music | copy |
| --- | --- | --- |
| Back rest / pressed width x height | 71.8x72.1 / 76.4x76.8 | 72.0x72.1 / 76.2x76.3 |
| Back light rest / pressed / dragged 2pt out | 70.1 / 115.6 / 108.2 | 73.1 / 119.3 / 111.3 |
| Back press spring / release spring | 0.265, 0.48 / 0.12, 0.78 | 0.275, 0.42 / 0.14, 0.79 |
| Capsule rest / pressed width | 145.8 / 150.3 | 146.3 / 150.6 |
| Share hover | +17.7 | +17.5 |
| Share pressed: Share, More | +38.8, +11.4 | +38.5, +11.3 |
| pressed Share, pointer on More: Share, More | +29.3, +38.6 | +27.9, +38.3 |

Measured with the lens glass and the edge read (light: luminance inside the left part of the button). Side by side:
`compare/buttons-states.png`, `compare/buttons-press-share.mp4`, `compare/buttons-flex-back.mp4`.

Not matched yet: the light while held far outside (Music keeps hover-level light in some places, the copy uses a
toolbar zone); glyphs are approximations of SF Symbols; menus are not copied.

## Open questions

- Synthetic scroll events scroll Music's home unreliably (up sometimes, down never), so motion against Music itself
  was compared with the lab's `NSGlassView` (proven equal to Music's player over the same background) rather than
  with Music scrolling. A recording of Music scrolling by hand would close that gap.
- The highlight table and the dark/bright edge shading are fitted on a dark page; light pages are less covered.
- Toolbar buttons: do `.glassEffect(.regular.interactive())`, `.buttonStyle(.glass)` and `NSButton` `.glass` move like
  Music's toolbar items? A lab app with the same step scripts (`tools/buttons/rec` needs a bundle id switch) would tell.
