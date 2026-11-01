// Presses one AX element of Apple Music by index path. Usage: axpress <ax path>
import AppKit
import ApplicationServices
let path = CommandLine.arguments[1].split(separator: ".").map { Int($0)! }
let music = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Music").first!
var e = AXUIElementCreateApplication(music.processIdentifier)
for i in path { var v: AnyObject?; AXUIElementCopyAttributeValue(e, kAXChildrenAttribute as CFString, &v); e = (v as! [AXUIElement])[i] }
var d: AnyObject?; AXUIElementCopyAttributeValue(e, kAXDescriptionAttribute as CFString, &d)
let act = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : kAXPressAction; print(act, d ?? "?", AXUIElementPerformAction(e, act as CFString).rawValue)
