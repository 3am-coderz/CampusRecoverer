# Member 5: Infrastructure & DevOps

This directory contains container definitions, reverse proxy configs, automated database backups, database seed scripts, and orchestration files for Campus Recoverer.

## Ownership
- Owner: Member 5 (DevOps, Audit & Testing)

## Services Orchestrated
- `web`: React 18 + Vite static build served by Nginx (Port 5173 / 80)
- `api`: Express REST API in Node.js 20 (Port 4000)
- `matching`: FastAPI ML microservice in Python 3.11+ (Port 8000)
- `postgres`: PostgreSQL 16 database (Port 5432)

## Commands
```bash
# Start all containers
docker compose -f infra/docker-compose.yml up --build

# Run database backup
./infra/backup.sh

# Run database seeder
npx tsx infra/seed.ts
```
