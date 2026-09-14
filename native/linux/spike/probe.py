#!/usr/bin/env python3
"""
Stage D.1 spike — item 4: walk the AT-SPI2 tree for any running browser and
print every role/value found, so a human can judge whether the address bar
is actually reachable as an editable text node.

This is a diagnostic, not the resolver. It intentionally:
  - never guesses at an element by its accessible *name/label* (labels are
    localized; Step 19/CLAUDE.md's own resolver must key on role+position,
    but this spike just dumps everything so a human can decide what a real
    resolver could key on),
  - times out per-application rather than hanging forever — AT-SPI walks on
    Linux are known to hang on a misbehaving app, and this must still exit
    and report to stdout even in the worst case,
  - never touches or clicks anything; read-only introspection.

Exit codes (probe.sh reads these to classify the finding, not the report
tone — the printed report is what a human should actually read):
  0  walked successfully (a browser being unreachable is still success —
     see WALK RESULT lines below for the actual per-browser finding)
  2  pyatspi could not be imported at all
  3  the AT-SPI registry/desktop could not be reached at all
  4  no application matching a known browser name was found running
"""

from __future__ import annotations

import signal
import sys

BROWSER_NAME_NEEDLES = (
    "chrome",
    "chromium",
    "firefox",
    "brave",
    "vivaldi",
    "opera",
    "edge",
)

# Bounds so a pathological tree (or a genuinely huge one — Firefox's own
# UI tree is not small) can't make this spike run forever or dump gigabytes.
MAX_DEPTH = 12
MAX_NODES_PER_APP = 400
PER_APP_TIMEOUT_SECONDS = 10

# Roles worth calling out specifically — an address bar is (almost always)
# an ENTRY, but PANEL/TOOL_BAR ancestry helps a human spot it in the dump
# even if a given browser/toolkit version reports something else.
INTERESTING_ROLES = {"entry", "text", "tool bar", "toolbar", "panel"}


class WalkTimeout(Exception):
    pass


def _raise_timeout(signum, frame):  # noqa: ARG001 — required signal handler shape
    raise WalkTimeout()


def safe_name(obj) -> str:
    try:
        return obj.name or ""
    except Exception as exc:  # AT-SPI can throw on a dead/zombie accessible
        return f"<error reading name: {exc}>"


def safe_role_name(obj) -> str:
    try:
        return obj.getRoleName()
    except Exception as exc:
        return f"<error reading role: {exc}>"


def safe_text_value(obj) -> str | None:
    """Best-effort: pull the text content of an editable/text accessible, if any."""
    try:
        iface = obj.queryText()
    except Exception:
        return None
    try:
        count = iface.characterCount
        return iface.getText(0, count)
    except Exception as exc:
        return f"<error reading text: {exc}>"


def walk(obj, depth: int, out: list[str], budget: list[int]) -> None:
    if budget[0] <= 0 or depth > MAX_DEPTH:
        return
    budget[0] -= 1

    role = safe_role_name(obj)
    name = safe_name(obj)
    text_value = safe_text_value(obj)

    marker = " <-- INTERESTING ROLE" if role.lower() in INTERESTING_ROLES else ""
    line = f"{'  ' * depth}role={role!r} name={name!r}"
    if text_value is not None:
        line += f" text={text_value!r}"
    line += marker
    out.append(line)

    try:
        child_count = obj.childCount
    except Exception as exc:
        out.append(f"{'  ' * (depth + 1)}<error reading childCount: {exc}>")
        return

    for i in range(child_count):
        if budget[0] <= 0:
            out.append(f"{'  ' * (depth + 1)}... truncated at {MAX_NODES_PER_APP} nodes ...")
            return
        try:
            child = obj.getChildAtIndex(i)
        except Exception as exc:
            out.append(f"{'  ' * (depth + 1)}<error reading child {i}: {exc}>")
            continue
        if child is None:
            continue
        walk(child, depth + 1, out, budget)


