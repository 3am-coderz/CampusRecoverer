# Infrastructure Environment Variables

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL superuser | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `postgres` |
| `POSTGRES_DB` | PostgreSQL database name | `campus_recoverer` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@postgres:5432/campus_recoverer` |
| `BACKUP_DIR` | Directory to store pg_dump SQL backups | `/tmp/campus_recoverer_backups` |
