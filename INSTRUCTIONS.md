# Member 1: Frontend & UX Partition Instructions

## 1. Overview
You are **Member 1 (Frontend & UX)** for Campus Recoverer.
Your partition is **strictly isolated** to the web application:
- `apps/web/src/components/`
- `apps/web/src/pages/`
- `apps/web/src/layouts/`
- `apps/web/src/services/`
- `apps/web/src/utils/`
- `apps/web/src/routes/`
- `apps/web/src/admin/`
- `apps/web/index.html`
- `apps/web/vite.config.ts`
- `apps/web/tailwind.config.js`
- `apps/web/postcss.config.js`
- `apps/web/src/index.css`
- `apps/web/src/main.tsx`

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
git checkout -b member1/frontend-ux
```

### Step 3: Copy your partition files into the repository
Copy all files from this `member-1-frontend` folder into your repository root:
```bash
# Assuming member-1-frontend is in your downloads or parent directory:
cp -r /path/to/member-1-frontend/apps ./
```

### Step 4: Verify git status
Run `git status`. You should see only `apps/web` files modified/added:
```bash
git status
```

### Step 5: Commit and Push
```bash
git add apps/web/
git commit -m "feat(member-1): implement frontend UI, pages, and routing"
git push -u origin member1/frontend-ux
```

### Step 6: Create Pull Request
1. Go to GitHub: `https://github.com/3am-coderz/CampusRecoverer`
2. Open a Pull Request from `member1/frontend-ux` into `main`.
3. PR Title: `feat(member-1): implement frontend UI, pages, and routing`
4. GitHub will show **"Able to merge: These branches can be automatically merged"** with **zero merge conflicts**.

---

## 3. How to Run & Test Standalone
```bash
cd apps/web
npm install
npm run dev
# The website will be available at http://localhost:5173
```
