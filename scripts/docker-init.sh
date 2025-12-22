#!/bin/sh
# Unraid-compatible entrypoint with PUID/PGID support
# This script runs as root, sets up permissions, then drops to the app user

set -e

# Default to Unraid's nobody:users (99:100)
PUID=${PUID:-99}
PGID=${PGID:-100}

echo "[init] Starting with PUID=$PUID, PGID=$PGID"

# Get or create group with target GID
GROUPNAME=$(getent group "$PGID" | cut -d: -f1)
if [ -z "$GROUPNAME" ]; then
  # GID doesn't exist, create it
  addgroup -g "$PGID" appgroup
  GROUPNAME="appgroup"
  echo "[init] Created group appgroup with GID=$PGID"
else
  echo "[init] Using existing group '$GROUPNAME' with GID=$PGID"
fi

# Get or create user with target UID
USERNAME=$(getent passwd "$PUID" | cut -d: -f1)
if [ -z "$USERNAME" ]; then
  # UID doesn't exist, create it
  adduser -u "$PUID" -G "$GROUPNAME" -s /bin/sh -D appuser
  USERNAME="appuser"
  echo "[init] Created user appuser with UID=$PUID"
else
  echo "[init] Using existing user '$USERNAME' with UID=$PUID"
fi

# Ensure /config exists and has correct ownership
mkdir -p /config
chown -R "$PUID:$PGID" /config

# Ensure key /app directories have correct ownership
chown -R "$PUID:$PGID" /app

echo "[init] Permissions set. Running as $USERNAME (UID=$PUID, GID=$PGID)..."

# Drop privileges and run the main entrypoint
exec su-exec "$PUID:$PGID" node /app/scripts/docker-entrypoint.mjs
