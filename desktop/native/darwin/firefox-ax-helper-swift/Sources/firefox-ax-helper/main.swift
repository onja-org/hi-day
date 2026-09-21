// firefox-ax-helper — reads Firefox's address bar via the Accessibility API,
// since Firefox has no AppleScript URL support (Mozilla bugs 369901 /
// 516502). See docs/url-tracking-plan.md Step 10 and Prompt B.2.
//
// NOT COMPILED OR RUN ON REAL HARDWARE BY THE AGENT THAT WROTE THIS — there
// is no macOS/Xcode toolchain available in this environment. The APIs used
// (AXUIElementCreateApplication, AXUIElementCopyAttributeValue, the AX*
// attribute/role constants, AXIsProcessTrusted) are stable, long-documented
// Apple APIs, but the exact tree-walking behavior against a real Firefox
// window has not been observed. Verify against real hardware before relying
// on this — see docs/url-tracking-plan.md Step 29's test matrix.
//
// There is deliberately no `check-permission` subcommand: Electron's
// systemPreferences.isTrustedAccessibilityClient(false) answers exactly
// what AXIsProcessTrusted() would, from the main process, with no
// subprocess to spawn — see readDarwinPermissions() in main.ts.
//
// Deliberately dumb: this prints the raw toolbar field value and the raw
// window title, nothing more. It does NOT decide private-mode (that's done
// from the title on the TypeScript side, against a per-locale marker table
// that's easy to extend without recompiling this binary) and does NOT
// normalize the URL (Stage E's job).

import ApplicationServices
import Foundation

func printJSON(_ dict: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: dict),
          let text = String(data: data, encoding: .utf8) else {
        // If we can't even serialize a failure, there's nothing more to do.
        FileHandle.standardError.write("firefox-ax-helper: failed to serialize output\n".data(using: .utf8)!)
        exit(1)
    }
    print(text)
}

func fail(_ code: String, _ message: String) -> Never {
    printJSON(["ok": false, "code": code, "message": message])
    exit(1)
}

func axValue(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: AnyObject?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    return result == .success ? value : nil
}

/// Asks the app to switch its accessibility layer on — the handshake an
/// assistive tool performs, and what VoiceOver does. Firefox builds its tree
/// lazily and ignores a client that only reads, so without this it reports
/// `Activated: false` and exposes a window with no children.
///
/// Per-process, not a system-wide screen-reader switch. Results are ignored:
/// an app that does not support the attribute answers with an error, which is
/// not a failure worth reporting.
func enableAccessibility(for app: AXUIElement) {
    AXUIElementSetAttributeValue(app, "AXEnhancedUserInterface" as CFString, true as CFTypeRef)
    AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, true as CFTypeRef)
}

/// Every descendant matching one of `roles`, depth-capped — a Firefox window's
/// tree includes rendered page content and is enormous.
func descendants(
    of element: AXUIElement,
    matching roles: Set<String>,
    depth: Int = 0,
    limit: Int = 6
) -> [AXUIElement] {
    guard depth <= limit,
          let childrenValue = axValue(element, kAXChildrenAttribute as String),
          let children = childrenValue as? [AXUIElement] else {
        return []
    }

    var found: [AXUIElement] = []
    for child in children {
        if let role = axValue(child, kAXRoleAttribute as String) as? String, roles.contains(role) {
            found.append(child)
        }
        found.append(contentsOf: descendants(of: child, matching: roles, depth: depth + 1, limit: limit))
    }
    return found
}

/// Gecko's URL bar is an AXComboBox — it carries the autocomplete dropdown —
/// and it sits in the second toolbar, not the first, which holds the tabs. Both
/// assumptions were wrong before, and either alone was enough to find nothing.
/// A candidate needs a non-empty value so an empty decoration cannot win.
func findAddressField(in window: AXUIElement) -> AXUIElement? {
    for toolbar in descendants(of: window, matching: ["AXToolbar"]) {
        for candidate in descendants(of: toolbar, matching: ["AXComboBox", "AXTextField"]) {
            if let value = axValue(candidate, kAXValueAttribute as String) as? String, !value.isEmpty {
                return candidate
            }
        }
    }
    return nil
}

