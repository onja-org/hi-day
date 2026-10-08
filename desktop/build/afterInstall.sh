#!/bin/bash
# electron-builder's own after-install, with one block left out: the one
# that installs its generated AppArmor profile.
#
# That profile forbids the app nothing — `flags=(unconfined)`, granting only
# `userns` for a Chromium sandbox we do not use, since the launcher always
# passes --no-sandbox. What it does do is give the process its own name as an
# AppArmor label, and a snap-confined browser may only send accessibility
# signals to a peer labelled `unconfined`. So every window:activate from a
# snap Firefox or Opera was dropped by the bus before reaching us, and their
# URLs went unrecorded while Chrome's — a deb, unconfined — came through.
#
# Measured on Ubuntu 24.04: 38 denials of
#   interface="org.a11y.atspi.Event.Window" member="Activate" peer_label="hiday"
# before, none after, and the first Firefox and Opera sessions this install
# had ever recorded.
#
# Keep this in step with the template in app-builder-lib on an upgrade —
# after-install.spec.ts fails if the two drift apart.

if type update-alternatives >/dev/null 2>&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

# Check if user namespaces are supported by the kernel and working with a quick test:
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    # Use SUID chrome-sandbox only on systems without user namespaces:
    chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
else
    chmod 0755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi


# Remove a profile an earlier version installed, since this one no longer
# does. Both names: the app shipped as Workforce Monitor before the rename,
# and dpkg does not know about either — they are written by this script, not
# packaged as files, which is why an ordinary removal leaves them behind.
for profile in '/etc/apparmor.d/${executable}' /etc/apparmor.d/workforce-monitor; do
    [ -f "$profile" ] || continue
    if hash apparmor_parser 2>/dev/null; then
        apparmor_parser --remove "$profile" >/dev/null 2>&1 || true
    fi
    rm -f "$profile"
done
