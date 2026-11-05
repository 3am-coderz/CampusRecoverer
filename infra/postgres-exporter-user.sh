#!/bin/sh
set -eu

until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  sleep 1
done

psql --set=ON_ERROR_STOP=1 \
  --set=exporter_user="$POSTGRES_EXPORTER_USER" \
  --set=exporter_password="$POSTGRES_EXPORTER_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'exporter_user', :'exporter_password')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'exporter_user'
)
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'exporter_user', :'exporter_password')
\gexec

SELECT format('GRANT pg_monitor TO %I', :'exporter_user')
\gexec
SQL
