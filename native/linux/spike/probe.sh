#!/usr/bin/env bash
# Stage D.1 — Linux feasibility spike (see docs/url-tracking-plan.md Steps
# 18-20 and URL_TRACKING_CONTEXT.md). Diagnostic only — does not install
# anything, does not talk to any browser beyond read-only AT-SPI
# introspection, and builds no resolver. Safe to run on a real desktop.
#
# USAGE
#   ./probe.sh
#
# Run this on each target environment separately and keep the full output
# of each — the decision in docs/url-tracking-plan.md's Step 20 needs a
# real verdict per environment, not one machine's result generalized:
#
#   Ubuntu, GNOME, Wayland (the default GNOME session since Ubuntu 22.04):
#     just run it in a normal login session — this is what most users hit.
#
#   Ubuntu, Xorg:
#     log out, click the gear icon on the login screen, choose
#     "Ubuntu on Xorg" (or "GNOME on Xorg"), log back in, then run it.
#
#   Fedora Workstation (GNOME, Wayland by default):
#     run it the same way as Ubuntu GNOME Wayland above. Fedora's package
#     names differ (dnf, not apt) — the script reports the right install
#     command for whichever it detects it needs.
#
# This script degrades gracefully when a tool it wants (gdbus, gsettings,
# wmctrl, python3) is missing — it reports that plainly and moves on
# rather than aborting, since the whole point is to find out what a real
# target machine actually has.

set -u
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

hr() { printf '%.0s=' {1..72}; printf '\n'; }

have() { command -v "$1" >/dev/null 2>&1; }

hr
echo "Stage D.1 Linux feasibility spike"
echo "host: $(hostname 2>/dev/null || echo unknown)"
echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
hr
echo

# --- Item 1: session type and compositor -------------------------------
echo "Item 1 — session type and compositor"
echo "--------------------------------------"
echo "XDG_SESSION_TYPE   = ${XDG_SESSION_TYPE:-<unset>}"
echo "XDG_CURRENT_DESKTOP= ${XDG_CURRENT_DESKTOP:-<unset>}"
echo "DESKTOP_SESSION    = ${DESKTOP_SESSION:-<unset>}"
echo "WAYLAND_DISPLAY    = ${WAYLAND_DISPLAY:-<unset>}"
echo "DISPLAY            = ${DISPLAY:-<unset>}"

if have loginctl; then
  session_id="$(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $1}' | head -1)"
  if [ -n "${session_id:-}" ]; then
    echo "loginctl show-session ${session_id}:"
    loginctl show-session "$session_id" 2>/dev/null | grep -E '^(Type|Desktop|Active|State)=' | sed 's/^/  /'
  else
    echo "loginctl: no session found (not run from within a login session?)"
  fi
else
  echo "loginctl not found — skipping session-manager cross-check."
fi

if [ "${XDG_SESSION_TYPE:-}" = "x11" ] && have wmctrl; then
  echo "wmctrl -m (window manager identification, Xorg only):"
  wmctrl -m 2>&1 | sed 's/^/  /'
elif [ "${XDG_SESSION_TYPE:-}" = "x11" ]; then
  echo "wmctrl not found — install it (apt/dnf install wmctrl) for a WM name cross-check."
fi

session_type="${XDG_SESSION_TYPE:-unknown}"
case "$session_type" in
  wayland)
    if echo "${XDG_CURRENT_DESKTOP:-}" | grep -qi gnome; then
      item1_verdict="Wayland + GNOME — the in-scope case for Stage D (org.gnome.Shell.Introspect path)."
    else
      item1_verdict="Wayland + non-GNOME desktop (${XDG_CURRENT_DESKTOP:-unknown}) — Step 20 says this stays OUT of scope; report caps without 'url'."
    fi
    ;;
  x11)
    item1_verdict="Xorg — in scope for Stage D under any window manager (_NET_ACTIVE_WINDOW + WM_NAME path)."
    ;;
  *)
    item1_verdict="Could not determine session type (XDG_SESSION_TYPE=${session_type}) — treat as out of scope until confirmed."
    ;;
esac
echo
echo "VERDICT (item 1): ${item1_verdict}"
echo
hr
echo

# --- Item 2: org.gnome.Shell.Introspect.GetWindows ----------------------
echo "Item 2 — org.gnome.Shell.Introspect.GetWindows"
echo "-------------------------------------------------"
if ! have gdbus; then
  echo "gdbus not found — cannot check this item. Install glib2 tools (apt: libglib2.0-bin; dnf: glib2)."
  item2_verdict="INCONCLUSIVE — gdbus unavailable."
elif [ "${XDG_SESSION_TYPE:-}" != "wayland" ]; then
  echo "Skipping — this only matters on GNOME/Wayland (session type is ${XDG_SESSION_TYPE:-unknown})."
  item2_verdict="N/A — not a Wayland session."
