#!/bin/sh
# Brings the schema up to date, then starts the API.
#
# Migrations run here rather than in a separate step so that a self-hoster's
# `docker compose up` is the whole install, and an upgrade is `pull` plus
# `up` with nothing to remember. TypeORM records what it has applied, so
# re-running is a no-op and a restart costs one query.
#
# `set -e` matters: a failed migration must stop the container rather than
# start an API against a schema it does not match.
set -e

echo "Running database migrations..."
node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js

echo "Starting Hi Day backend..."
exec "$@"
