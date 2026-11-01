// Apple Music refraction check: brings Music forward (System Events), confirms it is frontmost with a focused main
// window, opens its own context menu on an element (AXShowMenu, no mouse), captures the rect with the menu, closes
// it with Escape, captures the same rect without it. Never touches playback or volume.
// Usage: musicrefr <outdir> <tag> <ax path> <x,y,w,h>
import AppKit
import ApplicationServices

let a = CommandLine.arguments
let out = a[1], tag = a[2], path = a[3].hasPrefix("click:") ? [] : a[3].split(separator: ".").map { Int($0)! }, rect = a[4]
let music = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Music").first!
let root = AXUIElementCreateApplication(music.processIdentifier)
func attr(_ e: AXUIElement, _ n: String) -> AnyObject? { var v: AnyObject?; return AXUIElementCopyAttributeValue(e, n as CFString, &v) == .success ? v : nil }
func kids(_ e: AXUIElement) -> [AXUIElement] { attr(e, kAXChildrenAttribute) as? [AXUIElement] ?? [] }
// "click:x,y" right-clicks that global point through Music's own event queue (the cursor does not move).
var savedCursor: CGPoint?
let click: CGPoint? = a[3].hasPrefix("click:") ? { let v = a[3].dropFirst(6).split(separator: ",").map { Double($0)! }; return CGPoint(x: v[0], y: v[1]) }() : nil
var target = root
for i in (click == nil ? path : []) { let k = kids(target); guard i < k.count else { print("bad path"); exit(1) }; target = k[i] }
print("target:", attr(target, kAXDescriptionAttribute) ?? attr(target, kAXTitleAttribute) ?? "")
func shot(_ name: String) { let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture"); p.arguments = ["-x", "-R\(rect)", "\(out)/\(tag)-\(name).png"]; try? p.run(); p.waitUntilExit() }
func front() -> Bool { NSWorkspace.shared.frontmostApplication?.processIdentifier == music.processIdentifier }
func osa(_ s: String) { let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript"); p.arguments = ["-e", s]; try? p.run(); p.waitUntilExit() }

osa("tell application \"System Events\" to set frontmost of process \"Music\" to true")
usleep(800_000)
let win = kids(root).first { (attr($0, kAXRoleAttribute) as? String) == "AXWindow" }
print("frontmost:", front(), "main window:", win.flatMap { attr($0, kAXMainAttribute) } ?? "?", "focused:", win.flatMap { attr($0, kAXFocusedAttribute) } ?? "?")
guard front() else { print("Music is not frontmost; abort"); exit(1) }
if let c = click {
  // A real right-click (events sent only to Music did not open a menu); the cursor is put back afterwards.
  let home = CGEvent(source: nil)!.location
  savedCursor = home
  for type in [CGEventType.rightMouseDown, .rightMouseUp] { CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: c, mouseButton: .right)?.post(tap: .cghidEventTap); usleep(40000) }
} else {
  DispatchQueue.global().async { AXUIElementSetMessagingTimeout(target, 1.5); _ = AXUIElementPerformAction(target, "AXShowMenu" as CFString) }
}
usleep(1_300_000)
print("still frontmost with menu:", front())
shot("menu")
if front() { for down in [true, false] { CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: down)?.post(tap: .cghidEventTap); usleep(15000) } }
usleep(700_000)
if let h = savedCursor { CGWarpMouseCursorPosition(h); CGAssociateMouseAndMouseCursorPosition(1); print("cursor restored to", h) }
shot("bg")
