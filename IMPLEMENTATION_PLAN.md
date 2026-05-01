# CS319 Review System - Implementation Plan and Checklist

## Status Summary

- Last verified against `main`: **2026-04-18**
- Storage: JSON file-based (`data/*.json`) via `src/lib/data-store.ts` with a mock-mode toggle.
- The previous version of this file understated progress — many P0/P1 items were already shipped but still marked partial. This revision aligns the checklist with actual code behavior.

## Legend
- `[x]` Completed
- `[~]` Partially implemented (exists but incomplete, stubbed, or missing required behavior)
- `[ ]` Not implemented

## 1) Core Platform and Workflow

### Authentication, Roles, Access
- [x] Sign-in and session auth flow (`src/auth.ts`, NextAuth credentials provider).
- [x] Role-based access control (`COORDINATOR`, `REVIEWER`, `AUTHOR`, `MEMBER`).
- [x] Protected coordinator/member route behavior.
- [x] Coordinator-only APIs/pages for review management and analytics.

### Paper and Review Lifecycle
- [x] Paper submission/list/detail workflow.
- [x] Venue metadata fields and venue selection page.
- [x] Review rounds and assignments.
- [x] Reviewer accept/decline flow.
- [x] Decline requires reason.
- [x] Extension request flow for reviewers.
- [x] Coordinator approval/denial for extension requests.
- [x] Review submission flow.
- [x] Member dashboard and coordinator dashboard UIs.
- [x] Revision iteration workflow (slide 10): coordinator "Request Revision" dialog with a note, author-facing banner showing the note, and a "Start next round" button that creates a new round (with `priorReviewerIds` snapshot) and routes to the assign page.

### Notifications and Communication
- [x] In-app notifications storage and API.
- [x] Unread count and notification center UI.
- [x] Real email integration via Resend (`src/lib/email.ts`, `RESEND_API_KEY`, `sentViaEmail` flag set on dispatch; soft-fails when key is missing).
- [~] Slack integration endpoints exist (`src/app/api/slack/{events,commands,interactions}/route.ts`) but handlers are stub-level (echo challenge only; no Bolt.js, no real dispatch).

## 2) Slide-Driven Requirement Coverage

## Slide 15: Real-time Compliance Automation
- [x] Basic compliance checks implemented:
    - Abstract word count
    - Required section heuristics
    - Metadata/anonymity heuristics
    - Page-limit checks (when page count is available)
- [x] Compliance results stored and viewed.
- [x] Compliance auto-triggers on paper CREATE and on paper UPDATE with a venue (`runComplianceChecks()` called from `createPaper` at `src/lib/review-service.ts:366` and from `updatePaper` at line 530).
- [x] Reference-format compliance (ACM author-year and IEEE bracket-numbered detection in `runComplianceChecks()`).
- [~] Anonymity checks — organization-name patterns, academic URLs, emails, and GitHub/LinkedIn profile detection are implemented (review-service.ts ~1576–1603). Also:
    - [x] PDF metadata field clearing validation via `pdf-lib` (`src/lib/pdf-metadata.ts`, `PDF_METADATA_ANONYMITY` check auto-fetches the PDF when `pdfUrl` is HTTP).
    - [x] Tool/dataset link analysis beyond generic URL detection (`TOOL_LINK_ANONYMITY` check via `findIdentityRevealingLinks` in `src/lib/validation-profiles.ts`).
- [x] Dynamic checklist activation by paper type (`DYNAMIC_CHECKLIST` check driven by `getValidationProfile` in `src/lib/validation-profiles.ts`).
- [x] Track-specific compliance logic / validation profiles (profile lookup keyed by `(paperType, track)`; profiles inject extra required sections + checklist keywords).

## Slide 16: Reviewer Assignment and Workload
- [x] Reviewer assignment workflows/pages/APIs.
- [x] Workload visibility (assigned / reviews / extension counts).
- [x] Reviewer performance stats captured and surfaced.
- [~] Assignment quality is operator-driven (sorted candidates) rather than automatic optimization.
- [x] Overleaf link storage per paper (`Paper.overleafUrl`, shown on paper detail and review workspace).
- [x] Automatic Overleaf link inclusion in reviewer assignment notifications (email + in-app; also included in reminder cron).
- [x] Prior-round reviewer history surfacing on the assignment page (history card + "Prior" pill in the reviewer picker).
- [x] Proactive overload/inactivity detection (`ReviewerAttentionCard` on `/admin/dashboard`; stalled-after-accept + overload entries).

