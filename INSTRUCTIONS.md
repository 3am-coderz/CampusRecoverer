# Member 5: DevOps, Audit & E2E Testing Partition Instructions

## 1. Overview
You are **Member 5 (DevOps, Audit Logging & Testing Engineer)** for Campus Recoverer.
Your partition is **strictly isolated** to:
- `infra/` (Dockerfiles, Docker Compose, Nginx reverse proxy, automated seed script, database backup script)
- `.github/` (GitHub Actions CI/CD workflows)
- `tests/` (End-to-end integration tests, edge cases, security invariant suites)
- `Makefile` (Root developer orchestration)
- `apps/api/db/migrations/audit/` (001_audit_schema.sql: SHA-256 tamper-evident hash chain schema)
- `apps/api/src/modules/audit/` (Audit logging service, cryptographic hash-chain verification, log sanitizer)

---

## 2. Step-by-Step Git Commands to Push & Merge

### Step 1: Clone or update the repository
```bash
git clone https://github.com/3am-coderz/CampusRecoverer.git
cd CampusRecoverer
git checkout main
git pull origin main
```

### Step 2: Create your feature branch
```bash
git checkout -b member5/devops-audit-ci
```

### Step 3: Copy your partition files into the repository
Copy all files from this `member-5-devops-audit` folder into your repository root:
```bash
# Assuming member-5-devops-audit is in your downloads or parent directory:
cp -r /path/to/member-5-devops-audit/* ./
# Note: For hidden folders (.github):
cp -r /path/to/member-5-devops-audit/.github ./
```

### Step 4: Verify git status
Run `git status`. You should see `infra/`, `.github/`, `tests/`, `Makefile`, and `audit` files:
```bash
git status
```

### Step 5: Commit and Push
```bash
git add infra/ .github/ tests/ Makefile apps/api/db/migrations/audit/ apps/api/src/modules/audit/
git commit -m "feat(member-5): implement DevOps infra, Docker, CI pipeline, and audit logging"
git push -u origin member5/devops-audit-ci
```

### Step 6: Create Pull Request
1. Go to GitHub: `https://github.com/3am-coderz/CampusRecoverer`
2. Open a Pull Request from `member5/devops-audit-ci` into `main`.
3. PR Title: `feat(member-5): implement DevOps infra, Docker, CI pipeline, and audit logging`
4. GitHub will show **"Able to merge: These branches can be automatically merged"** with **zero merge conflicts**.

---

## 3. How to Run & Test
```bash
# Run Docker multi-container environment:
cd infra
docker-compose up --build

# Or run tests:
cd tests
npm install
npm test
```
