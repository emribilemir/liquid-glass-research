#!/bin/bash
# colours.sh <tag>: each flat colour under the toolbar glass and under the player, one capture each
T=/Users/emirbilici/mcloud-research/b8-glass/tools; O=/Users/emirbilici/mcloud-research/b8-glass/ours/colours; mkdir -p $O
python3 -c "import json;[print(n,'color(display-p3_%.4f_%.4f_%.4f)'%tuple(v/255 for v in t['rgb'])) for n,t in json.load(open('/Users/emirbilici/mcloud-research/b8-glass/lab/flats.json'))['tiles'].items()]" | while read n col; do col=${col//_/ };
  node $T/ev.mjs "(()=>{let d=document.getElementById('am-b8-bg2');if(!d){d=document.createElement('div');d.id='am-b8-bg2';document.body.append(d)}d.style.cssText='position:fixed;left:0;right:0;bottom:0;height:150px;z-index:45;pointer-events:none;background:$col';return 1})()" >/dev/null
  $T/bg.sh "$col" "colours/$1-$n" >/dev/null && echo -n "$n "
done; echo
$T/bg.sh none; node $T/ev.mjs "document.getElementById('am-b8-bg2')?.remove()" >/dev/null; true
