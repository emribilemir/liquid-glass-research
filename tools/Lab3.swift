// Lab3: the player bar built like Apple Music's (SwiftUI glass, optionally in a GlassEffectContainer and
// interactive) over a 2x background, at the geometry of Music's scroll frames: 701x54pt at (40, 40.5).
//   Lab3 <background.png> <variant>
//   variant: plain | container | interactive | container-interactive | nsglass
// Keeps its window key (focused) and writes "1"/"0" to $KEYFILE, like Lab2; prints "WINDOW <id>".
import SwiftUI
import AppKit

let a = CommandLine.arguments
let bgPath = a[1], variant = a.count > 2 ? a[2] : "container"
let loaded = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: bgPath)))!
let rep = loaded.retagging(with: NSScreen.main!.colorSpace!)!
let size = NSSize(width: rep.pixelsWide / 2, height: rep.pixelsHigh / 2)
let image = NSImage(size: size); image.addRepresentation(rep)
let barW: CGFloat = 701, barH: CGFloat = 54, barX: CGFloat = 40, barY: CGFloat = 40.5

struct Bar: View {
    var body: some View {
        let shape = Capsule()
        let glass: Glass = variant.contains("interactive") ? .regular.interactive() : .regular
        let bar = Color.clear.frame(width: barW, height: barH).glassEffect(glass, in: shape)
        if variant.hasPrefix("container") { GlassEffectContainer { bar } } else { bar }
    }
}

struct Lab: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            Image(nsImage: image).resizable().frame(width: size.width, height: size.height)
            if variant != "nsglass" { Bar().offset(x: barX, y: barY) }
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
        if variant == "nsglass" {
            let cls = NSClassFromString("NSGlassView") as! NSGlassEffectView.Type
            let g = cls.init(frame: NSRect(x: barX, y: size.height - barY - barH, width: barW, height: barH))
            g.style = .regular; g.cornerRadius = barH / 2; g.contentView = NSView(frame: NSRect(x: 0, y: 0, width: barW, height: barH))
            host.addSubview(g)
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
