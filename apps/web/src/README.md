# Campus Recoverer - Frontend Web Application (@member1)

The frontend for **Campus Recoverer** is a zero-knowledge, privacy-preserving web interface built with React 18, Vite, Tailwind CSS, TanStack Query, and TypeScript.

## Key Features

1. **Zero-Knowledge Privacy Separation**:
   - **Public Directory (`/items`)**: Shows only non-identifying, visual physical characteristics (category, broad location, date found).
   - **Report Found Wizard (`/report-found`)**: 2-step wizard clearly distinguishing Step 1 (public broad details) from Step 2 (private proofs, hidden serial numbers, distinctive markings, contained items) that are never published.
   - **Ownership Challenge Questions (`/claim/:itemId`)**: Claimants submit descriptive details and answer dynamic zero-knowledge challenge questions derived from registered characteristics.
2. **Score Guidance Invariant**:
   - Scores are strictly labeled **"Ownership Match Score / Claim Confidence Score"** (never "owner probability").
   - Explicit mandatory banner: **"Score is guidance; security makes the final decision."**
   - Detects multiple high-confidence competing claims and displays an amber alert with side-by-side comparison.
3. **Contactless Handover & Custody Verification (`/admin/desk`, `/collection/:claimId`)**:
   - Approved claimants receive an HMAC-SHA256 cryptographically signed QR code with real-time expiration countdown.
   - A single-use 6-digit OTP is automatically sent to the claimant's notification inbox.
   - Security desk officers scan the QR code (via camera using `html5-qrcode` or manual input), verify the 6-digit OTP, and must check "Photo ID Verified" for **HIGH RISK** items before release.
4. **Tamper-Evident Audit Console (`/admin/audit`)**:
   - Displays append-only SHA-256 chained audit logs.
   - One-click cryptographic verification validates the integrity of the hash chain.

## Running Locally

```bash
# Install dependencies (root)
npm install

# Start Vite dev server
npm run dev --workspace=@campus-recoverer/web

# Build for production
npm run build --workspace=@campus-recoverer/web
```

## Directory Structure

```
apps/web/
├── src/
│   ├── admin/           # Security desk, claim review, audit, high-risk console
│   ├── components/      # Badges, Navbar, Sidebar, Table, Modal, ItemCard, NotificationBell
│   ├── hooks/           # Custom React hooks
│   ├── layouts/         # RootLayout, AdminLayout (role-guarded)
│   ├── pages/           # Dashboard, PublicListing, ItemDetails, ReportFound/Lost, Claims, Collection
│   ├── services/        # API clients (items, claims, handover, workflow, audit, notifications)
│   ├── utils/           # Formatters, date helpers, cn class merge
│   └── routes/          # User routes hierarchy
```
