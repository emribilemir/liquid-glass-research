// Opens a dark window with colourful artwork on the left and a Spotify-like track list on the right, pops a native
// context menu (NSMenu) over each, opens its submenu with arrow keys posted to this process only (the user's mouse
// and other apps are untouched), and captures the screen rect at each step with screencapture.
// Usage: menulab <outdir>
import AppKit

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let app = NSApplication.shared
app.setActivationPolicy(.regular)
app.appearance = NSAppearance(named: .darkAqua)

final class Art: NSView {
  override var isFlipped: Bool { true }
  override func draw(_ d: NSRect) {
    let r = bounds
    let g = NSGradient(colors: [NSColor(srgbRed: 0.95, green: 0.25, blue: 0.35, alpha: 1), NSColor(srgbRed: 1, green: 0.62, blue: 0.1, alpha: 1),
                                NSColor(srgbRed: 0.2, green: 0.75, blue: 0.95, alpha: 1), NSColor(srgbRed: 0.35, green: 0.2, blue: 0.85, alpha: 1)])!
    g.draw(in: r, angle: 35)
    for i in 0..<9 { NSColor(white: 1, alpha: 0.85).setFill(); NSBezierPath(ovalIn: NSRect(x: 30 + i * 55, y: 60 + (i % 3) * 120, width: 30, height: 30)).fill() }
    NSColor.black.setFill(); NSBezierPath(rect: NSRect(x: 0, y: r.height - 140, width: r.width, height: 40)).fill()
    let big: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 64, weight: .heavy), .foregroundColor: NSColor.white]
    ("PHANTOM" as NSString).draw(at: NSPoint(x: 30, y: 200), withAttributes: big)
    let small: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13), .foregroundColor: NSColor.black]
    for i in 0..<14 { ("Small text line \(i) — legibility behind the glass" as NSString).draw(at: NSPoint(x: 30, y: 300 + CGFloat(i) * 16), withAttributes: small) }
  }
}

final class List: NSView {
  override var isFlipped: Bool { true }
  override func draw(_ r: NSRect) {
    NSColor(srgbRed: 0.12, green: 0.12, blue: 0.12, alpha: 1).setFill(); bounds.fill()   // views no longer clip to bounds by default
    let t: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 14, weight: .medium), .foregroundColor: NSColor(white: 0.92, alpha: 1)]
    let s: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12), .foregroundColor: NSColor(white: 0.6, alpha: 1)]
    let colours: [NSColor] = [.systemRed, .systemOrange, .systemYellow, .systemGreen, .systemTeal, .systemBlue, .systemPurple, .systemPink]
    for i in 0..<12 {
      let y = 20 + CGFloat(i) * 46
      colours[i % colours.count].setFill(); NSBezierPath(roundedRect: NSRect(x: 20, y: y, width: 36, height: 36), xRadius: 4, yRadius: 4).fill()
      ("Track title number \(i + 1)" as NSString).draw(at: NSPoint(x: 70, y: y + 1), withAttributes: t)
      ("Artist name · Album" as NSString).draw(at: NSPoint(x: 70, y: y + 19), withAttributes: s)
    }
  }
}

let size = NSSize(width: 1000, height: 580)
let screen = NSScreen.main!
let frame = NSRect(x: screen.visibleFrame.minX + 40, y: screen.visibleFrame.maxY - size.height - 40, width: size.width, height: size.height)
let win = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
win.level = .floating
let root = NSView(frame: NSRect(origin: .zero, size: size))
let art = Art(frame: NSRect(x: 0, y: 0, width: 500, height: size.height))
let list = List(frame: NSRect(x: 500, y: 0, width: 500, height: size.height))
root.addSubview(art); root.addSubview(list); win.contentView = root

