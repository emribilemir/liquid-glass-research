// rec <script> <outdir> [x y w h]: records Apple Music's window (ScreenCaptureKit, 60fps, cursor hidden) while posting
// the mouse/key steps in <script>, one per line, in window points (origin top-left):
// REC_DISPLAY=1 records the display instead (Music's windows only, so its menus and popovers show); the crop rect
// stays in window points.
//   move x y [ms]   down   up   drag x y [ms]   wait ms   key esc|left|right|cmd-[|cmd-]   activate
// Frames go to <outdir>/fNNNN.png (cropped to the optional window-point rect), times to <outdir>/timeline.tsv
// (seconds since start: "frame i t" and "event name x y t").
import AppKit
import ScreenCaptureKit
import CoreMedia

let args = CommandLine.arguments
let steps = try! String(contentsOfFile: args[1], encoding: .utf8).split(separator: "\n").map { $0.split(separator: " ").map(String.init) }.filter { !$0.isEmpty && !$0[0].hasPrefix("#") }
let out = args[2]
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
let crop: CGRect? = args.count >= 7 ? CGRect(x: Double(args[3])!, y: Double(args[4])!, width: Double(args[5])!, height: Double(args[6])!) : nil

let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Music").first!
app.activate()
usleep(500_000)
func now() -> Double { CMClockGetTime(CMClockGetHostTimeClock()).seconds }

final class Sink: NSObject, SCStreamOutput {
  var frames: [(Double, CGImage)] = []
  let ctx = CIContext()
  func stream(_ s: SCStream, didOutputSampleBuffer sb: CMSampleBuffer, of type: SCStreamOutputType) {
    guard type == .screen, let pb = sb.imageBuffer,
          let att = (CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]])?.first,
          let raw = att[.status] as? Int, SCFrameStatus(rawValue: raw) == .complete else { return }
    let img = ctx.createCGImage(CIImage(cvPixelBuffer: pb), from: CGRect(x: 0, y: 0, width: CVPixelBufferGetWidth(pb), height: CVPixelBufferGetHeight(pb)))!
    frames.append((sb.presentationTimeStamp.seconds, img))
  }
}

var log = ""
let sink = Sink()
let sem = DispatchSemaphore(value: 0)
var stream: SCStream!
var origin = CGPoint.zero, scale = 2.0
Task {
  let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
  let w = content.windows.first { $0.owningApplication?.bundleIdentifier == "com.apple.Music" && $0.windowLayer == 0 && $0.frame.width > 300 }!
  origin = w.frame.origin
  let wholeDisplay = ProcessInfo.processInfo.environment["REC_DISPLAY"] == "1"
  let display = content.displays.first { $0.frame.contains(w.frame.origin) }!
  let filter = wholeDisplay ? SCContentFilter(display: display, including: content.applications.filter { $0.bundleIdentifier == "com.apple.Music" }, exceptingWindows: [])
                            : SCContentFilter(desktopIndependentWindow: w)
  scale = Double(filter.pointPixelScale)
  let cfg = SCStreamConfiguration()
  var r = crop ?? CGRect(origin: .zero, size: w.frame.size)
  if wholeDisplay { r.origin.x += w.frame.minX - display.frame.minX; r.origin.y += w.frame.minY - display.frame.minY }
  cfg.sourceRect = r
  cfg.width = Int(r.width * scale); cfg.height = Int(r.height * scale)
  cfg.minimumFrameInterval = CMTime(value: 1, timescale: 60)
  cfg.showsCursor = false
  cfg.queueDepth = 8
  cfg.colorSpaceName = CGColorSpace.sRGB
  stream = SCStream(filter: filter, configuration: cfg, delegate: nil)
  try stream.addStreamOutput(sink, type: .screen, sampleHandlerQueue: DispatchQueue(label: "rec"))
  try await stream.startCapture()
  sem.signal()
}
sem.wait()
let t0 = now()
usleep(300_000)

var pos = CGPoint(x: 0, y: 0), isDown = false
func scr(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: origin.x + x, y: origin.y + y) }
func post(_ type: CGEventType, _ p: CGPoint) {
  let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left)!
  if type == .leftMouseDown || type == .leftMouseUp || type == .leftMouseDragged { e.setIntegerValueField(.mouseEventClickState, value: 1) }
  e.post(tap: .cghidEventTap)
}
func mark(_ name: String) { log += String(format: "event %@ %.1f %.1f %.4f\n", name, pos.x, pos.y, now() - t0) }
func glide(to x: Double, _ y: Double, ms: Double) {
  let from = pos, n = max(1, Int(ms / 8))
  for i in 1...n {
    let k = Double(i) / Double(n)
    pos = CGPoint(x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k)
    post(isDown ? .leftMouseDragged : .mouseMoved, scr(pos.x, pos.y))
    if n > 1 { usleep(8_000) }
  }
}
func key(_ code: CGKeyCode, cmd: Bool = false) {
  for d in [true, false] { let e = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: d)!; if cmd { e.flags = .maskCommand }; e.post(tap: .cghidEventTap); usleep(20_000) }
}
for s in steps {
  switch s[0] {
  case "move", "drag":
    if s[0] == "move" && pos == .zero { pos = CGPoint(x: Double(s[1])!, y: Double(s[2])!) }
    mark(s[0] + "-start"); glide(to: Double(s[1])!, Double(s[2])!, ms: s.count > 3 ? Double(s[3])! : 0); mark(s[0] + "-end")
  case "down": isDown = true; post(.leftMouseDown, scr(pos.x, pos.y)); mark("down")
  case "up": isDown = false; post(.leftMouseUp, scr(pos.x, pos.y)); mark("up")
  case "wait": usleep(useconds_t(Double(s[1])! * 1000))
  case "activate": app.activate(); usleep(300_000); mark("activate")
  case "key":
    switch s[1] { case "esc": key(53); case "left": key(123); case "right": key(124); case "cmd-[": key(33, cmd: true); case "cmd-]": key(30, cmd: true); default: break }
    mark("key-" + s[1])
  default: print("unknown step", s)
  }
}
usleep(400_000)
let done = DispatchSemaphore(value: 0)
Task { try? await stream.stopCapture(); done.signal() }
done.wait()
for (i, (t, img)) in sink.frames.enumerated() {
  log += String(format: "frame %d %.4f\n", i, t - t0)
  let url = URL(fileURLWithPath: String(format: "%@/f%04d.png", out, i))
  let d = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(d, img, nil); CGImageDestinationFinalize(d)
}
try! log.write(toFile: out + "/timeline.tsv", atomically: true, encoding: .utf8)
print("frames", sink.frames.count, "scale", scale, "origin", origin)
