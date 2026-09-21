// swift-tools-version:5.7
//
// A hard gate, not a hint: 5.9 needs Xcode 15, which needs macOS 13, so it made
// macOS 12 an unsupported build host for a binary targeting macOS 11+. Nothing
// here needs past 5.7, and newer toolchains build a 5.7 package fine.
//
// Editors and SwiftPM only — build.sh compiles with swiftc and never reads this.
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
