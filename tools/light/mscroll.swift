// mscroll <0..1>: sets the vertical scroll bar of Music's main content scroll area (the widest one left of the queue)
import AppKit
import ApplicationServices
guard let app=NSRunningApplication.runningApplications(withBundleIdentifier:"com.apple.Music").first else {exit(1)}
let root=AXUIElementCreateApplication(app.processIdentifier)
func attr(_ e:AXUIElement,_ a:String)->AnyObject?{var v:AnyObject?;return AXUIElementCopyAttributeValue(e,a as CFString,&v) == .success ? v : nil}
func kids(_ e:AXUIElement)->[AXUIElement]{ (attr(e,"AXChildren") as? [AXUIElement]) ?? [] }
func size(_ e:AXUIElement)->CGSize{var s=CGSize.zero;if let v=attr(e,"AXSize"){AXValueGetValue(v as! AXValue,.cgSize,&s)};return s}
var best:AXUIElement?;var bw:CGFloat=0
func walk(_ e:AXUIElement,_ d:Int){ if (attr(e,"AXRole") as? String)=="AXScrollArea"{let s=size(e);let id=(attr(e,"AXDescription") as? String) ?? "";if s.width>bw && s.width<1100 && id != "sidebarScroller" {bw=s.width;best=e}}; if d<7 {for k in kids(e){walk(k,d+1)}}}
walk(root,0)
guard let sa=best else {print("none");exit(1)}
for k in kids(sa) where (attr(k,"AXRole") as? String)=="AXScrollBar" {
  let v=Double(CommandLine.arguments[1])!
  print("set",AXUIElementSetAttributeValue(k,"AXValue" as CFString,NSNumber(value:v)).rawValue, attr(k,"AXValue") ?? "-")
}
