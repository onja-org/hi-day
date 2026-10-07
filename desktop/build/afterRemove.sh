#!/bin/sh
# Removes the browser .desktop overrides the agent wrote, on uninstall.
#
# browser-activation.ts shadows each browser's launcher so it starts with
# accessibility active — the only way to read an address bar over AT-SPI. Those
# shadows live in every user's ~/.local/share/applications and outlive the
# package, so without this every browser on the machine keeps launching with
# GNOME_ACCESSIBILITY=1 and --force-renderer-accessibility=basic after the agent
# that wanted it is gone.
#
# Shell rather than reusing removeBrowserActivation directly: this runs as root
# during dpkg removal, when /opt/Hi Day is being deleted and the app
# cannot be executed. The markers below are the contract between the two — they
# must stay identical to ACTIVATION_MARKER and LEGACY_ACTIVATION_MARKERS in
# browser-activation.ts, which after-remove-script.spec.ts asserts. The legacy
# one is what the agent wrote under its old name, Workforce Monitor.
#
# Only files carrying the marker are touched, so a vendor entry or a launcher
# the user wrote themselves is never removed.
set -eu

MARKER='# Written by Hi Day to enable website tracking.'
LEGACY_MARKER='# Written by Workforce Monitor to enable website tracking.'

for home in /home/* /root; do
    [ -d "$home" ] || continue
    apps="$home/.local/share/applications"
    [ -d "$apps" ] || continue

    for entry in "$apps"/*.desktop; do
        [ -f "$entry" ] || continue
        # Anywhere in the file, matching browser-activation.ts's own
        # contents.includes(ACTIVATION_MARKER) — the agent writes the marker
        # first, but the two must agree on what counts as its own file.
        if grep -qF "$MARKER" "$entry" || grep -qF "$LEGACY_MARKER" "$entry"; then
            rm -f "$entry"
        fi
    done

    # Best-effort: the menu caches entries, and a stale cache keeps showing a
    # launcher whose file is gone.
    [ -x /usr/bin/update-desktop-database ] && /usr/bin/update-desktop-database "$apps" 2>/dev/null || true
done

exit 0
