import AppKit
import CoreImage
import Foundation

guard let origin = ProcessInfo.processInfo.environment["NEXT_PUBLIC_QA_ORIGIN"],
      let base = URL(string: origin), base.scheme == "https",
      let destination = URL(string: "/check-in/demo-bar", relativeTo: base)?.absoluteURL else {
  fputs("NEXT_PUBLIC_QA_ORIGIN must be an HTTPS origin.\n", stderr)
  exit(1)
}

guard let filter = CIFilter(name: "CIQRCodeGenerator") else {
  fputs("Could not create QR generator.\n", stderr)
  exit(1)
}
filter.setValue(destination.absoluteString.data(using: .utf8), forKey: "inputMessage")
filter.setValue("M", forKey: "inputCorrectionLevel")
guard let image = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)) else {
  fputs("Could not generate QR image.\n", stderr)
  exit(1)
}

let output = URL(fileURLWithPath: "apps/consumer/public/qa-checkin.png")
try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
let nsImage = NSImage(size: image.extent.size)
nsImage.lockFocus()
CIContext().draw(image, in: NSRect(origin: .zero, size: image.extent.size), from: image.extent)
nsImage.unlockFocus()
guard let tiff = nsImage.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Could not encode QR PNG.\n", stderr)
  exit(1)
}
try png.write(to: output)
print("QR generated for \(destination.absoluteString)")