// Screen rect of the window in screencapture's top-left coordinates.
let topLeftY = screen.frame.maxY - frame.maxY
let rect = "\(Int(frame.minX)),\(Int(topLeftY)),\(Int(size.width)),\(Int(size.height))"
let video = CommandLine.arguments.count > 2 && CommandLine.arguments[2] == "video"
func shot(_ name: String) { if video { return }; let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture"); p.arguments = ["-x", "-R\(rect)", "\(out)/\(name).png"]; try? p.run(); p.waitUntilExit() }
// Arrow keys go into this app's own event queue; menu tracking reads them there. Logged with the highlighted item.
func key(_ code: UInt16) {
  let ch = String(Character(UnicodeScalar([123: 0xF702, 124: 0xF703, 125: 0xF701][code]!)!))
  for type in [NSEvent.EventType.keyDown, .keyUp] {
    let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [.numericPad, .function], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: 0,
                             context: nil, characters: ch, charactersIgnoringModifiers: ch, isARepeat: false, keyCode: code)!
    app.postEvent(e, atStart: false)
  }
}
func log(_ s: String) { FileHandle.standardError.write((s + "  highlighted: \(current?.highlightedItem?.title ?? "-") sub: \(current?.items.first?.submenu?.highlightedItem?.title ?? "-")\n").data(using: .utf8)!) }

final class Target: NSObject { @objc func noop(_ s: Any?) {} }
let target = Target()
func item(_ title: String, _ sub: NSMenu? = nil) -> NSMenuItem { let i = NSMenuItem(title: title, action: sub == nil ? #selector(Target.noop(_:)) : nil, keyEquivalent: ""); i.target = target; i.submenu = sub; return i }
func menu() -> NSMenu {
  let add = NSMenu(); add.addItem(item("Yeni Çalma Listesi")); add.addItem(.separator())
  for n in ["Late Night Drive", "Gym", "Road Trip", "Focus", "Chill Evenings", "Turkish Rock", "Liked Songs Mix", "Morning Coffee"] { add.addItem(item(n)) }
  let share = NSMenu(); share.addItem(item("Şarkı Bağlantısını Kopyala")); share.addItem(item("Şarkıyı Yerleştir"))
  let m = NSMenu()
  m.addItem(item("Çalma Listesine Ekle", add)); m.addItem(item("Sıraya Ekle")); m.addItem(item("Sonra Çal")); m.addItem(.separator())
  m.addItem(item("Sanatçıya Git")); m.addItem(item("Albüme Git")); m.addItem(item("Jeneriği Göster")); m.addItem(.separator())
  m.addItem(item("Beğenilen Şarkılara Ekle")); m.addItem(item("Paylaş", share))
  return m
}

var steps: [(Double, () -> Void)] = []
var current: NSMenu?
func at(_ t: Double, _ f: @escaping () -> Void) { let timer = Timer(timeInterval: t, repeats: false) { _ in f() }; RunLoop.main.add(timer, forMode: .common) }

// One scenario: a context menu at `point` (window coords, flipped from top), captured closed, open, with the submenu
// open, and with an item highlighted inside the submenu.
func scenario(_ tag: String, _ point: NSPoint, then next: @escaping () -> Void) {
  shot("\(tag)-0-background")
  let m = menu(); current = m
  let loc = NSPoint(x: point.x, y: size.height - point.y)
  let ev = NSEvent.mouseEvent(with: .rightMouseDown, location: loc, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
                              windowNumber: win.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!
  at(0.9) { shot("\(tag)-1-menu"); log("1-menu") }
  at(1.1) { key(125) }                       // down: highlight "Çalma Listesine Ekle"
  at(1.6) { shot("\(tag)-2-highlight"); log("2-highlight") }
  at(1.8) { key(124) }                       // right: open the submenu
  at(2.6) { shot("\(tag)-3-submenu"); log("3-submenu") }
  at(2.8) { key(125); key(125); key(125) }   // move down inside the submenu
  at(3.4) { shot("\(tag)-4-submenu-item"); log("4-submenu-item") }
  at(3.6) { key(123) }                       // left: close the submenu, back to the parent
  at(4.2) { shot("\(tag)-5-back"); log("5-back") }
  at(4.4) { m.cancelTracking() }
  NSMenu.popUpContextMenu(m, with: ev, for: list)   // blocks until cancelTracking
  DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: next)
}

if video { let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture"); p.arguments = ["-x", "-v", "-V17", "-R\(rect)", "\(out)/menus.mov"]; try? p.run() }
DispatchQueue.main.asyncAfter(deadline: .now() + (video ? 1.5 : 0.8)) {
  scenario("art", NSPoint(x: 120, y: 90)) {
    scenario("dark", NSPoint(x: 560, y: 90)) {
      scenario("edge", NSPoint(x: 330, y: 120)) { app.terminate(nil) }   // submenu opens over the art/list boundary
    }
  }
}
win.orderFrontRegardless()
app.activate(ignoringOtherApps: true)
app.run()
