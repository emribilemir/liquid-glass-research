// Control for behind-window glass: a borderless window with two behind-window materials side by side (.hudWindow and
// .sidebar, both forced active), ordered just below a given window; prints its window number and stays N seconds.
// With bands behind it (behindwin) a capture that can see behind-window glass shows them through.
// Usage: materialcheck <x> <y> <w> <h> <seconds> <below window number>
import AppKit
let v = CommandLine.arguments.dropFirst().map { Double($0)! }
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
app.appearance = NSAppearance(named: .darkAqua)
let screen = NSScreen.screens[0]
let frame = NSRect(x: v[0], y: screen.frame.maxY - v[1] - v[3], width: v[2], height: v[3])
let win = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
win.isOpaque = false; win.backgroundColor = .clear
let root = NSView(frame: NSRect(origin: .zero, size: frame.size))
for (i, material) in [NSVisualEffectView.Material.hudWindow, .sidebar].enumerated() {
  let e = NSVisualEffectView(frame: NSRect(x: CGFloat(i) * frame.width / 2, y: 0, width: frame.width / 2, height: frame.height))
  e.material = material; e.blendingMode = .behindWindow; e.state = .active; root.addSubview(e)
}
win.contentView = root
win.order(.below, relativeTo: Int(v[5]))
print(win.windowNumber); fflush(stdout)
DispatchQueue.main.asyncAfter(deadline: .now() + v[4]) { app.terminate(nil) }
app.run()
