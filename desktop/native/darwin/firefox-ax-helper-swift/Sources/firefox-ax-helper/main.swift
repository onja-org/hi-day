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

/// Identifies the address bar by AX role and position in the toolbar
/// subtree — NEVER by an English label, since Firefox's UI is localized and
/// a label-based match would silently fail (or worse, match the wrong
/// field) on any non-English build.
func firstDescendant(of element: AXUIElement, role: String) -> AXUIElement? {
    guard let childrenValue = axValue(element, kAXChildrenAttribute as String),
          let children = childrenValue as? [AXUIElement] else {
        return nil
    }

    for child in children {
        if let childRole = axValue(child, kAXRoleAttribute as String) as? String, childRole == role {
            return child
        }
    }
    for child in children {
        if let found = firstDescendant(of: child, role: role) {
            return found
        }
    }
    return nil
}

func findAddressField(in window: AXUIElement) -> AXUIElement? {
    guard let toolbar = firstDescendant(of: window, role: "AXToolbar") else { return nil }
    return firstDescendant(of: toolbar, role: "AXTextField")
}

/// No-prompt permission check — AXIsProcessTrusted() (unlike
/// AXIsProcessTrustedWithOptions with the prompt option) never shows a
/// dialog, so the agent can decide whether to even offer Firefox support
/// without surprising the user.
func checkPermission() {
    printJSON(["granted": AXIsProcessTrusted()])
}

func resolve(pid: pid_t) {
    guard AXIsProcessTrusted() else {
        fail("permission-denied", "Accessibility permission has not been granted.")
    }

    let app = AXUIElementCreateApplication(pid)

    guard let windowValue = axValue(app, kAXFocusedWindowAttribute as String) else {
        fail("no-window", "Firefox has no focused window.")
    }
    // AXUIElement is a CFType; AXUIElementCopyAttributeValue for a window
    // attribute always yields one on success.
    // swiftlint:disable:next force_cast
    let window = windowValue as! AXUIElement

    guard let titleValue = axValue(window, kAXTitleAttribute as String) as? String else {
        fail("no-window", "Could not read the window title.")
    }

    guard let field = findAddressField(in: window) else {
        fail("field-not-found", "Could not locate the address bar field in the toolbar.")
    }

    guard let rawValue = axValue(field, kAXValueAttribute as String) as? String else {
        fail("field-not-found", "Address bar field has no readable value.")
    }

    printJSON(["ok": true, "value": rawValue, "title": titleValue])
}

let arguments = CommandLine.arguments
guard arguments.count >= 2 else {
    fail("bad-invocation", "Usage: firefox-ax-helper check-permission | resolve <pid>")
}

switch arguments[1] {
case "check-permission":
    checkPermission()
case "resolve":
    guard arguments.count >= 3, let pid = pid_t(arguments[2]) else {
        fail("bad-invocation", "resolve requires a numeric pid argument.")
    }
    resolve(pid: pid)
default:
    fail("bad-invocation", "Unknown command: \(arguments[1])")
}
