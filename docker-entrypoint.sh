#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Jessica Birky

# Runs the server as the unprivileged node user, not root, so code that gets
# control of it (through a converted upload, say) can't change the app or the
# system. The data and uploads volumes may hold files written when the server
# ran as root, so what in them isn't node's is handed over first (symlinks
# themselves, not what they point at). Started as another user, it runs as
# that user.
set -e

if [ "$(id -u)" = 0 ]; then
  for dir in /app/server/data /app/server/uploads; do
    find "$dir" ! -user node -exec chown -h node:node {} +
  done
  export HOME=/home/node
  exec su-exec node "$@"
fi
exec "$@"
