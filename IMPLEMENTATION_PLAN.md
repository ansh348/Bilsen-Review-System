# CS319 Review System - Implementation Plan and Checklist

## Legend
- `[x]` Completed
- `[~]` Partially implemented (exists but incomplete, stubbed, or missing required behavior)
- `[ ]` Not implemented

## 1) Core Platform and Workflow

### Authentication, Roles, Access
- [x] Sign-in and session auth flow exists.
- [x] Role-based access control exists (`COORDINATOR`, `REVIEWER`, `AUTHOR` patterns).
- [x] Protected coordinator/member route behavior exists.
- [x] Coordinator-only APIs/pages exist for review management and analytics.

### Paper and Review Lifecycle
- [x] Paper submission/list/detail workflow exists.
- [x] Venue metadata fields and venue selection page exist.
- [x] Review rounds and assignments exist.
- [x] Reviewer accept/decline flow exists.
- [x] Decline requires reason.
- [x] Extension request flow exists for reviewers.
- [x] Coordinator approval/denial for extension requests exists.
- [x] Review submission flow exists.
- [x] Member dashboard and coordinator dashboard UIs exist.
- [~] Revision iteration workflow (slide 10): full loop of marking a paper for revision → author resubmits → new round created → new/different reviewers assigned (informed by prior round history) may not be fully supported as a guided workflow.

### Notifications and Communication
- [x] In-app notifications storage and API exist.
- [x] Unread count and notification center UI exist.
- [~] Email send behavior appears modeled in data flags, but real email integration is not completed.
- [~] Slack integration endpoints/pages exist, but event/interaction handling is still stub-level.

## 2) Slide-Driven Requirement Coverage (Thorough Checklist)

## Slide 15: Real-time Compliance Automation
- [x] Basic compliance checks are implemented:
    - Abstract word count checks
    - Required section heuristic checks
    - Basic metadata/anonymity heuristic checks
    - Page-limit checks (conditionally, when page count exists)
- [x] Compliance results can be stored and viewed.
- [~] Compliance currently appears user-triggered from UI, not guaranteed automatic on upload.
- [~] Anonymity checks are partial — slide 15 requires three distinct mechanisms:
    - [ ] Organization/institution name anonymization detection in body text.
    - [ ] PDF metadata field clearing validation (author, company fields).
    - [ ] Tool/dataset link analysis to ensure they do not reveal author identity.
- [ ] Reference-format compliance checks are not implemented.
- [ ] Dynamic checklist activation by paper type is not implemented.
- [ ] Track-specific compliance logic is not implemented.

