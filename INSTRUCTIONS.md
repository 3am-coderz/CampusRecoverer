# 0-shared-base: Repository Skeleton for `main` Branch

## 1. Purpose
This folder contains the **Frozen Shared Kernel and Base Configurations** for Campus Recoverer.
Before team members open their feature branch Pull Requests, the `main` branch of the GitHub repository should have these base files.

## 2. Included Files:
- Root config files: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`, `.gitignore`, `.eslintrc.json`, `.prettierrc`, `README.md`, `CODEOWNERS`
- Contracts: `contracts/` (OpenAPI definitions, shared schemas, seed data)
- Documentation: `docs/GIT_WORKFLOW.md`
- Backend Kernel: `apps/api/src/kernel/`, `apps/api/package.json`, `apps/api/tsconfig.json`
- Frontend Kernel: `apps/web/src/kernel/`, `apps/web/package.json`, `apps/web/tsconfig.json`

## 3. How to Push to `main`:
If the GitHub `main` branch does not have the base skeleton yet:
```bash
git clone https://github.com/3am-coderz/CampusRecoverer.git
cd CampusRecoverer
git checkout main

# Copy files from 0-shared-base into repo root:
cp -r /path/to/0-shared-base/* ./
cp /path/to/0-shared-base/.* ./ 2>/dev/null || true

git add .
git commit -m "chore(phase-0): initialize frozen shared kernel, contracts, and workspace foundation"
git push origin main
```
Once `main` has this base commit, all 5 members can branch from `main`, copy their isolated folders, and push with **zero conflicts**!
