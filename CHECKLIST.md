# BILSEN Review System — Slide-by-Slide Implementation Checklist

Audit of `slides319.pptx` requirements against the actual code on `main`. Generated 2026-04-30.

**Sources cross-referenced:**
- `slides319.pptx` (22 slides — extracted via `_extract_pptx.js`)
- `IMPLEMENTATION_PLAN.md` (note: its Phase A–G "Remaining Gap Closure Plan" section is **stale** — many items there are actually done; trust the slide-by-slide statuses below)
- `Deliverables/D4/` (high-level architecture doc)
- `BILSEN_Review_Automation.md` (full product spec at repo root)
- Live code under `src/`, `data/`

**Status legend:**
- `[DONE]` — implemented and reachable; spot-checked file path exists
- `[PARTIAL]` — works for the happy path but missing depth (config knobs, edge cases, real backend wiring)
- `[TODO]` — not implemented

**Note on git state:** Many `[DONE]` items live in **untracked files** (Phase A–B work). They function but are not committed yet — see "Discrepancies" section.

---

## Slides 1–3: Project framing
Informational only — no implementation required (title slide, BILSEN group context, project goal).

## Slides 4–11: Current (baseline) process
Informational — describes the manual workflow being replaced. No code needed.

## Slides 12–14: Limitations & justification
Informational — motivates the build. No code needed.

---

## Slide 15: Real-time Compliance Automation

| Requirement (verbatim from slide) | Status | Where |
|---|---|---|
| Page limit | `[DONE]` | `runComplianceChecks()` in `src/lib/review-service.ts` (PAGE_LIMIT) |
| Abstract word count | `[DONE]` | same file (ABSTRACT_WORD_COUNT) |
| Required sections | `[DONE]` | same file (REQUIRED_SECTIONS) — heuristic newline-based parser |
| Reference format | `[DONE]` | ACM author-year + IEEE bracket-numbered detection in `runComplianceChecks()` |
| Anonymity (org/institution patterns, emails, GitHub/LinkedIn URLs) | `[DONE]` | review-service.ts ANONYMITY_CHECK |
| Anonymity — clear PDF metadata (author, company fields) | `[DONE]` | `src/lib/pdf-metadata.ts` + `PDF_METADATA_ANONYMITY` check (auto-fetches PDF when `pdfUrl` is HTTP) |
| Anonymity — tool/dataset links don't reveal author identity | `[DONE]` | `findIdentityRevealingLinks()` in `src/lib/validation-profiles.ts` (TOOL_LINK_ANONYMITY check) |
| Detect paper type (research, survey, etc.) and activate appropriate checklist dynamically | `[DONE]` | `getValidationProfile(paperType, track)` in `src/lib/validation-profiles.ts` (DYNAMIC_CHECKLIST check) |
| Track-specific compliance rules | `[DONE]` | profile lookup keyed by `(paperType, track)` |
| Section-detection reliability for malformed/complex PDFs | `[PARTIAL]` | parser is regex/newline heuristic — fragile on unusual layouts |
| Compliance fix suggestions (actionable guidance, not just pass/fail) | `[TODO]` | only pass/fail today |

**Slide 15 verdict:** 9/11 done. Remaining: parser robustness + fix suggestions.

---

## Slide 16: Reviewer Assignment & Workload Balancing

