# Native glass lab (macOS 26+)

Tools used to fit an SVG backdrop filter (the `#am-glass` filter in [mcloud](https://github.com/bulutakbulutt/mcloud)'s `theme.js`) to macOS's own Liquid Glass. Apple Music's player is an `NSGlassView`
(a private `NSGlassEffectView` subclass); at the regular style it renders exactly like `NSGlassEffectView` and
SwiftUI's `.glassEffect(.regular)`, so the lab uses those. Results depend on System Settings › Appearance ›
Liquid Glass (`NSGlassTintAmount`); the fit was made at 0 (the leftmost setting). Pass `-NSGlassTintAmount <v>`
to try another.

```sh
swiftc -O -target arm64-apple-macosx26.0 GlassLab.swift -o GlassLab   # glass over built-in patterns (700x54)
swiftc -O -target arm64-apple-macosx26.0 Lab2.swift -o Lab2           # glass over any 2x PNG (701x55, Music's size)
swiftc -O -target arm64-apple-macosx26.0 ScrollLab.swift -o ScrollLab # same, scrolling on command
./capture.sh vstripes empty out.png
./cap2.sh out.png background.png nsglass

python3 mkbg.py ../research/fit/bg                  # fit backgrounds (already in the repo)
for f in ../research/fit/bg/*.png; do ./cap2.sh ../research/fit/apple/$(basename $f) $f nsglass; done
npm i --no-save playwright                          # from the repo root
PWB=<chromium> node fit.mjs eval "$(cat ../research/params/p-hi.json)" renders/

swiftc -O swipe.swift -o swipe                      # trackpad-style scroll of Apple Music, capturing each step
./swipe -160 50 <outdir>
```

**Focus matters.** macOS glass has two states: in a key (focused) window it is nearly clear; in a background
window it turns diffuse. Borderless windows cannot become key by default, so `Lab2`/`ScrollLab` subclass NSWindow to
allow it and keep taking focus back, and `cap2.sh` only keeps a shot taken while the window was key. Apple Music
must be frontmost when you capture it too.

Motion: `ScrollLab` scrolls a tall 2x image under the glass one step per stdin line; `motion/native.sh` and
`motion/ours.mjs` (Spotify on debug port 9229, kept focused) capture the same offsets for a side-by-side video.

Window capture (`screencapture -l`) needs the Screen Recording permission for the terminal.

Toolbar buttons (`buttons/`): `rec` records Apple Music's window at 60 fps with ScreenCaptureKit while it posts the
mouse steps of a script (`scripts/*.txt`: `move x y [ms]`, `down`, `up`, `drag x y [ms]`, `wait ms`, `key esc`, window
points); `REC_DISPLAY=1` records the display (Music's windows only) so menus show. `../buttons/verify.mjs` plays the
same script against the Chromium copy. `geom.py`, `springfit.py`, `segs.py`, `compare.py`, `sheet.py`, `crops.py` and
`sbs.py` read either recording. Music must stay on the same page (the scripts use its playlist toolbar).

`BtnLab.swift` draws macOS's glass at button shapes (`circle:x,y,d`, `capsule:x,y,w,h`, top-left pt) over a 2x
background, focused; `capb.sh` captures it like `cap2.sh`. `labcmp.py` compares a capture with Music's frame,
`../buttons/fitlens.mjs` fits the Chromium lens to `../research/buttons/fit/lab/`, `fitview.py` and `rimprof.py` show
where they differ.

```sh
swiftc -O -target arm64-apple-macosx26.0 buttons/BtnLab.swift -o buttons/BtnLab
buttons/capb.sh out.png ../research/buttons/fit/bg/grid.png plain circle:78,8,36 capsule:140,8,73,36
node ../buttons/fitlens.mjs eval '{}' renders/
```

```sh
swiftc -O -target arm64-apple-macosx26.0 buttons/rec.swift -o buttons/rec
buttons/rec buttons/scripts/flex-back.txt ../research/local/buttons/flex-back 130 0 240 110
node ../buttons/verify.mjs buttons/scripts/flex-back.txt ../research/local/buttons/copy-flex-back 130 0 240 110
python3 buttons/compare.py ../research/local/buttons/flex-back ../research/local/buttons/copy-flex-back 192 52
```

`../buttons/bench.mjs` times frames in a visible Chrome window with a page scrolling under the demo toolbar (no backdrop,
CSS blur, the lens; `parts` takes the lens apart); `../buttons/player.mjs` compares players against Music's frames.
