#!/bin/bash
# The .deb's postrm and the .rpm's %postun: electron-builder's own (app-builder-lib's
# templates/linux/after-remove.tpl), plus removing the AppArmor profile
# after-install.sh put in. See there about ${...}.

# Only when the app is removed (dpkg says remove or purge, rpm 0), not on an
# upgrade: rpm runs this after the new version's install script, so it would
# take away the link and profile that just put in
case "$1" in
    remove|purge|0)
        # Delete the link to the binary
        if type update-alternatives >/dev/null 2>&1; then
            update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}'
        fi
        if [ -L '/usr/bin/${executable}' ] && [ ! -e '/usr/bin/${executable}' ]; then
            rm -f '/usr/bin/${executable}'
        fi
        if [ -f '/etc/apparmor.d/${executable}' ]; then
            if hash apparmor_parser 2>/dev/null; then
                apparmor_parser --remove '/etc/apparmor.d/${executable}' >/dev/null 2>&1 || true
            fi
            rm -f '/etc/apparmor.d/${executable}'
        fi
        ;;
esac
