// refrlab over any 2x PNG instead of stripes: the app made frontmost through System Events (focused glass), a native
// NSMenu popped at the same place, the rect captured before and with it. Used for the menu tone over flat greys and
// colours and over five surfaces. Usage: refrlab-image <outdir> <background.png> <tag>
import AppKit

let out = CommandLine.arguments[1], bgPath = CommandLine.arguments[2], tag = CommandLine.arguments[3]
let bgImage = NSImage(contentsOfFile: bgPath)!
let app = NSApplication.shared
app.setActivationPolicy(.regular)
app.appearance = NSAppearance(named: .darkAqua)

final class Stripes: NSView {
  override var isFlipped: Bool { true }
  override func draw(_ d: NSRect) {
    bgImage.draw(in: bounds, from: .zero, operation: .copy, fraction: 1, respectFlipped: true, hints: nil); return
    NSColor.white.setFill()
    let period: CGFloat = 48, h = bounds.height
    var x: CGFloat = -h
    while x < bounds.width + h {   // stripes along y = x + c, 24pt wide
      let p = NSBezierPath(); p.move(to: NSPoint(x: x, y: 0)); p.line(to: NSPoint(x: x + 24, y: 0)); p.line(to: NSPoint(x: x + 24 + h, y: h)); p.line(to: NSPoint(x: x + h, y: h)); p.close(); p.fill()
      x += period
    }
  }
}

let size = NSSize(width: 1000, height: 580)
let screen = NSScreen.main!
let frame = NSRect(x: screen.visibleFrame.minX + 40, y: screen.visibleFrame.maxY - size.height - 40, width: size.width, height: size.height)
let win = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
win.level = .floating
let root = Stripes(frame: NSRect(origin: .zero, size: size))
win.contentView = root
if false {
  let glass = NSGlassEffectView(frame: NSRect(x: 620, y: 120, width: 300, height: 64)); glass.cornerRadius = 32
  root.addSubview(glass)
}
let topLeftY = screen.frame.maxY - frame.maxY
let rect = "\(Int(frame.minX)),\(Int(topLeftY)),\(Int(size.width)),\(Int(size.height))"
func shot(_ name: String) { let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture"); p.arguments = ["-x", "-R\(rect)", "\(out)/\(tag)-\(name).png"]; try? p.run(); p.waitUntilExit() }
func front() -> Bool { NSWorkspace.shared.frontmostApplication?.processIdentifier == getpid() }

final class Target: NSObject { @objc func noop(_ s: Any?) {} }
let target = Target()
let menu = NSMenu()
for t in ["Çalma Listesine Ekle", "Sıraya Ekle", "Sonra Çal", "-", "Sanatçıya Git", "Albüme Git", "Jeneriği Göster", "-", "Beğenilen Şarkılara Ekle", "Paylaş"] {
  if t == "-" { menu.addItem(.separator()) } else { let i = NSMenuItem(title: t, action: #selector(Target.noop(_:)), keyEquivalent: ""); i.target = target; menu.addItem(i) }
}
func at(_ t: Double, _ f: @escaping () -> Void) { let timer = Timer(timeInterval: t, repeats: false) { _ in f() }; RunLoop.main.add(timer, forMode: .common) }

// Cooperative activation ignores a CLI's request, so ask System Events to bring this process forward.
DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
  let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
  p.arguments = ["-e", "tell application \"System Events\" to set frontmost of (first process whose unix id is \(getpid())) to true"]; try? p.run()
}
DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
  guard front() else { FileHandle.standardError.write("not frontmost, abort\n".data(using: .utf8)!); app.terminate(nil); return }
  FileHandle.standardError.write("frontmost=\(front()) key=\(win.isKeyWindow) main=\(win.isMainWindow)\n".data(using: .utf8)!)
  shot("background")
  let ev = NSEvent.mouseEvent(with: .rightMouseDown, location: NSPoint(x: 150, y: size.height - 140), modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
                              windowNumber: win.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!
  at(1.0) { FileHandle.standardError.write("menu open, frontmost=\(front())\n".data(using: .utf8)!); shot("menu") }
  at(1.4) { menu.cancelTracking() }
  NSMenu.popUpContextMenu(menu, with: ev, for: root)
  DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { app.terminate(nil) }
}
win.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)
app.run()
