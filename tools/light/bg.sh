#!/bin/bash
# Copied from the mcloud B8 session (2026-11-02). Paths, the Spotify window id and the 9229 debug port are that run's.
# bg.sh <css colour|none> <out name>: lays a flat colour under the theme's glass in Spotify, captures the window
T=/Users/emirbilici/mcloud-research/b8-glass/tools
node $T/ev.mjs "(()=>{let d=document.getElementById('am-b8-bg');let st=document.getElementById('am-b8-st');if('$1'==='none'){d?.remove();st?.remove();return 'removed'}if(!st){st=document.createElement('style');st.id='am-b8-st';st.textContent='body.am-ready #global-nav-bar::before{display:none!important}';document.head.append(st)}if(!d){d=document.createElement('div');d.id='am-b8-bg';document.getElementById('am-toolbar-glass').prepend(d)}d.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;background:$1';return 'set'})()" >/dev/null
python3 -c "import time; time.sleep(0.8)"
[ -n "$2" ] && screencapture -l4795 -o -x /Users/emirbilici/mcloud-research/b8-glass/ours/$2.png && echo "captured $2"
