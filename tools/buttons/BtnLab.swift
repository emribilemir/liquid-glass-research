// BtnLab: macOS's glass at button sizes over a 2x background, focused, to compare with Apple Music's toolbar
// buttons and to fit the Chromium lens at that size.
//   BtnLab <background.png> <variant> <shape>...      shape: circle:x,y,d | capsule:x,y,w,h (top-left, pt)
//   variant: plain | interactive | container | nsglass | nsglassview | buttonglass
// Keeps its window key (focused) and writes "1"/"0" to $KEYFILE, like Lab3; prints "WINDOW <id>".
import SwiftUI
import AppKit

let a = CommandLine.arguments
let bgPath = a[1], variant = a[2]
let loaded = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: bgPath)))!
let rep = loaded.retagging(with: NSScreen.main!.colorSpace!)!
let size = NSSize(width: rep.pixelsWide / 2, height: rep.pixelsHigh / 2)
let image = NSImage(size: size); image.addRepresentation(rep)
struct Shape { let rect: CGRect; let circle: Bool }
let shapes: [Shape] = a.dropFirst(3).map { s in
  let p = s.split(separator: ":"), v = p[1].split(separator: ",").map { CGFloat(Double($0)!) }
  return p[0] == "circle" ? Shape(rect: CGRect(x: v[0], y: v[1], width: v[2], height: v[2]), circle: true) : Shape(rect: CGRect(x: v[0], y: v[1], width: v[2], height: v[3]), circle: false)
}

struct One: View {
  let s: Shape
  var body: some View {
    let glass: Glass = variant == "interactive" ? .regular.interactive() : .regular
    if variant == "buttonglass" {
      Button(action: {}) { Color.clear.frame(width: s.rect.width - 2 * 7, height: s.rect.height - 2 * 7) }.buttonStyle(.glass).buttonBorderShape(s.circle ? .circle : .capsule)
    } else if s.circle { Color.clear.frame(width: s.rect.width, height: s.rect.height).glassEffect(glass, in: Circle()) }
    else { Color.clear.frame(width: s.rect.width, height: s.rect.height).glassEffect(glass, in: Capsule()) }
  }
}
struct Lab: View {
  var body: some View {
    ZStack(alignment: .topLeading) {
      Image(nsImage: image).resizable().frame(width: size.width, height: size.height)
      if !variant.hasPrefix("nsglass") {
        if variant == "container" { GlassEffectContainer { ZStack(alignment: .topLeading) { ForEach(shapes.indices, id: \.self) { i in One(s: shapes[i]).offset(x: shapes[i].rect.minX, y: shapes[i].rect.minY) } } } }
        else { ForEach(shapes.indices, id: \.self) { i in One(s: shapes[i]).offset(x: shapes[i].rect.minX, y: shapes[i].rect.minY) } }
      }
    }
    .frame(width: size.width, height: size.height, alignment: .topLeading)
    .environment(\.colorScheme, .dark)
  }
}

final class KeyWindow: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true } }
final class Delegate: NSObject, NSApplicationDelegate {
  var window: NSWindow!
  func applicationDidFinishLaunching(_ n: Notification) {
    window = KeyWindow(contentRect: NSRect(x: 300, y: 300, width: size.width, height: size.height), styleMask: [.borderless], backing: .buffered, defer: false)
    window.appearance = NSAppearance(named: .darkAqua); window.hasShadow = false; window.level = .floating
    let host = NSHostingView(rootView: Lab())
    host.frame = NSRect(origin: .zero, size: size)
    if variant.hasPrefix("nsglass") {
      for s in shapes {
        let cls: NSGlassEffectView.Type = variant == "nsglassview" ? NSClassFromString("NSGlassView") as! NSGlassEffectView.Type : NSGlassEffectView.self
        let g = cls.init(frame: NSRect(x: s.rect.minX, y: size.height - s.rect.maxY, width: s.rect.width, height: s.rect.height))
        g.style = .regular; g.cornerRadius = s.rect.height / 2; g.contentView = NSView(frame: NSRect(origin: .zero, size: s.rect.size))
        host.addSubview(g)
      }
    }
    window.contentView = host
    window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    let keyFile = ProcessInfo.processInfo.environment["KEYFILE"]
    Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
      let key = self.window.isKeyWindow && NSApp.isActive
      if !key { NSApp.activate(ignoringOtherApps: true); self.window.makeKeyAndOrderFront(nil) }
      if let f = keyFile { try? (key ? "1" : "0").write(toFile: f, atomically: true, encoding: .utf8) }
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { print("WINDOW \(self.window.windowNumber)"); fflush(stdout) }
  }
}
let app = NSApplication.shared
let d = Delegate(); app.delegate = d; app.setActivationPolicy(.regular); app.run()
