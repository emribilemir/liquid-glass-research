// sections <framework path> <out.txt>: loads a framework from the shared cache and dumps the strings in its
// __cstring, __swift5_typeref, __swift5_reflstr and __objc_methname sections.
import Foundation
import MachO
let path = CommandLine.arguments[1], out = CommandLine.arguments[2]
guard dlopen(path, RTLD_LAZY) != nil else { print("dlopen failed", String(cString: dlerror())); exit(1) }
var text = ""
for i in 0..<_dyld_image_count() {
  guard let name = _dyld_get_image_name(i), String(cString: name).hasSuffix(path.components(separatedBy: "/").last!) else { continue }
  let header = UnsafeRawPointer(_dyld_get_image_header(i)!).assumingMemoryBound(to: mach_header_64.self)
  for (seg, sect) in [("__TEXT", "__cstring"), ("__TEXT", "__swift5_typeref"), ("__TEXT", "__swift5_reflstr"), ("__TEXT", "__objc_methname"), ("__TEXT", "__swift5_fieldmd")] {
    var size: UInt = 0
    guard let p = getsectiondata(header, seg, sect, &size) else { continue }
    var cur = [UInt8]()
    for k in 0..<Int(size) { let b = p[k]; if b >= 32 && b < 127 { cur.append(b) } else { if cur.count >= 4 { text += sect + "\t" + String(decoding: cur, as: UTF8.self) + "\n" }; cur = [] } }
  }
}
try! text.write(toFile: out, atomically: true, encoding: .utf8)
print("lines", text.split(separator: "\n").count)