| Requirement | Status | Where |
|---|---|---|
| Coordinator selects reviewers + deadline | `[DONE]` | `src/app/(dashboard)/admin/papers/[id]/assign/page.tsx` |
| System auto-notifies reviewers by email | `[DONE]` | `assignReviewers()` in review-service.ts triggers `createNotification` -> `sendNotificationEmail` (Resend) |
| Track assigned reviews per reviewer | `[DONE]` | `getWorkloadAnalytics()` |
| Reviewers can accept assignments | `[DONE]` | `GET /api/assignments/[id]/accept` |
| Reviewers can decline (with valid reason) | `[DONE]` | `GET /api/assignments/[id]/decline` (reason required) |
| Reviewers can request deadline extensions | `[DONE]` | `POST /api/assignments/[id]/extend` |
| Coordinator approve/deny extension | `[DONE]` | `extension-decision-form.tsx`, `/extend/approve` route |
| Balanced workload distribution | `[PARTIAL]` | candidates sorted by current load — operator-driven, not auto-optimal matching |
| Early detection of overload or inactivity | `[DONE]` | `<ReviewerAttentionCard>` on `/admin/dashboard` (>5 active = overloaded; >5 days stalled after accept = inactive) |
| Enable reviewer selection in future rounds (history-aware) | `[DONE]` | prior-round history card + "Prior" pill on assign page; `priorReviewerIds` snapshot on `ReviewRoundRecord` |
| Overleaf link surfaced to reviewers in assignment | `[DONE]` | included in email + in-app notification + reminder cron payload |
| Conflict-of-interest check (e.g. same org as author) | `[TODO]` | no COI logic anywhere |
| Reviewer expertise tags / matching | `[TODO]` | no tags on User model |

**Slide 16 verdict:** 11/13 done. Remaining: COI detection + expertise-based matching.

---

## Slide 17: Automated Coordination & Deadline Management

