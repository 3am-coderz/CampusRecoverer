# Campus Recoverer - Git Workflow & Zero-Conflict Policy

## 1. Zero-Conflict Architecture Principles
To guarantee zero git merge conflicts across five distributed team members:
1. **Strict Partition Ownership**: Every file in the repository has exactly one owner as codified in `CODEOWNERS`.
2. **Frozen Shared Kernel**: Root configurations, workspace package.json, contracts, and kernel stubs are frozen in Phase 0. No member modifies them.
3. **No Central Registries**:
   - Backend auto-discovers modules under `apps/api/src/modules/*` dynamically at runtime.
   - Frontend shell imports fixed route arrays (`routes/routes.tsx` and `admin/routes.tsx`) owned by Member 1.
4. **Independent Migrations**: Each module has its isolated migrations folder. The migration runner executes them in deterministic order (`core` -> `audit` -> `handover` -> `workflow`).
5. **Port-Based Communication**: Modules interact exclusively through `apps/api/src/kernel/ports.ts` or contracts. Stubs ensure standalone execution.

## 2. Branching & PR Guidelines
- **Branch Naming**:
  - Member 1: `member1/<feature-name>`
  - Member 2: `member2/<feature-name>`
  - Member 3: `member3/<feature-name>`
  - Member 4: `member4/<feature-name>`
  - Member 5: `member5/<feature-name>`
- **PR Targets**: All PRs target the `main` branch directly.
- **Rebase Before PR**: Always rebase your branch on `origin/main` before opening or merging a PR:
  ```bash
  git checkout memberN/my-feature
  git fetch origin
  git rebase origin/main
  ```
- **Ownership Verification (CI Guard)**: GitHub Actions checks modified files against your branch author and CODEOWNERS. If a PR touches files outside your partition, the CI pipeline automatically fails.
- **Frozen Path Modifications**: Modifying frozen files (`contracts/`, `apps/*/src/kernel/`, root configs) requires explicit sign-off from both **Member 3 (Team Lead)** and **Member 5 (DevOps/Sec)**.

## 3. Dependency Management Policy
- All dependencies for API, Web, Testing, and Python matching have been pre-installed in Phase 0.
- If an additional dependency is strictly required, file an issue assigned to **Member 5**. Member 5 will update the frozen root configuration and publish an approved commit to `main`.

## 4. Running Partitions Standalone

### Member 1: Frontend & UX
```bash
# In apps/web (runs with MSW mock handlers against seed data)
cd apps/web
VITE_USE_MOCKS=true npm run dev
# Or against live backend:
npm run dev
```

### Member 2: Backend Core & Handover
```bash
# In apps/api (runs with stubs for Risk, Workflow, and Audit)
cd apps/api
npm run dev
```

### Member 3: Matching & ML Engine
```bash
# In services/matching
cd services/matching
source ../../.venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Member 4: Security Workflows
```bash
# In apps/api with workflow module active and stub ports
cd apps/api
npm run test:workflow
```

### Member 5: DevOps, Audit & E2E
```bash
# Run full suite
make dev
make test
make e2e
```
