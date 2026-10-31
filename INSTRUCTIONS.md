# Member 2: Backend Core & Handover Partition Instructions

## 1. Overview
You are **Member 2 (Backend Core, Database Foundation & Handover)** for Campus Recoverer.
Your partition is **strictly isolated** to:
- `apps/api/db/migrations/core/` (Core schema: Users, Items, Claims, Notifications)
- `apps/api/db/migrations/handover/` (Handover schema: QR tokens, OTPs, verified collection)
- `apps/api/src/modules/core/` (Item reporting, lost item registry, claims, auth controllers & routes)
- `apps/api/src/modules/handover/` (Handover verification, desk release, security QR scanning)

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
git checkout -b member2/backend-database
```

### Step 3: Copy your partition files into the repository
Copy all files from this `member-2-backend-core` folder into your repository root:
```bash
# Assuming member-2-backend-core is in your downloads or parent directory:
cp -r /path/to/member-2-backend-core/apps ./
```

### Step 4: Verify git status
Run `git status`. You should see only your core and handover modules:
```bash
git status
```

### Step 5: Commit and Push
```bash
git add apps/api/db/migrations/core/ apps/api/db/migrations/handover/ apps/api/src/modules/core/ apps/api/src/modules/handover/
git commit -m "feat(member-2): implement backend core, database migrations, and handover"
git push -u origin member2/backend-database
```

### Step 6: Create Pull Request
1. Go to GitHub: `https://github.com/3am-coderz/CampusRecoverer`
2. Open a Pull Request from `member2/backend-database` into `main`.
3. PR Title: `feat(member-2): implement backend core, database migrations, and handover`
4. GitHub will show **"Able to merge: These branches can be automatically merged"** with **zero merge conflicts**.

---

## 3. How to Run & Test Standalone
```bash
cd apps/api
npm install
npm test
npm run dev
# The backend will listen on http://localhost:4000
```
