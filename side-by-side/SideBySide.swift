// SideBySide: one Spotify page under two player bars, scrolled together.
//   left:  a native window with macOS's own Liquid Glass (SwiftUI .glassEffect, the glass Apple Music's player uses)
//   right: Chrome running the mcloud theme (its dev/preview.html with theme.js and user.css), its bar over the same page
// Scrolling either window scrolls both (Chrome is driven over its DevTools protocol). The native window keeps focus,
// because macOS glass looks different in a window that is not key; clicking Chrome hands focus straight back.
//
//   SideBySide snap <dir> [route]   copy the open Spotify page (Spotify running with --remote-debugging-port=9229)
//   SideBySide <dir> <theme dir>    show the copy; theme dir is an mcloud checkout (theme.js, user.css, dev/)
// CHROME overrides the Chrome binary. install.sh does all of it.
import SwiftUI
import AppKit

let args = CommandLine.arguments
let chromeBinary = ProcessInfo.processInfo.environment["CHROME"] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
let chromePort = 9333, spotifyPort = 9229

// A minimal DevTools client: one WebSocket, replies matched by id (delivered on the main queue), events to onEvent.
final class DevTools: @unchecked Sendable { // used from the main queue only
    var task: URLSessionWebSocketTask?
    var nextId = 1, replies: [Int: ([String: Any]?) -> Void] = [:]
    var onEvent: (String, [String: Any]) -> Void = { _, _ in }
    func connect(_ url: URL) { task = URLSession.shared.webSocketTask(with: url); task!.maximumMessageSize = 64 << 20; task!.resume(); receive() }
    func send(_ method: String, _ params: [String: Any] = [:], reply: (([String: Any]?) -> Void)? = nil) {
        let id = nextId; nextId += 1
        if let reply { replies[id] = reply }
        let data = try! JSONSerialization.data(withJSONObject: ["id": id, "method": method, "params": params])
        task?.send(.string(String(data: data, encoding: .utf8)!)) { _ in }
    }
    func call(_ method: String, _ params: [String: Any] = [:]) async -> [String: Any]? {
        await withCheckedContinuation { c in DispatchQueue.main.async { self.send(method, params) { c.resume(returning: $0) } } }
    }
    // Runs an expression in the page and returns its value (promises awaited).
    func evaluate(_ expression: String) async -> Any? {
        (await call("Runtime.evaluate", ["expression": expression, "returnByValue": true, "awaitPromise": true]))?["result"].flatMap { ($0 as? [String: Any])?["value"] }
    }
    private func receive() {
        task?.receive { [weak self] result in
            guard let self else { return }
            if case .success(.string(let text)) = result, let json = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] {
                DispatchQueue.main.async {
                    if let id = json["id"] as? Int, let reply = self.replies.removeValue(forKey: id) { reply(json["result"] as? [String: Any]) }
                    else if let method = json["method"] as? String { self.onEvent(method, json["params"] as? [String: Any] ?? [:]) }
                }
            }
            if case .failure = result { return }
            self.receive()
        }
    }
}

// The DevTools WebSocket of the first page target whose URL contains `match`, polled until the port answers.
func pageSocket(port: Int, match: String, tries: Int = 100) async -> URL? {
    for _ in 0..<tries {
        if let (data, _) = try? await URLSession.shared.data(from: URL(string: "http://127.0.0.1:\(port)/json")!),
           let targets = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
           let target = targets.first(where: { ($0["type"] as? String) == "page" && (($0["url"] as? String) ?? "").contains(match) }),
           let ws = (target["webSocketDebuggerUrl"] as? String).flatMap(URL.init(string:)) { return ws }
        try? await Task.sleep(nanoseconds: 200_000_000)
    }
    return nil
}

// MARK: - Copying the Spotify page

struct Bar: Codable { let x, y, w, h: Double }
struct Part: Codable { let file: String; let y: Double }
struct PageInfo: Codable { let width, height, viewHeight, dpr: Double; let bar: Bar; var parts: [Part] }

