// Shows a borderless 45° stripe window at a global rect (top-left origin) for some seconds without activating, so
// another app's menu that hangs past its own window lies over the stripes. Usage: stripeswin <x> <y> <w> <h> <seconds>
import AppKit

let v = CommandLine.arguments.dropFirst().map { Double($0)! }
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
final class Stripes: NSView {
  override var isFlipped: Bool { true }
  override func draw(_ d: NSRect) {
    NSColor.black.setFill(); bounds.fill(); NSColor.white.setFill()
    let h = bounds.height; var x: CGFloat = -h
    while x < bounds.width + h { let p = NSBezierPath(); p.move(to: NSPoint(x: x, y: 0)); p.line(to: NSPoint(x: x + 24, y: 0)); p.line(to: NSPoint(x: x + 24 + h, y: h)); p.line(to: NSPoint(x: x + h, y: h)); p.close(); p.fill(); x += 48 }
  }
}
let screen = NSScreen.main!
let frame = NSRect(x: v[0], y: screen.frame.maxY - v[1] - v[3], width: v[2], height: v[3])
let win = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
win.contentView = Stripes(frame: NSRect(origin: .zero, size: frame.size))
win.orderFrontRegardless()
DispatchQueue.main.asyncAfter(deadline: .now() + v[4]) { app.terminate(nil) }
app.run()