func resolve(pid: pid_t) {
    guard AXIsProcessTrusted() else {
        fail("permission-denied", "Accessibility permission has not been granted.")
    }

    let app = AXUIElementCreateApplication(pid)
    enableAccessibility(for: app)

    guard let windowValue = axValue(app, kAXFocusedWindowAttribute as String) else {
        fail("no-window", "Firefox has no focused window.")
    }

    let window = windowValue as! AXUIElement

    guard let titleValue = axValue(window, kAXTitleAttribute as String) as? String else {
        fail("no-window", "Could not read the window title.")
    }

    var field = findAddressField(in: window)
    if field == nil {
        Thread.sleep(forTimeInterval: 0.4)
        field = findAddressField(in: window)
    }
    guard let field = field else {
        fail("field-not-found", "Could not locate the address bar field in the toolbar.")
    }

    guard let rawValue = axValue(field, kAXValueAttribute as String) as? String else {
        fail("field-not-found", "Address bar field has no readable value.")
    }

    printJSON(["ok": true, "value": rawValue, "title": titleValue])
}

func dumpTree(_ element: AXUIElement, depth: Int, maxDepth: Int, indent: String) {
    guard depth <= maxDepth else { return }

    let role = axValue(element, kAXRoleAttribute as String) as? String ?? "?"
    var line = "\(indent)\(role)"
    if let subrole = axValue(element, "AXSubrole") as? String {
        line += " subrole=\(subrole)"
    }
    if let identifier = axValue(element, "AXIdentifier") as? String {
        line += " id=\(identifier)"
    }
    // Presence only. The value of an address bar is the URL.
    if let value = axValue(element, kAXValueAttribute as String) as? String {
        line += " hasValue=\(value.isEmpty ? "empty" : "yes")"
    }

    let children = (axValue(element, kAXChildrenAttribute as String) as? [AXUIElement]) ?? []
    line += " children=\(children.count)"
    FileHandle.standardError.write((line + "\n").data(using: .utf8)!)

    // Capped: a Firefox window's full tree includes rendered page content and
    // is enormous. The chrome we care about sits near the top.
    for child in children.prefix(12) {
        dumpTree(child, depth: depth + 1, maxDepth: maxDepth, indent: indent + "  ")
    }
}

func dump(pid: pid_t, delaySeconds: Double) {
    if delaySeconds > 0 {
        FileHandle.standardError.write(
            "Waiting \(Int(delaySeconds))s — click the browser now.\n".data(using: .utf8)!)
        Thread.sleep(forTimeInterval: delaySeconds)
    }
    guard AXIsProcessTrusted() else {
        fail("permission-denied", "Accessibility permission has not been granted.")
    }
    let app = AXUIElementCreateApplication(pid)
    enableAccessibility(for: app)
    Thread.sleep(forTimeInterval: 0.5)

    var windowValue = axValue(app, kAXFocusedWindowAttribute as String)
    if windowValue == nil,
       let windows = axValue(app, kAXWindowsAttribute as String) as? [AXUIElement],
       let first = windows.first {
        FileHandle.standardError.write(
            "(no focused window — dumping the first of \(windows.count))\n".data(using: .utf8)!)
        windowValue = first as AnyObject
    }
    guard let window = windowValue else {
        fail("no-window", "Firefox has no windows at all.")
    }
    // swiftlint:disable:next force_cast
    dumpTree(window as! AXUIElement, depth: 0, maxDepth: 5, indent: "")
    printJSON(["ok": true, "value": "", "title": ""])
}

let arguments = CommandLine.arguments
guard arguments.count >= 2 else {
    fail("bad-invocation", "Usage: firefox-ax-helper resolve <pid> | dump <pid> [delaySeconds]")
}

switch arguments[1] {
case "resolve":
    guard arguments.count >= 3, let pid = pid_t(arguments[2]) else {
        fail("bad-invocation", "resolve requires a numeric pid argument.")
    }
    resolve(pid: pid)
case "dump":
    guard arguments.count >= 3, let pid = pid_t(arguments[2]) else {
        fail("bad-invocation", "dump requires a numeric pid argument.")
    }
    // Optional: seconds to wait before inspecting, so the browser can be
    // brought to the front first.
    let delay = arguments.count >= 4 ? (Double(arguments[3]) ?? 0) : 0
    dump(pid: pid, delaySeconds: delay)
default:
    fail("bad-invocation", "Unknown command: \(arguments[1])")
}
