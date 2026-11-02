#!/bin/bash
# ready.sh: reloads until the theme is ready, the player loaded and no error page (max 3 tries)
T=/Users/emirbilici/mcloud-research/b8-glass/tools
for i in 1 2 3; do node $T/ev.mjs "location.reload()" >/dev/null; python3 -c "import time; time.sleep(8)"
  r=$(node $T/ev.mjs "JSON.stringify({ok:document.body.classList.contains('am-ready')&&!!Spicetify.Player.data&&!document.body.innerText.includes('Something went wrong'),light:document.body.classList.contains('am-light'),n:document.querySelectorAll('.am-tglass').length})")
  echo "$r"; echo "$r" | grep -q '"ok":true' && exit 0; done; exit 1
