#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Jessica Birky
#
# The APT and RPM repositories at pkg.parallax-presentations.com: add a
# release's packages to a copy of them, then write and sign their indexes.
#
#   scripts/package-repos.sh <site> <package.deb|package.rpm>...
#
# <site> is the repositories as published (CI copies them down from R2 first)
# and gets the new packages, indexes and setup files; the release workflow
# then uploads it. Every version stays, so a downgrade can find the old one.
#
# The signing key is the one in gpg's keyring (SIGNING_KEY picks one by
# fingerprint). PACKAGES_URL is where <site> is served. Needs apt-ftparchive
# (apt-utils), rpmsign (rpm), createrepo_c and gpg.
#
# Layout:
#   parallax.asc                       the public key
#   apt/parallax.sources               an APT source, with the key in it
#   apt/pool/main/p/parallax/*.deb
#   apt/dists/stable/{Release,InRelease,Release.gpg,main/binary-amd64/Packages*}
#   rpm/parallax.repo                  a dnf/zypper repository file
#   rpm/x86_64/*.rpm                   each signed
#   rpm/repodata/                      repomd.xml signed as repomd.xml.asc
set -euo pipefail

site=${1:?usage: package-repos.sh <site> <package>...}
shift
url=${PACKAGES_URL:-https://pkg.parallax-presentations.com}
key=${SIGNING_KEY:-$(gpg --list-secret-keys --with-colons | awk -F: '/^fpr/{print $10; exit}')}
[ -n "$key" ] || { echo "no signing key in gpg's keyring" >&2; exit 1; }
sign() { gpg --batch --yes --pinentry-mode loopback --passphrase '' --local-user "$key" "$@"; }

mkdir -p "$site/apt/pool/main/p/parallax" "$site/apt/dists/stable/main/binary-amd64" "$site/rpm/x86_64"
site=$(cd "$site" && pwd)

for pkg in "$@"; do
  case "$pkg" in
    *.deb) cp "$pkg" "$site/apt/pool/main/p/parallax/" ;;
    *.rpm)
      cp "$pkg" "$site/rpm/x86_64/"
      # (Debian's rpm looks for gpg under another name)
      GPG_TTY= rpmsign --addsign --define "_gpg_name $key" --define "__gpg $(command -v gpg)" \
        --define "_gpg_sign_cmd_extra_args --batch --pinentry-mode loopback" \
        "$site/rpm/x86_64/$(basename "$pkg")" >/dev/null
      ;;
    *) echo "not a .deb or .rpm: $pkg" >&2; exit 1 ;;
  esac
done

gpg --batch --armor --export "$key" > "$site/parallax.asc"

# APT. The Release file lists every index's checksums, so the old Release,
# InRelease and Release.gpg go first (apt-ftparchive would list them too).
dists="$site/apt/dists/stable"
(cd "$site/apt" && apt-ftparchive packages pool) > "$dists/main/binary-amd64/Packages"
gzip -9nkf "$dists/main/binary-amd64/Packages"
rm -f "$dists/Release" "$dists/InRelease" "$dists/Release.gpg"
release=$(mktemp)
apt-ftparchive \
  -o APT::FTPArchive::Release::Origin=Parallax \
  -o APT::FTPArchive::Release::Label=Parallax \
  -o APT::FTPArchive::Release::Suite=stable \
  -o APT::FTPArchive::Release::Codename=stable \
  -o APT::FTPArchive::Release::Architectures=amd64 \
  -o APT::FTPArchive::Release::Components=main \
  -o "APT::FTPArchive::Release::Description=Parallax, interactive and intuitive slides" \
  release "$dists" > "$release"
mv "$release" "$dists/Release"
sign --clearsign -o "$dists/InRelease" "$dists/Release"
sign --detach-sign --armor -o "$dists/Release.gpg" "$dists/Release"

# A deb822 source with the key inside it (apt 2.4 and later: Ubuntu 22.04,
# Debian 12), so setting up the repository is one download. In Signed-By the
# key's lines are indented, and its blank line is written " .".
{
  printf 'Types: deb\nURIs: %s/apt\nSuites: stable\nComponents: main\nSigned-By:\n' "$url"
  sed -e 's/^$/./' -e 's/^/ /' "$site/parallax.asc"
} > "$site/apt/parallax.sources"

# RPM. gzip, not zstd, so older dnf and zypper read the metadata too.
createrepo_c --quiet --update --general-compress-type=gz "$site/rpm" >/dev/null
sign --detach-sign --armor -o "$site/rpm/repodata/repomd.xml.asc" "$site/rpm/repodata/repomd.xml"
cp "$site/parallax.asc" "$site/rpm/repodata/repomd.xml.key"
cat > "$site/rpm/parallax.repo" <<EOF
[parallax]
name=Parallax
baseurl=$url/rpm
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=$url/parallax.asc
EOF

echo "Signed with $key:"
(cd "$site" && find . -name '*.deb' -o -name '*.rpm' | sort)
