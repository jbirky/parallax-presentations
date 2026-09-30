#!/usr/bin/env bash
# Backs up the cloud version's data to this server's disk, a copy apart from
# Neon and R2 where it lives. Run nightly from cron:
#
#   15 3 * * * /home/jbirky/docker_server/parallax-presentations/scripts/backup.sh >> /home/jbirky/backups/parallax-presentations/backup.log 2>&1
#
# Everything it writes is encrypted with age to the public keys in
# BACKUP_AGE_RECIPIENTS. Their private keys are kept off this server, so
# nothing here can read the backups back, not even this script, and the
# unencrypted data is only ever held in memory on its way through.
#
# In $BACKUP_DIR:
#   database/         the prod database (Neon), from pg_dump, one per run
#                     (neondb_<run>.dump.age): kept 30 days, and the first of
#                     each month kept a year
#   uploads/          a mirror of the prod R2 bucket, a file per file
#                     (<key>.age), without guest/ (guest files are deleted
#                     within hours, as promised to guests)
#   uploads-deleted/  files since deleted from R2, by run, kept 30 days
#   volumes/          the Docker volumes (volumes.tar.gz.age), empty while
#                     files are in R2
#   last-success      when the last run finished
#
# Restoring needs age and a private key (here in key.txt):
#   database  age -d -i key.txt -o restore.dump $BACKUP_DIR/database/<file>.dump.age
#             docker run --rm -e URL -v "$PWD":/b postgres:17-alpine \
#               pg_restore --no-owner --no-privileges --dbname "$URL" /b/restore.dump
#             (into an empty database; --clean replaces an existing one)
#   uploads   decrypt the mirror into a directory, then copy that back to
#             r2:<bucket> with the same rclone container:
#               cd $BACKUP_DIR/uploads && find . -name '*.age' | while read -r f; do
#                 mkdir -p "$OUT/${f%/*}" && age -d -i key.txt -o "$OUT/${f%.age}" "$f"; done
#   volumes   age -d -i key.txt $BACKUP_DIR/volumes/volumes.tar.gz.age | tar xz
#
# Reads DATABASE_URL, R2_* and BACKUP_AGE_RECIPIENTS (public keys, separated
# by spaces) from the repo's .env. Needs Docker and age.

set -euo pipefail
# Only this user can read what it writes (the containers' own files are closed
# off at the end)
umask 077

REPO=$(cd "$(dirname "$0")/.." && pwd)
BACKUP_DIR=${BACKUP_DIR:-/home/jbirky/backups/parallax-presentations}
KEEP_DAYS=30
KEEP_MONTHS=12
BATCH=100   # uploads fetched at a time, which bounds the memory they take
STAMP=$(date +%Y-%m-%d_%H%M)
PG_IMAGE=postgres:17-alpine   # pg_dump must be at least the server's version (Neon: 17)
RCLONE_IMAGE=rclone/rclone:1.75
AS_ME="$(id -u):$(id -g)"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*"; }

# One variable from .env, without running .env as a script; empty if it
# isn't there
env_value() {
  { grep -E "^$1=" "$REPO/.env" || true; } | tail -1 | cut -d= -f2- | sed -E "s/^[\"']//; s/[\"']$//"
}
DATABASE_URL=$(env_value DATABASE_URL)
R2_ENDPOINT=$(env_value R2_ENDPOINT)
R2_ACCESS_KEY=$(env_value R2_ACCESS_KEY)
R2_SECRET_KEY=$(env_value R2_SECRET_KEY)
R2_BUCKET=$(env_value R2_BUCKET)
R2_BUCKET=${R2_BUCKET:-parallax-uploads}
BACKUP_AGE_RECIPIENTS=$(env_value BACKUP_AGE_RECIPIENTS)
for name in DATABASE_URL R2_ENDPOINT R2_ACCESS_KEY R2_SECRET_KEY BACKUP_AGE_RECIPIENTS; do
  [ -n "${!name}" ] || { log "FAILED: $name isn't set in $REPO/.env"; exit 1; }
done
command -v age > /dev/null || { log "FAILED: age isn't installed (sudo apt install age)"; exit 1; }
# Any one of the recipients' private keys decrypts
age_args=()
for recipient in $BACKUP_AGE_RECIPIENTS; do age_args+=(-r "$recipient"); done
encrypt() { age "${age_args[@]}"; }
# A mistyped key fails here, before anything is written
encrypt < /dev/null > /dev/null || { log "FAILED: BACKUP_AGE_RECIPIENTS isn't a list of age public keys"; exit 1; }

# Handed to the containers by name (docker run -e NAME), so the values
# aren't on a command line
export DATABASE_URL
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_KEY"
rclone_env=(-e HOME=/tmp -e RCLONE_CONFIG_R2_TYPE -e RCLONE_CONFIG_R2_PROVIDER -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET
  -e RCLONE_CONFIG_R2_ENDPOINT -e RCLONE_CONFIG_R2_ACCESS_KEY_ID -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY)

mkdir -p "$BACKUP_DIR"/{database,uploads,uploads-deleted,volumes}
chmod 700 "$BACKUP_DIR"
# Files on their way to being encrypted, in memory (/dev/shm is RAM)
stage=$(mktemp -d /dev/shm/parallax-backup.XXXXXX)
trap 'rm -rf -- "$stage"' EXIT

