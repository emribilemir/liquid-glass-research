// A borderless window of bold colour bands placed directly BELOW another app's window (never in front of anything),
// so that window's behind-window glass, if any, shows the bands. Usage: behindwin <x> <y> <w> <h> <seconds> <window number>
import AppKit
let v = CommandLine.arguments.dropFirst().map { Double($0)! }
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
final class Bands: NSView {
  override var isFlipped: Bool { true }
  override func draw(_ d: NSRect) {
    let colours: [NSColor] = [.systemRed, .systemGreen, .systemBlue, .white, .black, .systemYellow]
    var x: CGFloat = 0; var i = 0
    while x < bounds.width { colours[i % colours.count].setFill(); NSRect(x: x, y: 0, width: 60, height: bounds.height).fill(); x += 60; i += 1 }
  }
}
let screen = NSScreen.screens[0]
let frame = NSRect(x: v[0], y: screen.frame.maxY - v[1] - v[3], width: v[2], height: v[3])
let win = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
win.contentView = Bands(frame: NSRect(origin: .zero, size: frame.size))
win.order(.below, relativeTo: Int(v[5]))
DispatchQueue.main.asyncAfter(deadline: .now() + v[4]) { app.terminate(nil) }
app.run()
