# Member 3: Matching & ML Engine Partition Instructions

## 1. Overview
You are **Member 3 (Team Lead & ML/Matching Engineer)** for Campus Recoverer.
Your partition is **strictly isolated** to the Python matching engine:
- `services/__init__.py`
- `services/matching/config.py`
- `services/matching/main.py`
- `services/matching/data/` (Synthetic dataset generator)
- `services/matching/engine/` (Deterministic rules, TF-IDF / semantic cosine similarity, hybrid scoring)
- `services/matching/tests/` (Unit tests for matching scores & confidence thresholds)
- `services/matching/ENV.md`
- `services/matching/README.md`

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
git checkout -b member3/matching-ml-engine
```

### Step 3: Copy your partition files into the repository
Copy all files from this `member-3-ml-matching` folder into your repository root:
```bash
# Assuming member-3-ml-matching is in your downloads or parent directory:
cp -r /path/to/member-3-ml-matching/services ./
```

### Step 4: Verify git status
Run `git status`. You should see only `services/` added:
```bash
git status
```

### Step 5: Commit and Push
```bash
git add services/
git commit -m "feat(member-3): implement matching and ML similarity service"
git push -u origin member3/matching-ml-engine
```

### Step 6: Create Pull Request
1. Go to GitHub: `https://github.com/3am-coderz/CampusRecoverer`
2. Open a Pull Request from `member3/matching-ml-engine` into `main`.
3. PR Title: `feat(member-3): implement matching and ML similarity service`
4. GitHub will show **"Able to merge: These branches can be automatically merged"** with **zero merge conflicts**.

---

## 3. How to Run & Test Standalone
```bash
cd services/matching
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt || pip install fastapi uvicorn pydantic scikit-learn pytest
pytest tests/
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Listening on http://localhost:8000
```