// Scrolls Spotify's main view a screen at a time with the player, sidebar and toolbar hidden and sticky headers
// unstuck, and saves each screen; the viewers stack them (later ones on top where they overlap). Without the mcloud
// theme in Spotify the bar goes where the theme puts it: 700pt wide, centred, 16pt above the bottom.
func snap(dir: URL, route: String) async {
    func fail(_ s: String) -> Never { FileHandle.standardError.write((s + "\n").data(using: .utf8)!); exit(1) }
    guard let ws = await pageSocket(port: spotifyPort, match: "xpui") else { fail("Spotify's DevTools port (\(spotifyPort)) did not answer.") }
    let dt = DevTools(); dt.connect(ws)
    _ = await dt.evaluate("window.Spicetify?.Platform?.History?.push(\(String(reflecting: route))), true")
    try? await Task.sleep(nanoseconds: 2_500_000_000)
    let geometry = await dt.evaluate("""
    (() => {
      const v = document.querySelector('.main-view-container__scroll-node [data-overlayscrollbars-viewport]') || document.querySelector('.main-view-container__scroll-node');
      if (!v) return null;
      v.setAttribute('data-sbs-scroll', ''); v.scrollTop = 0;
      const s = document.createElement('style'); s.id = 'sbs-style';
      s.textContent = '#am-player,#am-sidebar,#am-sidebar-glow,#global-nav-bar,.am-toast{visibility:hidden!important}';
      document.head.append(s);
      for (const e of v.querySelectorAll('*')) if (getComputedStyle(e).position === 'sticky') { e.setAttribute('data-sbs-sticky', ''); e.style.setProperty('position', 'relative', 'important'); e.style.setProperty('top', 'auto', 'important'); }
      const r = v.getBoundingClientRect(), p = document.getElementById('am-player')?.getBoundingClientRect(), w = Math.min(700, r.width - 64);
      const bar = p && p.width ? { x: p.left - r.left, y: p.top - r.top, w: p.width, h: p.height } : { x: Math.round((r.width - w) / 2), y: r.height - 16 - 54, w, h: 54 };
      return { left: r.left, top: r.top, width: Math.round(r.width), viewHeight: Math.round(r.height), height: v.scrollHeight, dpr: devicePixelRatio, bar };
    })()
    """) as? [String: Any]
    guard let g = geometry, let left = g["left"] as? Double, let top = g["top"] as? Double, let width = g["width"] as? Double,
          let viewHeight = g["viewHeight"] as? Double, let height = g["height"] as? Double, let dpr = g["dpr"] as? Double,
          let b = g["bar"] as? [String: Double] else { fail("Spotify's main view was not found.") }
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    var parts: [Part] = [], y = 0.0
    while true {
        _ = await dt.evaluate("document.querySelector('[data-sbs-scroll]').scrollTop = \(y)")
        try? await Task.sleep(nanoseconds: 900_000_000)
        let at = await dt.evaluate("document.querySelector('[data-sbs-scroll]').scrollTop") as? Double ?? y
        let shot = await dt.call("Page.captureScreenshot", ["format": "png", "clip": ["x": left, "y": top, "width": width, "height": viewHeight, "scale": 1]])
        guard let base64 = shot?["data"] as? String, let png = Data(base64Encoded: base64) else { fail("Spotify did not return a screenshot.") }
        let file = "part-\(parts.count).png"
        try! png.write(to: dir.appendingPathComponent(file)); parts.append(Part(file: file, y: at))
        print("  \(Int(at + viewHeight)) / \(Int(height))pt"); fflush(stdout)
        if y >= height - viewHeight { break }
        y = min(y + viewHeight - 40, height - viewHeight)
    }
    _ = await dt.evaluate("""
    document.getElementById('sbs-style')?.remove();
    for (const e of document.querySelectorAll('[data-sbs-sticky]')) { e.style.removeProperty('position'); e.style.removeProperty('top'); e.removeAttribute('data-sbs-sticky'); }
    { const v = document.querySelector('[data-sbs-scroll]'); v.scrollTop = 0; v.removeAttribute('data-sbs-scroll'); }
    """)
    let info = PageInfo(width: width, height: height, viewHeight: viewHeight, dpr: dpr, bar: Bar(x: b["x"]!, y: b["y"]!, w: b["w"]!, h: b["h"]!), parts: parts)
    try! JSONEncoder().encode(info).write(to: dir.appendingPathComponent("page.json"))
    exit(0)
}

if args.count > 1 && args[1] == "snap" {
    guard args.count > 2 else { print("usage: SideBySide snap <dir> [route]"); exit(2) }
    Task { await snap(dir: URL(fileURLWithPath: args[2]), route: args.count > 3 ? args[3] : "/") }
    dispatchMain()
}

// MARK: - The viewer

