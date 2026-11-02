#!/bin/zsh
# cap.sh <out.png>: runs BtnLabLight over flats.png, captures only while key, quits, gives focus back. Needs 8s idle.
L=${0:A:h}; out=$1
idle=$(ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {printf "%d", $NF/1e9; exit}'); [ "$idle" -ge 8 ] || { echo "user active (idle ${idle}s)"; exit 2; }
front=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true')
export KEYFILE="$L/.key"; rm -f "$KEYFILE"
"$L/BtnLabLight" "$L/flats.png" plain $(python3 -c "import json;print(' '.join(json.load(open('$L/flats.json'))['shapes']))") > "$L/.w.txt" 2>"$L/.e.txt" &
pid=$!
for i in {1..40}; do grep -q WINDOW "$L/.w.txt" 2>/dev/null && break; python3 -c "import time;time.sleep(.25)"; done
id=$(awk '/WINDOW/{print $2}' "$L/.w.txt"); ok=0
for try in {1..5}; do
  for i in {1..40}; do [ "$(cat $KEYFILE 2>/dev/null)" = 1 ] && break; python3 -c "import time;time.sleep(.1)"; done
  python3 -c "import time;time.sleep(.5)"; [ "$(cat $KEYFILE)" = 1 ] || continue
  screencapture -l "$id" -o -x "$out"; python3 -c "import time;time.sleep(.1)"
  [ "$(cat $KEYFILE)" = 1 ] && { ok=1; break; }
done
kill $pid 2>/dev/null; wait $pid 2>/dev/null
osascript -e "tell application \"$front\" to activate" 2>/dev/null
[ $ok = 1 ] && echo "captured $out (window $id), focus back to $front" || { echo FAILED; cat "$L/.e.txt" | tail -3; exit 1; }