## Slide 16: Reviewer Assignment and Workload
- [x] Reviewer assignment workflows/pages/APIs exist.
- [x] Workload visibility (assigned/reviews/extension counts) exists.
- [x] Reviewer performance stats are captured and surfaced.
- [~] Assignment quality is mostly manual/operator-driven (sorted candidates), not robust automatic balancing.
- [~] Rating/performance signals exist but full assignment optimization logic is limited.
- [ ] Prior-round reviewer history surfacing is not implemented (slide 10/16: system should show who reviewed in previous rounds so coordinators can assign different reviewers in later rounds).
- [ ] Proactive overload/inactivity detection is not implemented (slide 16: system should flag reviewers who haven't started or have too many concurrent assignments, not just display counts).
- [ ] Overleaf link storage per paper and automatic sharing with assigned reviewers is not confirmed (slide 4: coordinator currently shares Overleaf link manually; system should store and surface it in assignment notifications).

## Slide 17: Reminders and Deadline Alerts
- [x] Due dates and status transitions exist.
- [x] Overdue state logic exists in service calculations.
- [~] Reminder/overdue notification types exist in enums/data model but are not fully wired to automatic dispatch.
- [ ] Scheduled reminder job (cron/background runner) is not fully implemented.
- [ ] Guaranteed missed-deadline escalation notification to coordinators is not fully implemented.
- [ ] Real email reminders to reviewers/coordinators are not fully implemented.

## Slide 18: AI-Powered Review Support
- [x] AI-related API routes exist for checklist/report/claim endpoints.
- [~] AI behavior appears stubbed or deterministic rather than connected to a production-grade model service.
- [ ] Overleaf inline AI suggestion/comment integration is not implemented.
- [ ] Hallucination/unsupported-claim mitigation flow is not implemented end-to-end.
- [ ] Final report artifact generation with robust traceability is not fully implemented.
- [ ] Annotated PDF generation output is not implemented.

## Slide 19: Reviewer Rating and Analytics
- [x] Reviewer rating backend/API/data structures exist.
- [x] Coordinator analytics dashboard pages and APIs exist.
- [x] Reviewer leaderboard/workload/overview views exist.
- [~] Author-facing rating submission UX is unclear/incomplete in current UI coverage.
- [~] Rating dimensions may not match slide 19 requirements — must capture three separate axes:
    - Quality of comments
    - Quantity of feedback
    - Timeliness
- [~] Analytics are mostly aggregate; monthly/yearly time-window breakdowns are limited/missing.

## Slide 20: Dashboard and Analytics Detail
- [~] General theme: infrastructure exists but several feature areas are partial rather than fully automated.
- [ ] Ranked list of reviewers based on performance metrics (quality, quantity, timeliness) is not implemented as a distinct view.
- [ ] Assigned and completed reviews per reviewer tracked monthly, yearly, and overall is not implemented.
- [ ] Acceptance and rejection rates per reviewer tracked monthly, yearly, and overall is not implemented.
- [ ] Percentage of on-time versus delayed reviews per reviewer tracked monthly, yearly, and overall is not implemented.
- [~] Average reviewer score exists but may not aggregate across the three required rating axes.

## Slide 21: Optional - Venue Recommendation and Direct Submission
- [x] Venue metadata storage/form exists.
- [ ] Automated venue recommendation engine is not implemented.
- [ ] Direct venue submission integration (post-compliance pass) is not implemented.

## 3) Gap Closure Plan (Prioritized)

## Phase 1 - Operational Completeness (Highest Priority)
- [ ] Implement scheduled reminders:
    - Create cron/background worker route/job.
    - Dispatch `DEADLINE_REMINDER` before due date.
    - Dispatch `DEADLINE_OVERDUE` on missed deadlines.
- [ ] Wire real outbound channels:
    - Email provider integration for reminders/alerts.
    - Slack message delivery integration for key events.
- [ ] Automate compliance on upload/update:
    - Trigger compliance checks automatically after paper upload/edit.
    - Persist run logs and timestamped results.
- [ ] Add Overleaf link storage per paper and surface it to assigned reviewers in notifications/assignment UI.
- [ ] Implement proactive overload/inactivity alerts:
    - Flag reviewers who haven't started a review within a configurable window.
    - Flag reviewers with too many concurrent assignments.
    - Surface alerts to coordinator dashboard.

## Phase 2 - Slide 15 Compliance Depth
- [ ] Add reference-style compliance engine.
- [ ] Add paper-type-specific checklist rules.
- [ ] Add track-level rule sets and validation profiles.
- [ ] Improve section-detection reliability (parser quality, fallback handling).
- [ ] Implement full anonymity compliance suite:
    - Organization/institution name detection in body text.
    - PDF metadata field validation (author, company fields must be cleared).
    - Tool/dataset link analysis to detect author-revealing URLs.

## Phase 3 - Assignment Intelligence
- [ ] Implement automatic assignment scoring:
    - Workload balancing
    - Historical performance/quality score
    - Conflict and availability constraints
- [ ] Add coordinator simulation view (before applying assignments).
- [ ] Add explainable assignment rationale in UI.
- [ ] Surface prior-round reviewer history per paper:
    - Show who reviewed in each previous round.
    - Highlight/exclude prior reviewers when assigning new round.
- [ ] Implement guided revision iteration workflow:
    - Coordinator marks paper for revision (reject/major revision decision).
    - Author resubmits revised version.
    - New review round is created with prior-round context preserved.
    - System guides coordinator to assign new/different reviewers.

## Phase 4 - AI Review Support Productionization
- [ ] Replace stubs with real AI provider integration.
- [ ] Add evidence-grounded claim checks and unsupported-claim flags.
- [ ] Generate reviewer-ready structured reports.
- [ ] Add annotated PDF export pipeline.
- [ ] Integrate Overleaf comment sync (if required by scope).

## Phase 5 - Analytics and Rating Completion
- [ ] Complete author-facing reviewer rating UI flow.
- [ ] Ensure rating captures three separate dimensions per slide 19:
    - Quality of comments
    - Quantity of feedback
    - Timeliness
- [ ] Add monthly/yearly analytics slices (per slide 20):
    - Per-reviewer acceptance/decline rates (monthly, yearly, overall)
    - Assigned and completed reviews per reviewer (monthly, yearly, overall)
    - Percentage of on-time versus delayed reviews per reviewer (monthly, yearly, overall)
    - Review turnaround distributions
    - Delay and extension trends over time
- [ ] Add ranked reviewer leaderboard based on composite performance metrics.
- [ ] Add coordinator export/reporting capability.

## Phase 6 - Optional Advanced Features
- [ ] Implement venue recommendation model/service.
- [ ] Implement direct venue submission pipeline with compliance gate.
- [ ] Add success/failure audit and retry logic for external submissions.

## Phase 7 - Nice-to-Have Enhancements
- [ ] Review templates with guided prompts:
    - Structured sections: Summary, Strengths, Weaknesses, Minor Comments, Questions for Authors.
    - Mirrors real conference review forms (ICSE, ACL, etc.).
    - Replaces free-form text with guided, consistent review structure.
- [ ] Review response tracker / rebuttal log:
    - Authors respond to each review comment with accepted/rejected/addressed + a note.
    - Creates a structured record of how feedback was incorporated.
    - Feeds into revision gap analysis (Phase 8).
- [ ] "What needs my attention" coordinator digest:
    - Single prioritized view: overdue reviews, pending extension requests, unassigned papers, papers stuck in revision.
    - Reduces coordinator cognitive load — one glance instead of checking multiple pages.
- [ ] Side-by-side diff view for revised papers:
    - When a paper enters round 2+, show what changed between versions.
    - Highlights added/removed/modified sections so reviewers don't re-read the entire paper.
- [ ] Reviewer availability calendar:
    - Reviewers mark busy periods (exams, conferences, travel, deadlines).
    - Coordinators see availability before assigning, reducing decline-and-reassign cycles.
- [ ] Compliance fix suggestions:
    - When a compliance check fails, show actionable guidance (e.g., "Abstract is 287 words, limit is 250. Consider trimming the methodology summary.").
    - Turns diagnostic output into actionable recommendations.
- [ ] Audit log:
    - Full activity trail: assignments, status changes, extensions, ratings, review submissions.
    - Who did what and when, with timestamps.
    - Supports accountability, dispute resolution, and debugging.
- [ ] Reviewer expertise tags:
    - Reviewers self-declare topic areas (NLP, testing, empirical SE, formal methods, etc.).
    - System shows topic relevance when assigning reviewers.
    - Lightweight — no ML required, just tags and matching.

## Phase 8 - Agentic AI Features
- [ ] AI-powered review draft assistant:
    - AI agent reads the full manuscript and pre-fills the structured review template with draft observations (potential weaknesses, missing references, unclear sections, statistical concerns).
    - Reviewer edits/approves/rejects each AI-generated point.
    - Human stays in control; AI provides a starting point instead of a blank page.
- [ ] Automated paper-reviewer matching:
    - AI agent reads paper abstracts and reviewer publication history/expertise tags.
    - Ranks candidate reviewers by topical relevance with explanations (e.g., "Reviewer X published 3 papers on mutation testing; this paper is about mutation testing for deep learning").
    - Coordinator sees ranked suggestions with reasoning instead of a flat list.
- [ ] Intelligent compliance fixer:
    - AI agent proposes concrete fixes for compliance failures: shortened abstract drafts, redacted sentences with institution names removed, metadata fields to clear.
    - Author reviews and accepts/rejects each suggestion inline.
    - Goes beyond diagnostics ("here's what's wrong") to solutions ("here's how to fix it").
- [ ] Cross-review consistency checker:
    - After all reviewers submit for a round, AI agent analyzes the set of reviews together.
    - Flags contradictions (e.g., "Reviewer A says methodology is sound, Reviewer B says it's fundamentally flawed").
    - Identifies blind spots (e.g., "No reviewer commented on threats to validity").
    - Generates a synthesis summary for the coordinator (automated meta-review first pass).
- [ ] AI-driven revision gap analysis:
    - When an author resubmits, AI agent compares old version, reviews received, and new version.
    - Generates a report mapping each review comment to whether it was addressed in the revision.
    - Feeds into the rebuttal log (Phase 7) and saves coordinators from manually verifying revision completeness.

## 4) Suggested Immediate Sprint Backlog (Actionable)
- [ ] Sprint Item 1: Reminder scheduler + notification dispatch wiring.
- [ ] Sprint Item 2: Real email integration for reminders and overdue alerts.
- [ ] Sprint Item 3: Auto-trigger compliance checks on paper upload/update.
- [ ] Sprint Item 4: Author-facing reviewer rating UI (3 axes: quality, quantity, timeliness) + end-to-end test.
- [ ] Sprint Item 5: Monthly/yearly analytics endpoints + dashboard filters (per slide 20 spec).
- [ ] Sprint Item 6: Prior-round reviewer history UI on assignment page.
- [ ] Sprint Item 7: Overleaf link field on paper + include in reviewer assignment notifications.
- [ ] Sprint Item 8: Proactive overload/inactivity detection alerts for coordinator dashboard.

## 5) Verification Checklist (Definition of Done per Feature)
- [ ] Unit tests for all new service logic.
- [ ] Integration tests for APIs (assignment/reminders/compliance/ratings/analytics).
- [ ] UI test coverage for key flows (submit, assign, review, rate, notify).
- [ ] Monitoring/logging added for scheduled jobs and external integrations.
- [ ] Error handling and retry strategy verified for email/slack/AI/provider calls.
- [ ] Security checks for authz on every new endpoint.
- [ ] Documentation update for setup/env vars/jobs.

## 6) Risks and Dependencies
- [ ] External provider keys/configuration required (email, Slack, AI).
- [ ] Scheduler hosting support required (cron/background execution).
- [ ] Compliance parsing quality depends on reliable document extraction.
- [ ] AI output quality control requires strict grounding and fallback behavior.

---

This checklist is based on current repository behavior and slide requirements, and is intended to be updated as each item is completed.