# ── Database ─────────────────────────────────────────────────────────────────
# Dumped to memory in the container and checked there that pg_restore can
# read it, then encrypted on the way out. Neon's certificate is checked
# against the system's (sslmode=verify-full in the URL).
dump="neondb_$STAMP.dump.age"
docker run --rm --user "$AS_ME" -e DATABASE_URL -e PGSSLROOTCERT=system \
  --mount type=tmpfs,destination=/work,tmpfs-mode=1777 "$PG_IMAGE" sh -c '
    pg_dump --format=custom --no-owner --no-privileges --file /work/db.dump "$DATABASE_URL" &&
    pg_restore --list /work/db.dump > /dev/null &&
    cat /work/db.dump' | encrypt > "$BACKUP_DIR/database/$dump.partial"
mv "$BACKUP_DIR/database/$dump.partial" "$BACKUP_DIR/database/$dump"
log "database: $dump ($(du -h "$BACKUP_DIR/database/$dump" | cut -f1))"

# Older than KEEP_DAYS goes, except the first of a month within KEEP_MONTHS
now=$(date +%s)
for file in "$BACKUP_DIR"/database/neondb_*.dump.age "$BACKUP_DIR"/database/*.partial; do
  [ -e "$file" ] || continue
  age_days=$(( (now - $(stat -c %Y "$file")) / 86400 ))
  [ "$age_days" -le "$KEEP_DAYS" ] && continue
  if [[ "$file" =~ neondb_[0-9]{4}-[0-9]{2}-01_ ]] && [ "$age_days" -le $((KEEP_MONTHS * 31)) ]; then continue; fi
  rm -f -- "$file"
done

# ── Uploads (R2) ─────────────────────────────────────────────────────────────
# Only files new since the last run are fetched: an upload's key is a new
# UUID, never reused, so a key already here is up to date. A file gone from R2
# moves to uploads-deleted/<run>/ rather than away.
docker run --rm --user "$AS_ME" "${rclone_env[@]}" "$RCLONE_IMAGE" \
  lsf -R --files-only --fast-list --exclude 'guest/**' "r2:$R2_BUCKET" --config /dev/null \
  | sort > "$stage/remote"
(cd "$BACKUP_DIR/uploads" && find . -type f -name '*.age' | sed -E 's#^\./##; s#\.age$##' | sort) > "$stage/local"
# An empty listing would move the whole mirror to uploads-deleted/
if [ ! -s "$stage/remote" ] && [ -s "$stage/local" ]; then
  log "FAILED: r2:$R2_BUCKET listed no files, but the mirror has $(wc -l < "$stage/local")"
  exit 1
fi
comm -23 "$stage/remote" "$stage/local" > "$stage/new"
comm -13 "$stage/remote" "$stage/local" > "$stage/gone"

while IFS= read -r key; do
  mkdir -p "$BACKUP_DIR/uploads-deleted/$STAMP/$(dirname "$key")"
  mv -- "$BACKUP_DIR/uploads/$key.age" "$BACKUP_DIR/uploads-deleted/$STAMP/$key.age"
done < "$stage/gone"
find "$BACKUP_DIR/uploads" -mindepth 1 -type d -empty -delete

split -l "$BATCH" "$stage/new" "$stage/batch."
for batch in "$stage"/batch.*; do
  [ -e "$batch" ] || continue
  mkdir "$stage/files"
  docker run --rm --user "$AS_ME" "${rclone_env[@]}" -v "$stage":/stage "$RCLONE_IMAGE" \
    copy "r2:$R2_BUCKET" /stage/files --files-from-raw "/stage/${batch##*/}" --no-traverse \
    --transfers 8 --log-level NOTICE --config /dev/null
  while IFS= read -r key; do
    mkdir -p "$BACKUP_DIR/uploads/$(dirname "$key")"
    encrypt < "$stage/files/$key" > "$BACKUP_DIR/uploads/$key.age.partial"
    mv -- "$BACKUP_DIR/uploads/$key.age.partial" "$BACKUP_DIR/uploads/$key.age"
  done < "$batch"
  rm -rf -- "$stage/files"
done
log "uploads: $(wc -l < "$stage/new") new, $(wc -l < "$stage/gone") deleted, $(wc -l < "$stage/remote") files ($(du -sh "$BACKUP_DIR/uploads" | cut -f1))"
find "$BACKUP_DIR/uploads-deleted" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf -- {} +
find "$BACKUP_DIR/uploads-deleted" -mindepth 1 -maxdepth 1 -type d -empty -delete

# ── Docker volumes ───────────────────────────────────────────────────────────
docker run --rm --user "$AS_ME" \
  -v parallax-data:/src/data:ro -v parallax-uploads:/src/uploads:ro \
  alpine tar czf - -C /src data uploads | encrypt > "$BACKUP_DIR/volumes/volumes.tar.gz.age.partial"
mv "$BACKUP_DIR/volumes/volumes.tar.gz.age.partial" "$BACKUP_DIR/volumes/volumes.tar.gz.age"

chmod -R go-rwx "$BACKUP_DIR"
date '+%Y-%m-%d %H:%M:%S' > "$BACKUP_DIR/last-success"
log "backup OK -> $BACKUP_DIR"