## Slide 17: Reminders and Deadline Alerts
- [x] Due dates and status transitions.
- [x] Overdue state logic in service calculations.
- [x] Scheduled reminder job — `src/app/api/cron/reminders/route.ts` dispatches `DEADLINE_REMINDER` at 3-day and 1-day marks and `DEADLINE_OVERDUE` past due; transitions assignments to `OVERDUE`; notifies reviewer and coordinators; Bearer-token authed via `CRON_SECRET`; idempotency via `wasNotifiedRecently()`.
- [x] Real email reminders via Resend (see Notifications section).

## Slide 18: AI-Powered Review Support
- [x] AI endpoints using the Anthropic SDK (`src/lib/ai.ts`, model `claude-sonnet-4-5-20250929`); `POST /api/ai/review` and `POST /api/ai/suggestions` are functional.
- [ ] Overleaf inline AI suggestion/comment integration.
- [x] Hallucination/unsupported-claim mitigation: `generateReviewWithClaude` requires verbatim quotes per claim and post-processes against the source text; unsupported claims are flagged via `unsupported: true` and tallied in `unsupportedCount`.
- [x] Final report artifact generation: `generateAndStoreFinalReport` synthesizes consensus from all reviews and persists to `data/ai_reports.json`; downloadable via `GET /api/papers/[id]/ai-report/pdf`.
- [x] Annotated PDF generation: `POST /api/papers/[id]/ai-annotated-pdf` runs grounded AI review and overlays per-page annotations via `buildAnnotatedPdf` in `src/lib/pdf-report.ts`.

## Slide 19: Reviewer Rating and Analytics
- [x] Reviewer rating backend/API/data structures (`POST /api/reviews/[id]/rate`).
- [x] Coordinator analytics dashboard pages and APIs.
- [x] Reviewer leaderboard/workload/overview views.
- [x] Author-facing rating submission UX (`<RateReviewForm>` embedded on `/dashboard/papers/[id]` for authors on completed reviews).
- [x] Rating captures three axes — `qualityScore`, `quantityScore`, `timelinessScore` — and the leaderboard surfaces all three.
- [x] Monthly/yearly/overall time-window breakdowns (period param supported across `getReviewerLeaderboard()`, `getReviewerAnalytics()`; `PeriodSelector` UI on admin pages).

## Slide 20: Dashboard and Analytics Detail
- [x] Ranked reviewer leaderboard based on composite performance (`/admin/reviewers` ranks by overall rating with tiebreakers on completed count and on-time rate).
- [x] Assigned/completed reviews per reviewer tracked monthly, yearly, and overall.
- [x] Percentage of on-time vs delayed reviews per reviewer tracked across periods.
- [x] Acceptance/decline rates per reviewer — `acceptanceRate` sliced by period alongside on-time stats; leaderboard shows "Accept %" badge; reviewer detail page shows accepted/declined counts filtered to the selected period.
- [x] Average reviewer score aggregates across the three required axes.
- [x] Coordinator export/reporting capability (CSV/PDF) via `GET /api/admin/analytics/export?format=csv|pdf&type=leaderboard|workload&period=...`; export buttons on `/admin/reviewers` and `/admin/dashboard`.

## Slide 21: Optional — Venue Recommendation and Direct Submission
- [x] Venue metadata storage/form.
- [x] Automated venue recommendation engine (`recommendVenues` in `src/lib/venue-recommender.ts`; ranks by paper-type fit, topic-keyword overlap, open submission window). Surfaced via `GET /api/papers/[id]/recommendations` and `<VenueSubmissionCard>` on the paper detail page.
- [x] Direct venue submission integration (post-compliance pass): `POST /api/papers/[id]/submit-venue` enforces all latest compliance checks pass before transitioning the paper to `SUBMITTED_TO_VENUE`; coordinators are notified.

---

## 3) Remaining Gap Closure Plan

## Phase A — Finish Operational Last Mile
- [ ] Surface Overleaf link in reviewer assignment notifications (email + in-app payload).
- [ ] Wire real Slack dispatch:
    - Replace stubs with Bolt.js (or direct Web API) calls.
    - Send assignment DMs with Accept/Decline interactive buttons.
    - Post channel alerts for new assignments / overdue / round complete.
    - Route slash commands (`/bilsen status`, `/bilsen accept`, etc.).
- [ ] Proactive overload/inactivity alerts:
    - Flag reviewers who haven't started within a configurable window after accepting.
    - Flag reviewers exceeding a concurrent-assignment threshold.
    - Surface as a card on `/admin/dashboard`.