def main() -> int:
    print("=" * 72)
    print("Item 4 — AT-SPI2 tree walk for running browsers")
    print("=" * 72)

    try:
        import pyatspi  # noqa: PLC0415 — deliberately deferred so the import
        # failure itself is the first thing this reports, cleanly.
    except ImportError as exc:
        print(f"FAILED to import pyatspi: {exc}")
        print()
        print("pyatspi is not installed (or not on this interpreter's path).")
        print("Debian/Ubuntu: sudo apt install python3-pyatspi")
        print("Fedora:        sudo dnf install python3-pyatspi")
        print("  (package name confirmed on Debian/Ubuntu; Fedora's exact package")
        print("   may differ by release — if this fails, try "
              "'sudo dnf install python3-gobject at-spi2-core' instead and")
        print("   re-run this probe to confirm.)")
        print()
        print("VERDICT: item 4 INCONCLUSIVE — pyatspi unavailable, install and re-run.")
        return 2

    try:
        desktop = pyatspi.Registry.getDesktop(0)
    except Exception as exc:
        print(f"FAILED to reach the AT-SPI desktop/registry: {exc}")
        print("VERDICT: item 4 FAILED — AT-SPI registry unreachable (see item 3's")
        print("bus/toolkit-accessibility check above for the likely cause).")
        return 3

    try:
        app_count = desktop.childCount
    except Exception as exc:
        print(f"FAILED to enumerate applications on the AT-SPI desktop: {exc}")
        print("VERDICT: item 4 FAILED.")
        return 3

    print(f"AT-SPI desktop reports {app_count} top-level application(s):")
    apps = []
    for i in range(app_count):
        try:
            app = desktop.getChildAtIndex(i)
        except Exception as exc:
            print(f"  [{i}] <error reading application: {exc}>")
            continue
        name = safe_name(app)
        print(f"  [{i}] {name!r}")
        apps.append((name, app))
    print()

    browser_apps = [
        (name, app)
        for name, app in apps
        if any(needle in name.lower() for needle in BROWSER_NAME_NEEDLES)
    ]

    if not browser_apps:
        print("No running application matched a known browser name "
              f"({', '.join(BROWSER_NAME_NEEDLES)}).")
        print("If a browser IS running, it may be sandboxed (snap/flatpak) in a way")
        print("that keeps it off the AT-SPI desktop's application list — check")
        print("whether it still appears once launched from a non-sandboxed package,")
        print("since this is a known confound, not necessarily a dead end.")
        print("VERDICT: item 4 INCONCLUSIVE — no browser found running.")
        return 4

    overall_found_entry = False
    signal.signal(signal.SIGALRM, _raise_timeout)
    for name, app in browser_apps:
        print("-" * 72)
        print(f"WALK for application {name!r}:")
        out: list[str] = []
        budget = [MAX_NODES_PER_APP]
        signal.alarm(PER_APP_TIMEOUT_SECONDS)
        try:
            walk(app, 0, out, budget)
            timed_out = False
        except WalkTimeout:
            timed_out = True
        finally:
            signal.alarm(0)

        for line in out:
            print(line)

        if timed_out:
            print(f"WALK RESULT for {name!r}: TIMED OUT after "
                  f"{PER_APP_TIMEOUT_SECONDS}s — treat as a fragility finding, "
                  "not a hard failure.")
            continue

        found_entry = any("INTERESTING ROLE" in line and "role='entry'" in line.lower()
                           for line in out)
        overall_found_entry = overall_found_entry or found_entry
        print(f"WALK RESULT for {name!r}: "
              f"{'an ENTRY-role node was found' if found_entry else 'NO entry-role node found'}"
              " — inspect the roles/text above to judge whether any of them is the address bar.")

    print("-" * 72)
    if overall_found_entry:
        print("VERDICT: item 4 PROMISING — at least one browser exposed an ENTRY-role")
        print("node; a human still needs to confirm one of them is actually the address")
        print("bar (by role+toolbar position, per Step 19/CLAUDE.md — never by label).")
    else:
        print("VERDICT: item 4 NOT CONFIRMED on this run — no ENTRY-role node found in")
        print("any running browser's tree. Re-run with a browser window focused/visible")
        print("(some toolkits lazily build parts of the AT-SPI tree) before concluding")
        print("this platform can't support Stage D.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
