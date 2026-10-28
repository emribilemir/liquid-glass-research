#!/bin/zsh
# runsweep2.sh name...: renders the sub-pixel sweep for each variant (aa/<name>.json) and scores them against native.
D=${0:A:h}; S=${D:h}
export NODE_PATH=$HOME/mcloud/node_modules PWB="$HOME/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" FITDIR=$S/sweep/ PATTERNS=$(cd $S/sweep/bg && ls mg[sv]*.png | sed 's/.png//' | paste -sd, -)
for n in $@; do node $HOME/Projects/liquid-glass-research/tools/fit.mjs eval "$(cat $D/$n.json)" $S/sweep/v-$n > $D/sweep-$n.log 2>&1 & done; wait
cd $S/sweep && python3 -I subpx.py apple v-base ${@/#/v-}