guard args.count > 2 else { print("usage: SideBySide <snap dir> <mcloud dir>  |  SideBySide snap <dir> [route]"); exit(2) }
let snapDir = URL(fileURLWithPath: args[1]), themeDir = URL(fileURLWithPath: args[2])
let info = try! JSONDecoder().decode(PageInfo.self, from: Data(contentsOf: snapDir.appendingPathComponent("page.json")))
// Each window shows the bar with 20pt of page on either side, at the height of Spotify's main view.
let margin = 20.0, viewW = info.bar.w + 2 * margin, viewH = info.viewHeight, cropX = info.bar.x - margin

final class Flipped: NSView { override var isFlipped: Bool { true } }

struct GlassBar: View {
    var body: some View {
        Color.clear.frame(width: info.bar.w, height: info.bar.h).glassEffect(.regular, in: Capsule()).environment(\.colorScheme, .dark)
    }
}

// Runs in Chrome once the theme has drawn its glass: the page in a full-window scroller under the player, the player
// moved to the native bar's spot with its controls hidden, and the scroll sync hooks.
let partsHTML = info.parts.map { "<img src=\(String(reflecting: snapDir.appendingPathComponent($0.file).absoluteString)) style=\"top:\($0.y)px\">" }.joined()
let setupScript = """
(async () => {
  await new Promise(r => { const t = () => document.querySelector('#am-glass feImage[href^="data:"]') ? r() : setTimeout(t, 100); t(); });
  document.title = 'mcloud (Chromium)';
  document.body.classList.add('am-liquid', 'sbs-bare');
  const css = document.createElement('style');
  css.textContent = `#sbs{position:fixed;inset:0;overflow-y:scroll;overflow-x:hidden;z-index:59;background:#121212;scrollbar-width:none}
    #sbs::-webkit-scrollbar{display:none}
    #sbs-page{position:relative;width:\(info.width)px;height:\(info.height)px;margin-left:\(-cropX)px}
    #sbs-page img{position:absolute;left:0;width:\(info.width)px;height:\(info.viewHeight)px}
    #am-sidebar,#am-sidebar-glow,.am-toast,#am-popover{display:none!important}
    #am-player{left:\(margin)px!important;top:\(info.bar.y)px!important;bottom:auto!important;width:\(info.bar.w)px!important;height:\(info.bar.h)px!important}
    body.sbs-bare #am-player>:not(.am-glass-rim){visibility:hidden}`;
  document.head.append(css);
  const box = document.createElement('div'); box.id = 'sbs';
  box.innerHTML = `<div id="sbs-page">\(partsHTML)</div>`; document.body.append(box);
  await Promise.all([...box.querySelectorAll('img')].map(i => i.decode()));
  let set = -1;
  box.addEventListener('scroll', () => { if (Math.abs(box.scrollTop - set) > .25) amScroll(String(box.scrollTop)); set = -1; }, { passive: true });
  window.sbsTo = y => { box.scrollTop = y; set = box.scrollTop; };
  return 'ready';
})()
"""

final class App: NSObject, NSApplicationDelegate {
    var window: NSWindow!, scroll: NSScrollView!, chrome: Process?, devtools = DevTools(), applyingRemote = false, chromePid: pid_t = 0

