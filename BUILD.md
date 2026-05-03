# BUILD.md — BILSEN Review System

Step-by-step instructions to build and run the system from a fresh clone. Targets a developer who has never touched the repo.

## 1. Prerequisites

- **Node.js 20 or later** (the project targets Next.js 16 + React 19, which require Node 20+).
- **npm 10 or later** (ships with Node 20).
- **git** for cloning.
- **~500 MB free disk space** for `node_modules`.
- A modern browser (Chrome / Edge / Firefox / Safari) for the dev server.

Verify with:

```bash
node --version    # v20.x or v22.x
npm --version     # 10.x or higher
git --version
```

## 2. Get the source

```bash
git clone <repo-url> cs319
cd cs319
```

Or download a zip from the repo host and extract it.

## 3. Install dependencies

```bash
npm install
```

This installs Next.js 16, React 19, NextAuth 5, Tailwind 4, shadcn, the Anthropic SDK, Resend, pdf-parse, pdf-lib, perfect-freehand, and dev-only tooling. Expect ~3 minutes on a fast connection.

## 4. Configure environment

Create a file named `.env` at the project root. Minimum:

```dotenv
AUTH_SECRET=<at-least-32-random-characters>
AUTH_URL=http://localhost:3000
```

Generate a strong `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or, on a Unix-like shell:

```bash
openssl rand -hex 32
```

Optional variables (each enables a feature; missing keys soft-fail):

| Variable | Effect when set |
|---|---|
| `AUTH_TRUST_HOST` | Set `true` behind a reverse proxy (Vercel, Cloudflare) so NextAuth trusts forwarded host headers. |
| `COORDINATOR_EMAILS` | Comma-separated list of emails auto-promoted to Coordinator on first sign-up. |
| `ANTHROPIC_API_KEY` | Enables every AI feature: compliance, review suggestions, synthesis report, annotated PDF generation. |
| `RESEND_API_KEY` | Enables transactional email. Without it, the in-app notification feed still works. |
| `EMAIL_FROM` | Sender address; defaults to `BILSEN <noreply@bilsen.app>`. |
| `CRON_SECRET` | Bearer token required by `POST /api/cron/reminders` (the reminder job). Required if you schedule reminders. |
| `NODE_ENV` | Standard. `development` or `production`. |

## 5. Seed test data (recommended)

Populate the local data store with a known-password set of users:

```bash
node scripts/seed-fake-users.mjs
```

This rewrites every account in `data/users.json` to share the password `password123` and regenerates `scripts/SEED_CREDENTIALS.md` with the full list grouped by role. It does **not** touch papers, assignments, or reviews. Two of the seeded accounts are coordinators; the rest are members.

## 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with any seeded account (password: `password123`). Coordinator accounts (`anshumanmullick7@gmail.com`, `eray.tuzun@bilkent.edu.tr`) see `/admin/*` in the sidebar; everyone else sees the member view.

## 7. Production build

```bash
npm run build
npm start
```

`npm run build` emits `.next/` (and a `.next/standalone/` directory suitable for container deployment). `npm start` serves it on port 3000 by default; pass `PORT=...` to change it.

## 8. Verify the install

After `npm run dev`:

1. Visit `/dashboard` — you should see your stats card, recent papers, and notifications feed.
2. Visit `/papers/new` and create a test paper (any PDF will do).
3. As a coordinator, visit `/admin/dashboard` — you should see admin-only widgets and `/admin/venues`, `/admin/reviewers`.
4. From `/admin/venues/new`, create a test venue, return to your test paper, and confirm the Compliance card runs (basic checks always run; AI compliance only with `ANTHROPIC_API_KEY`).

## 9. Build the user manual PDF

```bash
node scripts/build-user-manual.mjs
```

This generates two files at the project root from a single source-of-truth content array:

- `USER_MANUAL.pdf` — the printable manual for the D5 final-report bundle.
- `USER_MANUAL.md` — a Markdown companion that renders on GitHub.

The script uses `pdf-lib` (already a dependency) — it does not need any extra install. Re-run it after editing `scripts/build-user-manual.mjs` to refresh both outputs.

## 10. Optional integrations

### Anthropic (AI features)

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/).
2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env`.
3. Restart the dev server. AI compliance, review suggestions, synthesis report, and annotated PDF generation start working.

### Resend (email)

1. Create a Resend account, verify your sender domain, get an API key.
2. Add `RESEND_API_KEY=re_...` and (optionally) `EMAIL_FROM=BILSEN <noreply@yourdomain.com>` to `.env`.
3. Restart. Notifications go out via email automatically; in-app notifications still work as well.

### Scheduled deadline reminders

The reminder logic is implemented at `POST /api/cron/reminders`; you need an external scheduler to call it.

- Set `CRON_SECRET=<random-token>` in `.env`.
- Schedule a daily HTTPS POST with header:

```http
Authorization: Bearer <CRON_SECRET>
```

Common scheduler options: Vercel Cron (define in `vercel.json`), GitHub Actions (`schedule` trigger), or any external scheduler that can hit an authenticated endpoint.

## 11. Deploy to Vercel

1. Push the repo to GitHub / GitLab.
2. Connect it on Vercel and let the default Next.js build run (`npm run build`).
3. In the Vercel dashboard, set every env var from sections 4 and 10. **Do not skip `AUTH_TRUST_HOST=true` — NextAuth refuses to issue cookies behind Vercel's proxy without it.**
4. Set `AUTH_URL` to the Vercel-issued domain (or a custom domain).
5. (Optional) Configure Vercel Cron in `vercel.json` to hit `/api/cron/reminders` once a day with the `Authorization: Bearer <CRON_SECRET>` header.

## 12. Troubleshooting build errors

- **"Cannot find module 'X'" during `npm run dev`** — `npm install` did not finish cleanly. Delete `node_modules/` and `package-lock.json`, then re-run `npm install`.
- **"Port 3000 is already in use"** — another process is using the port. Either stop it, or run with a different port: `PORT=3001 npm run dev`.
- **"EPERM" / "EACCES" writing to `data/`** — Node cannot write JSON files. Make sure the `data/` directory exists and your user has write permission. The data store auto-creates the directory if it can.
- **"AUTH_SECRET environment variable is missing"** — `.env` is not at the project root, or the dev server was started before the file existed. Stop, save `.env`, restart.
- **PDF text extraction returns empty** — the uploaded PDF is image-only. `pdf-parse` needs an embedded text layer; re-export from your authoring tool with text enabled, or run OCR first.
- **Tailwind classes do not apply** — restart the dev server after editing `tailwind.config.*`. Next.js' Turbopack caches the PostCSS pipeline.
- **"Hydration mismatch" after a code edit** — full page reload usually clears it. If not, stop `npm run dev`, delete `.next/`, restart.

## 13. Where things live

A short orientation map for someone reading the codebase the first time:

- `src/app/` — Next.js App Router pages and API routes.
- `src/components/` — React components grouped by feature (`papers/`, `reviews/`, `admin/`, `pdf/`, `auth/`, `profile/`, `dashboard/`).
- `src/lib/` — pure logic: `data-store.ts`, `ai.ts`, `ai-compliance.ts`, `coi-detection.ts`, `venue-recommender.ts`, `review-service.ts`, `pdf-parser.ts`, `pdf-export.ts`, `pdf-report.ts`, etc.
- `data/` — JSON files (created on first run): `users.json`, `papers.json`, `assignments.json`, `reviews.json`, `compliance_checks.json`, `annotations.json`, `notifications.json`, `venues.json`, `paper_versions.json`, etc.
- `scripts/` — utilities: `seed-fake-users.mjs`, `build-user-manual.mjs`.
- `uploads/` — paper PDF files (created on first upload).
- `USER_MANUAL.pdf` / `USER_MANUAL.md` — generated by step 9.
- `BUILD.md` — this file.

That's everything a third party needs to clone, build, run, and ship the system.
