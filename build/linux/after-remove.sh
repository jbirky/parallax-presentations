#!/bin/bash
# The .deb's postrm: electron-builder's own (app-builder-lib's
# templates/linux/after-remove.tpl), plus removing the AppArmor profile
# after-install.sh put in. See there about ${...}.

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/usr/bin/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

# Only when the app is removed: an upgrade's postinst puts the profile back
case "$1" in
    remove|purge)
        if [ -f '/etc/apparmor.d/${executable}' ]; then
            if hash apparmor_parser 2>/dev/null; then
                apparmor_parser --remove '/etc/apparmor.d/${executable}' >/dev/null 2>&1 || true
            fi
            rm -f '/etc/apparmor.d/${executable}'
        fi
        ;;
esac
