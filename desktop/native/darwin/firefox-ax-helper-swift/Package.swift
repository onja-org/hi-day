// swift-tools-version:5.7
//
// 5.7 is the floor this package actually needs, not 5.9 as originally
// declared. Nothing here requires anything newer: .executableTarget landed in
// 5.4, .macOS(.v11) in 5.3, .linkedFramework in 5.0, and main.swift uses no
// syntax past 5.7.
//
// The declared version matters because it is a hard gate, not a hint. Swift
// 5.9 needs Xcode 15, which needs macOS 13 — so 5.9 silently made macOS 12 an
// unsupported BUILD host, while the binary itself targets macOS 11 and up.
// A Monterey machine with Command Line Tools has Swift 5.7.1 and was refused
// outright:
//
//   package is using Swift tools version 5.9.0 but the installed version is 5.7.1
//
// Newer toolchains build a 5.7 package fine, so this only widens the range.
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
