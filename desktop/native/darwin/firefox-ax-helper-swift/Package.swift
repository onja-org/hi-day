// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "firefox-ax-helper",
    platforms: [.macOS(.v11)],
    targets: [
        .executableTarget(
            name: "firefox-ax-helper",
            path: "Sources/firefox-ax-helper",
            linkerSettings: [.linkedFramework("ApplicationServices")]
        )
    ]
)
