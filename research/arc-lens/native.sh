#!/bin/zsh
# Captures Lab3 (SwiftUI glass, Music's size, bar on whole pixels) over every sweep background that has no capture yet.
T=$HOME/Projects/liquid-glass-research/tools; D=${0:A:h}
export BAR_Y=40
for f in $D/bg/mg[sv]*.png; do n=${f:t}; [ -f $D/apple/$n ] && continue; $T/cap3.sh $D/apple/$n $f plain || echo "MISS $n"; done
echo "native: $(ls $D/apple | wc -l) captures"