else
  echo "Raw output of:"
  echo "  gdbus call --session --dest org.gnome.Shell \\"
  echo "    --object-path /org/gnome/Shell/Introspect \\"
  echo "    --method org.gnome.Shell.Introspect.GetWindows"
  echo
  raw_output="$(gdbus call --session --dest org.gnome.Shell \
    --object-path /org/gnome/Shell/Introspect \
    --method org.gnome.Shell.Introspect.GetWindows 2>&1)"
  gdbus_status=$?
  echo "$raw_output" | sed 's/^/  /'
  echo
  if [ $gdbus_status -eq 0 ]; then
    item2_verdict="CALLABLE — GetWindows returned data (see raw output above; confirm it actually lists windows with focus state, not an empty/degenerate result)."
  elif echo "$raw_output" | grep -qi "AccessDenied\|not allowed\|not permitted"; then
    item2_verdict="ACCESS DENIED — this GNOME version/session restricts GetWindows. This is the single biggest risk item. gdbus's own error text is quoted above; note the exact GNOME Shell version (see below) since this has changed across GNOME releases."
  elif echo "$raw_output" | grep -qi "org.freedesktop.DBus.Error.UnknownMethod\|No such interface\|does not exist"; then
    item2_verdict="METHOD NOT FOUND — this GNOME Shell version/build doesn't expose Introspect.GetWindows at all."
  elif echo "$raw_output" | grep -qi "was not provided by any .service"; then
    item2_verdict="org.gnome.Shell not reachable at all — is this really a GNOME session?"
  else
    item2_verdict="FAILED with an unrecognized error — read the raw output above."
  fi
fi
if have gnome-shell; then
  echo "gnome-shell --version: $(gnome-shell --version 2>&1)"
fi
echo
echo "VERDICT (item 2): ${item2_verdict}"
echo
hr
echo

# --- Item 3: AT-SPI2 bus + toolkit-accessibility ------------------------
echo "Item 3 — AT-SPI2 bus and toolkit-accessibility"
echo "-------------------------------------------------"
atspi_bus_ok=0
if have gdbus; then
  echo "Raw output of:"
  echo "  gdbus call --session --dest org.a11y.Bus --object-path /org/a11y/bus \\"
  echo "    --method org.a11y.Bus.GetAddress"
  echo
  atspi_addr_output="$(gdbus call --session --dest org.a11y.Bus --object-path /org/a11y/bus \
    --method org.a11y.Bus.GetAddress 2>&1)"
  atspi_addr_status=$?
  echo "$atspi_addr_output" | sed 's/^/  /'
  [ $atspi_addr_status -eq 0 ] && atspi_bus_ok=1
else
  echo "gdbus not found — cannot query the a11y bus address directly."
fi

if have pgrep; then
  if pgrep -x at-spi-bus-launcher >/dev/null 2>&1 || pgrep -f at-spi2-registryd >/dev/null 2>&1; then
    echo "at-spi-bus-launcher / at-spi2-registryd: running."
    atspi_bus_ok=1
  else
    echo "at-spi-bus-launcher / at-spi2-registryd: no matching process found."
  fi
fi

toolkit_a11y="<unknown>"
if have gsettings; then
  toolkit_a11y="$(gsettings get org.gnome.desktop.interface toolkit-accessibility 2>&1)"
  echo "gsettings get org.gnome.desktop.interface toolkit-accessibility -> ${toolkit_a11y}"
  if [ "$toolkit_a11y" = "false" ]; then
    echo "  This is OFF. To turn it on for this test:"
    echo "    gsettings set org.gnome.desktop.interface toolkit-accessibility true"
    echo "  (GTK/GNOME apps read this at launch — you may need to restart the browser"
    echo "   after setting it, not just re-run this probe.)"
  fi
else
  echo "gsettings not found — cannot check toolkit-accessibility (GNOME-specific setting; expected to be absent on non-GNOME desktops)."
fi

if [ "$atspi_bus_ok" = "1" ] && [ "$toolkit_a11y" = "true" ]; then
  item3_verdict="READY — a11y bus is up and toolkit-accessibility is on."
elif [ "$atspi_bus_ok" = "1" ]; then
  item3_verdict="BUS UP but toolkit-accessibility is ${toolkit_a11y} — set it and re-run before trusting item 4's result."
else
  item3_verdict="a11y bus not confirmed running — item 4 is expected to fail until this is fixed."
fi
echo
echo "VERDICT (item 3): ${item3_verdict}"
echo
hr
echo

# --- Item 4: delegate to the Python probe -------------------------------
if ! have python3; then
  echo "Item 4 — SKIPPED: python3 not found on PATH."
  item4_exit=127
else
  "$SCRIPT_DIR/probe.py"
  item4_exit=$?
fi
echo
hr
echo

# --- Overall summary -----------------------------------------------------
echo "OVERALL SUMMARY"
echo "---------------"
echo "1. session/compositor : ${item1_verdict}"
echo "2. GetWindows          : ${item2_verdict:-N/A}"
echo "3. AT-SPI bus/a11y     : ${item3_verdict}"
case "$item4_exit" in
  0) echo "4. AT-SPI tree walk    : ran — see WALK RESULT / VERDICT lines above for the per-browser finding." ;;
  2) echo "4. AT-SPI tree walk    : pyatspi not installed — see install hint above, re-run after installing." ;;
  3) echo "4. AT-SPI tree walk    : FAILED — AT-SPI registry unreachable, matches item 3's bus finding." ;;
  4) echo "4. AT-SPI tree walk    : no browser was running — relaunch with a browser open and re-run." ;;
  127) echo "4. AT-SPI tree walk    : SKIPPED — python3 missing." ;;
  *) echo "4. AT-SPI tree walk    : exited with unexpected code ${item4_exit} — see output above." ;;
esac
echo
echo "This script does not make the Stage D go/no-go call for you — read the"
echo "per-item verdicts and docs/url-tracking-plan.md Step 20's rule (GNOME-"
echo "on-Wayland or any-WM-on-Xorg -> viable; everything else -> out of scope)"
echo "before deciding whether to proceed to Prompt D.2."
