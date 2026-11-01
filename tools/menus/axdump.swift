// Prints an app's accessibility tree (role, title/description, frame) to a depth, to find rows and tiles to right-click.
// Usage: axdump <bundle id> [depth]
import AppKit
import ApplicationServices

let bundle = CommandLine.arguments[1], maxDepth = CommandLine.arguments.count > 2 ? Int(CommandLine.arguments[2])! : 10
print("trusted:", AXIsProcessTrusted())
guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundle).first else { print("not running"); exit(1) }
let root = AXUIElementCreateApplication(app.processIdentifier)
func attr(_ e: AXUIElement, _ a: String) -> AnyObject? { var v: AnyObject?; return AXUIElementCopyAttributeValue(e, a as CFString, &v) == .success ? v : nil }
func frame(_ e: AXUIElement) -> String {
  var p = CGPoint.zero, s = CGSize.zero
  if let pv = attr(e, kAXPositionAttribute) { AXValueGetValue(pv as! AXValue, .cgPoint, &p) }
  if let sv = attr(e, kAXSizeAttribute) { AXValueGetValue(sv as! AXValue, .cgSize, &s) }
  return "(\(Int(p.x)),\(Int(p.y)) \(Int(s.width))x\(Int(s.height)))"
}
var printed = 0
func walk(_ e: AXUIElement, _ d: Int, _ path: String) {
  guard d <= maxDepth, printed < 400 else { return }
  let role = attr(e, kAXRoleAttribute) as? String ?? "?"
  let name = [attr(e, kAXTitleAttribute), attr(e, kAXDescriptionAttribute), attr(e, kAXValueAttribute)].compactMap { $0 as? String }.first(where: { !$0.isEmpty }) ?? ""
  print(String(repeating: "  ", count: d) + "\(role) \(name.prefix(40)) \(frame(e)) [\(path)]"); printed += 1
  let kids = attr(e, kAXChildrenAttribute) as? [AXUIElement] ?? []
  for (i, k) in kids.prefix(role == "AXTable" || role == "AXOutline" || role == "AXList" ? 4 : 40).enumerated() { walk(k, d + 1, path + ".\(i)") }
}
walk(root, 0, "")
