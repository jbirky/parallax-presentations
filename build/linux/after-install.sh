#!/bin/bash
# The .deb's postinst and the .rpm's %post: electron-builder's own (app-builder-lib's
# templates/linux/after-install.tpl), plus an AppArmor profile so that
# Chromium's sandbox works on Ubuntu 24.04 and later. electron-builder fills
# in ${executable} and ${sanitizedProductName}, and fails the build on any
# other word in a dollar and braces, so the shell's own variables here are
# written without braces.

if type update-alternatives 2>/dev/null >&1; then
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

# Ubuntu 24.04 and later let a program use user namespaces, which Chromium's
# sandbox is built on, only when an AppArmor profile allows it; without one
# the app stops at startup. This profile allows that and confines nothing
# else. An AppArmor too old to read it (Ubuntu 22.04) doesn't restrict user
# namespaces anyway, so there it's skipped.
if hash apparmor_parser 2>/dev/null && [ -d /etc/apparmor.d ]; then
    profile="$(mktemp)"
    cat > "$profile" <<'PROFILE'
abi <abi/4.0>,
include <tunables/global>

profile ${executable} /opt/${sanitizedProductName}/${executable} flags=(unconfined) {
  userns,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/${executable}>
}
PROFILE
    if apparmor_parser --skip-kernel-load --debug "$profile" >/dev/null 2>&1; then
        install -m 644 "$profile" '/etc/apparmor.d/${executable}'
        # Load it now, unless this is a chroot (an image being built), where
        # it loads at the next boot
        if ! { [ -x /usr/bin/ischroot ] && /usr/bin/ischroot; } && [ "$(cat /sys/module/apparmor/parameters/enabled 2>/dev/null)" = Y ]; then
            apparmor_parser --replace --write-cache --skip-read-cache '/etc/apparmor.d/${executable}' || true
        fi
    fi
    rm -f "$profile"
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