| Requirement | Status | Where |
|---|---|---|
| Reminder emails as deadline approaches | `[DONE]` | `src/app/api/cron/reminders/route.ts` (3-day + 1-day reminders) |
| Alerts to coordinator when deadlines missed | `[DONE]` | same cron — DEADLINE_OVERDUE notification dispatched to coordinators |
| Auto-transition to OVERDUE status | `[DONE]` | cron flips assignment status |
| Idempotency (don't re-spam) | `[DONE]` | `wasNotifiedRecently()` 1-day guard |
| Bearer-auth on cron endpoint | `[DONE]` | `CRON_SECRET` env var |
| External scheduler wired (Vercel Cron / GH Actions / n8n) | `[TODO]` | endpoint exists but no `vercel.json` cron config or scheduled workflow committed — currently only a "Run reminders" button on the dashboard |
| Real email delivery | `[DONE]` | Resend (`src/lib/email.ts`); soft-fails without API key |

**Slide 17 verdict:** 6/7 done. Remaining: hooking the cron to an actual scheduler in production.

---

## Slide 18: AI-Assisted Review Support (for Authors)

| Requirement | Status | Where |
|---|---|---|
| Highlight issues in Overleaf with free-form comment suggestions ("ideal one") | `[TODO]` | no Overleaf API integration |
| Generate formal review reports based on predefined template | `[DONE]` | `generateAndStoreFinalReport()` in review-service.ts; `POST /api/papers/[id]/ai-report` |
| Annotated PDF with highlighted issues + suggested improvements | `[DONE]` | `buildAnnotatedPdf()` in `src/lib/pdf-report.ts`; `POST /api/papers/[id]/ai-annotated-pdf` |
| Structured, checklist-based compliance checks | `[DONE]` | covered under Slide 15 |
| No hallucinated references | `[DONE]` | `generateReviewWithClaude()` enforces verbatim quotes; `checkClaim()` post-processes against source text |
| No unsupported claims | `[DONE]` | flagged with `unsupported: true`, tallied in `unsupportedCount` |
| AI suggestions endpoint for authors | `[DONE]` | `POST /api/ai/suggestions` |
| Final report PDF download | `[DONE]` | `GET /api/papers/[id]/ai-report/pdf` via `buildFinalReportPdf()` |
| Author-facing UI to trigger AI report | `[DONE]` | `<AiReportActions>` component on paper detail |

**Slide 18 verdict:** 8/9 done. Remaining: Overleaf inline comment sync (the "ideal" mode) — blocked on Overleaf's API.

---

## Slide 19: Reviewer Evaluation Mechanism

| Requirement | Status | Where |
|---|---|---|
| Authors rate reviewers after completion | `[DONE]` | `<RateReviewForm>` on paper detail; `POST /api/reviews/[id]/rate` |
| Rating axis: Quality of comments | `[DONE]` | `qualityScore` 1–5 |
| Rating axis: Quantity of feedback | `[DONE]` | `quantityScore` 1–5 |
| Rating axis: Timeliness | `[DONE]` | `timelinessScore` 1–5 |
| Ratings feed reviewer performance statistics | `[DONE]` | `getReviewerLeaderboard()`, `getReviewerAnalytics()` |
| Long-term quality monitoring (historical retention) | `[DONE]` | persisted in `data/ratings.json`, no auto-purge |
| Author can edit / withdraw rating | `[TODO]` | submit-only; no edit UI |

**Slide 19 verdict:** 6/7 done. Remaining: edit/withdraw rating (low priority).

---

## Slide 20: Dashboard & Analytics Detail

| Requirement | Status | Where |
|---|---|---|
| Ranked list of reviewers by composite performance | `[DONE]` | `/admin/reviewers` — ranked by `(avgOverallRating, completedCount, onTimeRate)` |
| Assigned + completed reviews per reviewer (monthly / yearly / overall) | `[DONE]` | `getReviewerAnalytics(reviewerId, period)` + `<PeriodSelector>` |
| Acceptance / rejection rates per reviewer (monthly / yearly / overall) | `[DONE]` | `acceptanceRate` in leaderboard, accept/decline counts on detail page, period-sliced |
| % on-time vs delayed reviews per reviewer (monthly / yearly / overall) | `[DONE]` | `onTimeRate` in leaderboard, period-sliced |
| Average reviewer score | `[DONE]` | `averageOverallRating` |
| Coordinator export (CSV / PDF) | `[DONE]` | `GET /api/admin/analytics/export?format=csv\|pdf&type=leaderboard\|workload&period=...`; `<AnalyticsExportButtons>` |
| Workload distribution view | `[DONE]` | workload table on `/admin/dashboard`; reviewer attention card |
| Review turnaround distribution (histogram) | `[TODO]` | no histogram data |
| Delay & extension trends over time | `[TODO]` | no trend chart |

**Slide 20 verdict:** 7/9 done. Remaining: turnaround distribution + trend lines.

---

## Slide 21: Venue Recommendation & Submission Support (OPTIONAL)

| Requirement | Status | Where |
|---|---|---|
| Recommend venues based on paper type + content | `[DONE]` | `recommendVenues()` in `src/lib/venue-recommender.ts` (paper-type fit + keyword overlap + open submission window) |
| Authors select target venue | `[DONE]` | venue selector on submission form + `<VenueSubmissionCard>` |
| Direct submit once all checks satisfied | `[DONE]` | `POST /api/papers/[id]/submit-venue` enforces all latest compliance checks pass before transitioning to `SUBMITTED_TO_VENUE` |
| Notify coordinators on venue submission | `[DONE]` | dispatched in `submitPaperToVenue()` |
| Verify submission deadline hasn't passed | `[TODO]` | no deadline check at submit time |
| Success/failure audit trail for external submissions | `[TODO]` | no retry/audit logic |

**Slide 21 verdict:** 4/6 done. Remaining: deadline gating + audit/retry.

---

## Cross-cutting features (mentioned across slides / spec)

| Requirement | Status | Where |
|---|---|---|
| User auth + roles (Coordinator / Member / Author / Reviewer) | `[DONE]` | NextAuth in `src/auth.ts`, role checks in `src/lib/auth-helpers.ts` |
| Multi-round revision iteration (slide 10) | `[DONE]` | "Request Revision" dialog -> `POST /api/papers/[id]/revision` -> "Start next round" -> new `ReviewRoundRecord` with `priorReviewerIds` snapshot |
| Real Slack dispatch (DMs, channel alerts, slash commands, interactive Accept/Decline) | `[PARTIAL]` | endpoints `/api/slack/{events,commands,interactions}` exist but only echo challenge; no Bolt.js, no real send. **Largest functional gap from the spec.** |
| Slack account linking | `[PARTIAL]` | UI scaffold (`link-slack-form.tsx`, `POST /api/users/link-slack`) exists; no end-to-end flow because Slack itself isn't dispatching |
| Audit log of decisions | `[TODO]` | no audit table |
| Rebuttal phase / author response to individual review comments | `[TODO]` | not modeled |
| Side-by-side diff for revised papers | `[TODO]` |  |
| Reviewer availability calendar | `[TODO]` |  |
| Unit / integration / UI tests | `[TODO]` | no test runner configured |
| Production monitoring / Sentry / structured logs | `[TODO]` |  |

---

## "Left to do" summary, prioritized

**P0 — actually blocks demo:**
1. Commit the untracked Phase A–B work (already implemented but uncommitted).
2. Wire the cron to a real scheduler (Vercel Cron config or GH Actions) so reminders fire without manual button clicks.

**P1 — features the slides explicitly listed but aren't real yet:**
3. Real Slack dispatch (Bolt.js, DMs, slash commands, channel alerts) — biggest functional gap from the spec.
4. Conflict-of-interest check at assignment time.
5. Reviewer expertise tags + matching.
6. Compliance fix suggestions (turn pass/fail into actionable guidance).
7. Robust section-detection parser for compliance.

**P2 — Slide 20 visualizations not yet drawn:**
8. Review turnaround distribution chart.
9. Delay/extension trends over time.

**P3 — slide 21 polish (optional feature):**
10. Venue submission deadline gating.
11. Submission audit trail / retry logic.

**P4 — Overleaf "ideal" integration:**
12. Inline AI comment sync to Overleaf (slide 18 "ideal one") — blocked on Overleaf's API.

**Quality / production-readiness (cross-cutting, not in slides):**
13. Tests (unit + integration + UI).
14. Monitoring/logging.
15. Audit log.
16. Documentation refresh (env vars, scheduler setup, deployment).

---

## Discrepancies you should know about

1. **`IMPLEMENTATION_PLAN.md` Phase A–G "Remaining Gap Closure Plan" is stale.** Those checkboxes are mostly unchecked (`[ ]`) but the Slide 15–21 coverage section above them shows the same items as `[x]`. Reading the file top-to-bottom is misleading; the slide-by-slide section is the accurate source. Consider deleting or rewriting §3 of that file.

2. **Many "DONE" items are uncommitted.** `src/lib/{venue-recommender,validation-profiles,pdf-metadata,pdf-report,csv}.ts`, `src/app/api/papers/[id]/{ai-annotated-pdf,ai-report,recommendations,revision,submit-venue}/route.ts`, `src/app/api/admin/analytics/export/route.ts`, `src/app/(dashboard)/papers/[id]/edit/page.tsx`, and several components are all untracked. They function but a fresh clone of `main` won't have them.

3. **Slack is the largest false-positive in `BILSEN_Review_Automation.md`.** The spec describes an extensive Slack experience (DMs, slash commands, channels, weekly digest). The endpoints exist as stubs only.

---

## Verification — how to spot-check this checklist

1. **Run dev server:** `npm install && npm run dev`, log in as a coordinator (set your email in `COORDINATOR_EMAILS`), submit a paper, watch compliance fire.
2. **Check assign page:** navigate to `/admin/papers/<id>/assign` and confirm prior-round history card + "Prior" pill render when a paper has a prior round.
3. **Check reviewer dashboard:** `/admin/dashboard` should show stats cards, workload table, ReviewerAttentionCard, period selector, CSV/PDF export buttons.
4. **Trigger reminders manually:** click "Run reminders" on dashboard or `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders` and watch notifications appear.
5. **Test AI:** with `ANTHROPIC_API_KEY` set, hit `POST /api/papers/<id>/ai-report` and download the PDF.
6. **Test venue submission:** open a paper detail page, view `<VenueSubmissionCard>`, confirm submit blocks until compliance passes.
7. **Confirm Slack stubs:** `POST /api/slack/commands` returns the challenge — no real action follows.