    func applicationDidFinishLaunching(_ n: Notification) {
        guard let screen = NSScreen.main?.visibleFrame else { return }
        let gap = 12.0, left = screen.midX - viewW - gap / 2, top = NSScreen.main!.frame.maxY - screen.maxY + 30
        window = NSWindow(contentRect: NSRect(x: left, y: 0, width: viewW, height: viewH), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Apple (macOS Liquid Glass)"; window.appearance = NSAppearance(named: .darkAqua)
        let root = NSView(frame: NSRect(x: 0, y: 0, width: viewW, height: viewH))
        scroll = NSScrollView(frame: root.bounds); scroll.hasVerticalScroller = false; scroll.verticalScrollElasticity = .none; scroll.horizontalScrollElasticity = .none
        scroll.drawsBackground = true; scroll.backgroundColor = NSColor(srgbRed: 18 / 255, green: 18 / 255, blue: 18 / 255, alpha: 1)
        let doc = Flipped(frame: NSRect(x: 0, y: 0, width: viewW, height: info.height))
        for part in info.parts {
            let image = NSImage(contentsOf: snapDir.appendingPathComponent(part.file))!; image.size = NSSize(width: info.width, height: info.viewHeight)
            let view = NSImageView(frame: NSRect(x: -cropX, y: part.y, width: info.width, height: info.viewHeight)); view.image = image; view.imageScaling = .scaleAxesIndependently
            doc.addSubview(view)
        }
        scroll.documentView = doc; root.addSubview(scroll)
        let bar = NSHostingView(rootView: GlassBar())
        bar.frame = NSRect(x: margin, y: viewH - info.bar.y - info.bar.h, width: info.bar.w, height: info.bar.h)
        root.addSubview(bar)
        window.contentView = root
        scroll.contentView.postsBoundsChangedNotifications = true
        NotificationCenter.default.addObserver(self, selector: #selector(scrolled), name: NSView.boundsDidChangeNotification, object: scroll.contentView)
        window.setFrameTopLeftPoint(NSPoint(x: left, y: NSScreen.main!.frame.maxY - top))
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        launchChrome(x: Int(screen.midX + gap / 2), top: Int(top))
        // Clicking Chrome would leave the native glass unfocused (a different look): hand focus back.
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let self, let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication, app.processIdentifier == self.chromePid else { return }
            NSApp.activate(ignoringOtherApps: true); self.window.makeKeyAndOrderFront(nil)
        }
    }

    @objc func scrolled() {
        guard !applyingRemote else { return }
        devtools.send("Runtime.evaluate", ["expression": "window.sbsTo && sbsTo(\(scroll.contentView.bounds.origin.y))"])
    }

    func scrollNative(to y: Double) {
        applyingRemote = true
        scroll.contentView.scroll(to: NSPoint(x: 0, y: min(max(0, y), info.height - viewH))); scroll.reflectScrolledClipView(scroll.contentView)
        applyingRemote = false
    }

    func launchChrome(x: Int, top: Int) {
        let profile = FileManager.default.temporaryDirectory.appendingPathComponent("sbs-chrome").path
        // The preview page is in Turkish; keep Chrome from offering a translation over it.
        try? FileManager.default.createDirectory(atPath: profile + "/Default", withIntermediateDirectories: true)
        try? #"{"translate":{"enabled":false},"browser":{"has_seen_welcome_page":true}}"#.write(toFile: profile + "/Default/Preferences", atomically: true, encoding: .utf8)
        let p = Process(); p.executableURL = URL(fileURLWithPath: chromeBinary)
        p.arguments = ["--user-data-dir=\(profile)", "--remote-debugging-port=\(chromePort)", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files",
                       "--disable-features=Translate", "--app=\(themeDir.appendingPathComponent("dev/preview.html").absoluteString)",
                       "--window-position=\(x),\(top)", "--window-size=\(Int(viewW)),\(Int(viewH) + 28)"]
        p.standardOutput = FileHandle.nullDevice; p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { print("Chrome did not start: \(chromeBinary)"); NSApp.terminate(nil); return }
        chrome = p; chromePid = p.processIdentifier
        Task { @MainActor in
            guard let ws = await pageSocket(port: chromePort, match: "preview.html") else { print("Chrome's DevTools port did not answer"); return }
            await self.setUp(ws)
        }
    }

    @MainActor func setUp(_ ws: URL) async {
        devtools.onEvent = { [weak self] method, params in
            guard let self, method == "Runtime.bindingCalled", params["name"] as? String == "amScroll", let y = Double(params["payload"] as? String ?? "") else { return }
            self.scrollNative(to: y)
        }
        devtools.connect(ws)
        _ = await devtools.call("Runtime.enable")
        _ = await devtools.call("Runtime.addBinding", ["name": "amScroll"])
        // Size Chrome's window so its page area is exactly the native window's, then pin the viewport to it.
        if let frame = await devtools.evaluate("[outerWidth - innerWidth, outerHeight - innerHeight]") as? [Double], frame.count == 2,
           let id = (await devtools.call("Browser.getWindowForTarget"))?["windowId"] as? Int {
            _ = await devtools.call("Browser.setWindowBounds", ["windowId": id, "bounds": ["width": Int(viewW + frame[0]), "height": Int(viewH + frame[1])]])
        }
        _ = await devtools.call("Emulation.setDeviceMetricsOverride", ["width": Int(viewW), "height": Int(viewH), "deviceScaleFactor": 0, "mobile": false])
        print("Chrome:", await devtools.evaluate(setupScript) ?? "no reply"); fflush(stdout)
        devtools.send("Runtime.evaluate", ["expression": "sbsTo(\(scroll.contentView.bounds.origin.y))"])
        NSApp.activate(ignoringOtherApps: true); window.makeKeyAndOrderFront(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ n: Notification) { chrome?.terminate() }
}

let app = NSApplication.shared
let delegate = App(); app.delegate = delegate; app.setActivationPolicy(.regular); app.run()