- [ ] Prior-round reviewer history panel on `/admin/papers/[id]/assign`:
    - List who reviewed in each previous round with their recommendation.
    - Visually deprioritize/exclude prior reviewers when picking new round assignees.

## Phase B — Slide 15 Compliance Depth
- [ ] PDF metadata field validation via pdf-lib (author, company fields must be empty when anonymity is required).
- [ ] Tool/dataset link analysis for author-revealing URLs (self-hosted domains, lab pages, etc.).
- [ ] Paper-type-specific checklist rules.
- [ ] Track-level rule sets and validation profiles.
- [ ] Improve section-detection reliability (parser quality, fallback handling).

## Phase C — Revision Iteration Flow
- [ ] Explicit "mark for revision" coordinator action → transitions paper to `REVISION_REQUESTED`.
- [ ] Author resubmission path that creates a new `ReviewRound` while preserving prior-round assignments + reviews.
- [ ] Assignment UI pre-populates prior-round context (see Phase A prior-round panel).

## Phase D — AI Review Support Productionization
- [ ] Evidence-grounded claim checks and unsupported-claim flags.
- [ ] Generate reviewer-ready structured reports.
- [ ] Annotated PDF export pipeline.
- [ ] Optional Overleaf comment sync.

## Phase E — Analytics Completion
- [ ] Per-reviewer acceptance/decline rate broken out monthly/yearly (parity with on-time stats).
- [ ] Review turnaround distributions.
- [ ] Delay and extension trends over time.
- [ ] Coordinator export/reporting (CSV/PDF).

## Phase F — Optional Advanced Features
- [ ] Venue recommendation model/service.
- [ ] Direct venue submission pipeline with compliance gate.
- [ ] Success/failure audit and retry logic for external submissions.

## Phase G — Nice-to-Have Enhancements
- [ ] Review templates with guided prompts (Summary / Strengths / Weaknesses / Minor / Questions).
- [ ] Rebuttal log — authors respond to each review comment with accepted/rejected/addressed + note.
- [ ] "What needs my attention" coordinator digest.
- [ ] Side-by-side diff view for revised papers.
- [ ] Reviewer availability calendar.
- [ ] Compliance fix suggestions (actionable guidance on failures).
- [ ] Audit log.
- [ ] Reviewer expertise tags.

## Phase H — Agentic AI Features
- [ ] AI-powered review draft assistant.
- [ ] Automated paper-reviewer matching (ranked suggestions with reasoning).
- [ ] Intelligent compliance fixer (proposes concrete fixes inline).
- [ ] Cross-review consistency checker.
- [ ] AI-driven revision gap analysis.

---

## 4) Immediate Sprint Backlog

- [ ] Sprint Item 1: Real Slack dispatch — DM + channel alerts + slash commands + interactive Accept/Decline. (Deferred — needs live Slack workspace + bot token + signing secret.)
- [x] Sprint Item 2: Prior-round reviewer history panel on `/admin/papers/[id]/assign`.
- [x] Sprint Item 3: Proactive overload/inactivity detection on coordinator dashboard.
- [x] Sprint Item 4: Include Overleaf link in assignment notification payloads.
- [x] Sprint Item 5: "Mark for revision" coordinator action + guided round-2 creation.
- [x] Sprint Item 6: PDF metadata field clearing validation via pdf-lib.
- [x] Sprint Item 7: Monthly/yearly acceptance-rate slice on reviewer analytics (parity with on-time stats).

## 5) Verification Checklist (Definition of Done per Feature)
- [ ] Unit tests for new service logic.
- [ ] Integration tests for APIs (assignment/reminders/compliance/ratings/analytics).
- [ ] UI test coverage for key flows (submit, assign, review, rate, notify).
- [ ] Monitoring/logging for scheduled jobs and external integrations.
- [ ] Error handling and retry strategy verified for email/slack/AI/provider calls.
- [ ] Security checks for authz on every new endpoint.
- [ ] Documentation update for setup / env vars / jobs.

## 6) Risks and Dependencies
- External provider keys/configuration required (`RESEND_API_KEY`, `ANTHROPIC_API_KEY`, Slack tokens, `CRON_SECRET`).
- Scheduler hosting required — `/api/cron/reminders` needs an external trigger (Vercel Cron, n8n, GitHub Actions scheduled workflow, etc.).
- Compliance parsing quality depends on reliable document extraction.
- AI output quality control requires grounding and fallback behavior.

---

This checklist reflects current repository behavior on `main` as of 2026-04-18 and should be updated as each remaining item lands.
