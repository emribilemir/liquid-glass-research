// Captures the display composed of only the given windows (others left out), so a covered window is seen with
// whatever lies behind it, without bringing anything forward. Usage: sck <out.png> <window number>...
import AppKit
import ScreenCaptureKit
let args = CommandLine.arguments, out = args[1], ids = Set(args.dropFirst(2).compactMap { UInt32($0) })
let sem = DispatchSemaphore(value: 0)
Task {
  do {
    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
    let display = content.displays[0], wins = content.windows.filter { ids.contains($0.windowID) }
    print("windows:", wins.map { "\($0.owningApplication?.applicationName ?? "?") \($0.windowID)" })
    let filter = SCContentFilter(display: display, including: wins)
    let cfg = SCStreamConfiguration(); cfg.width = display.width * 2; cfg.height = display.height * 2; cfg.showsCursor = false
    let img = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: cfg)
    let rep = NSBitmapImageRep(cgImage: img); try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
    print("saved", img.width, img.height)
  } catch { print("error", error) }
  sem.signal()
}
sem.wait()
