#!/bin/bash
# Copied from the mcloud B8 session (2026-11-02). Paths, the Spotify window id and the 9229 debug port are that run's.
# burst.sh: brings Music forward only if the Mac has been idle >= 8s, runs scenes, captures each focused, gives focus back.
T=/Users/emirbilici/mcloud-research/b8-glass/tools; O=/Users/emirbilici/mcloud-research/b8-glass/apple; W=$($T/winlist Music | awk '$8=="Music"{print $1}' | head -1)
idle=$(ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {printf "%d", $NF/1e9; exit}')
[ "$idle" -ge 8 ] || { echo "user active (idle ${idle}s), not activating"; exit 2; }
front=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true')
osascript -e 'tell application "Music" to activate'; python3 -c "import time; time.sleep(1.2)"
cap(){ screencapture -l$W -o -x "$O/$1.png"; python3 -I -c "
from PIL import Image
im=Image.open('$O/$1.png').convert('RGB')
best=max(((x,y) for x in range(0,120) for y in range(0,80)),key=lambda p:(lambda c:c[0]-c[1])(im.getpixel(p)))
c=im.getpixel(best);print('$1',im.size,c,'FOCUSED' if c[0]-c[1]>80 else 'GREY')"; }
w(){ python3 -c "import time; time.sleep($1)"; }
while read -r name cmd; do [ -z "$name" ] && continue; eval "$cmd"; w 1.0; cap "$name"; done < "$1"
osascript -e "tell application \"$front\" to activate" 2>/dev/null
echo "focus back to $front"
