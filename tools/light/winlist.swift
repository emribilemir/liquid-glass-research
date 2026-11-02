import CoreGraphics
import Foundation
let owner = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "Music"
let list = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerName as String] as? String) == owner {
  let b = w[kCGWindowBounds as String] as! [String: Any]
  print(w[kCGWindowNumber as String]!, w[kCGWindowLayer as String]!, w[kCGWindowIsOnscreen as String] ?? "-", b["X"]!, b["Y"]!, b["Width"]!, b["Height"]!, w[kCGWindowName as String] ?? "")
}
