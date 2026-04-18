# BILSEN Review Process Automation

This project implements a functional MVP of the system described in `BILSEN_Review_Automation.md` using Next.js (App Router), TypeScript, NextAuth, and a local JSON-backed datastore.

## Implemented Scope

- Authentication with role-aware sessions (`COORDINATOR`, `MEMBER`)
- Member flows:
  - Dashboard
  - Paper listing and submission
  - Paper detail with review rounds and compliance results
  - My assignments (`accept`, `decline`, `request extension`, `submit review`)
  - Profile and Slack linking
- Coordinator flows:
  - Admin dashboard overview + workload
  - Reviewer leaderboard and reviewer detail analytics
  - Venue management
  - Reviewer assignment page (creates rounds, assigns reviewers, handles extension decisions)
- API routes for papers, rounds, assignments, reviews, ratings, notifications, analytics, users, venues, compliance
- Slack + AI endpoints are scaffolded with deterministic local behavior/stubs

## Tech Notes

- Persistence is file-based in `data/*.json` via `src/lib/data-store.ts`.
- Business logic is centralized in `src/lib/review-service.ts`.
- Role and account management is in `src/lib/users.ts`.
- Route protection is handled in `proxy.ts`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```env
AUTH_SECRET=your_secret
AUTH_URL=http://localhost:3000
# optional for local dev; production should set this to true behind a reverse proxy
AUTH_TRUST_HOST=false
# optional: comma-separated emails that should auto-register as coordinators
COORDINATOR_EMAILS=example@bilkent.edu.tr
```

3. Run development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Railway Deployment

Set these Railway variables for Auth.js:

```env
AUTH_SECRET=<strong-random-secret>
AUTH_URL=https://<your-railway-domain>
AUTH_TRUST_HOST=true
```

If you add a custom domain, update `AUTH_URL` to that domain and redeploy.

## Validation

- Lint: `npm run lint`
- Production build: `npm run build`

Both commands pass on the current code.
