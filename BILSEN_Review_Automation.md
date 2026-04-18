# BILSEN Review Process Automation

## Project Overview

BILSEN (Bilkent Software Engineering Group) currently manages its internal paper review process through manual email coordination, Overleaf-based commenting, and informal follow-ups. As the group grows (9 graduate + 18 undergraduate students), this process does not scale.

This system replaces that workflow with a centralized web application backed by Slack integration, automated compliance checks, AI-assisted reviews, and a reviewer performance analytics dashboard. The website serves as the primary interface; Slack acts as a convenience layer for quick actions and notifications.

---

## Tech Stack

### Core

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 14+ (App Router) | SSR for dashboards, API routes built-in, server components for data-heavy views |
| **Language** | TypeScript | End-to-end type safety across frontend, API, and database |
| **Database** | PostgreSQL | Highly relational data model (papers ↔ reviewers ↔ assignments ↔ ratings) |
| **ORM** | Prisma | Type-safe queries, painless migrations, great DX with TypeScript |
| **Auth** | NextAuth.js (Auth.js) | Email-based auth for academic context, extensible for SSO later |

### Frontend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Styling** | Tailwind CSS | Rapid UI development, consistent design system |
| **Components** | shadcn/ui | High-quality, accessible, customizable components |
| **Charts** | Recharts | React-native charting for reviewer analytics dashboard |
| **Tables** | TanStack Table | Sortable, filterable tables for paper/reviewer management |
| **Forms** | React Hook Form + Zod | Performant forms with schema-based validation |
| **PDF Viewer** | react-pdf | In-browser paper viewing |

### Backend & Services

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Email** | Resend | Modern email API, great DX, React Email for templates |
| **File Storage** | Supabase Storage or AWS S3 | Paper PDF uploads and generated review documents |
| **Cron Jobs** | Vercel Cron / node-cron | Scheduled deadline reminders and overdue alerts |
| **Slack** | Bolt.js (Slack SDK) | Official Node.js SDK for bot, slash commands, interactive messages |
| **AI/LLM** | Anthropic API (Claude) | AI-assisted review generation and compliance suggestions |
| **PDF Processing** | pdf-parse + pdf-lib | Text extraction, metadata reading/stripping, page counting |

### Infrastructure

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Hosting** | Vercel | Zero-config Next.js deployment, edge functions, cron support |
| **Database Hosting** | Supabase or Neon | Managed Postgres with generous free tiers |
| **Monitoring** | Vercel Analytics + Sentry | Performance monitoring and error tracking |
| **CI/CD** | GitHub Actions | Automated testing, linting, and deployment on push |

---

## Design System

The visual identity draws from Khan Academy's actual product design: clean whites, a confident warm blue, information-dense layouts that stay readable, and zero decorative noise inside the app. The landing page can have personality — the actual tool is pure function.

### Design Principles

- **Clarity over decoration.** Every element earns its place. No ornamental borders, shadows for depth, or colored backgrounds that don't communicate meaning.
- **Content density done right.** Academic users are comfortable with information-rich screens. Khan Academy fits 13 units of progress tracking on a single page (see the Integrated Math 3 screenshot) and it works because of consistent spacing and clear hierarchy. BILSEN should feel the same — tight, organized, scannable.
- **White space is the design.** Khan Academy's interior pages are almost entirely white backgrounds with content. The blue appears sparingly — buttons, active states, links. The whiteness IS the aesthetic. Don't fight it with colored sections or card backgrounds.
- **Left sidebar, content right.** Khan Academy uses a persistent left sidebar for navigation/structure and a wide content area. This pattern works well for BILSEN — sidebar for paper list or nav, main area for the review workspace or dashboard.
- **No template energy.** Avoid anything that looks like a SaaS landing page or a Tailwind UI starter kit. Custom spacing, intentional layout, understated interactions.

### Color Palette

```
Primary        #1865F2  (Khan Academy blue — the exact blue from their buttons and links)
Primary Hover  #1453CC  (darkened for hover states)
Primary Muted  #EBF0FF  (light blue background for selected states, active sidebar items)

Neutral 900    #1A1A1A  (primary text — headings, body)
Neutral 700    #4A4A4A  (secondary text)
Neutral 500    #7A7A7A  (tertiary text, placeholders, captions like "13 UNITS · 110 SKILLS")
Neutral 300    #D6D6D6  (borders, dividers, inactive elements)
Neutral 100    #F7F8FA  (sidebar background, page background, table headers)
White          #FFFFFF  (main content area, cards, inputs)

Status: Success    #1B7D4F  (accepted, completed, passed compliance check)
Status: Warning    #C27217  (approaching deadline, extension requested — like KA's "Familiar" orange)
Status: Danger     #C4342D  (overdue, declined, failed check)
Status: Info       #1865F2  (new assignment, in progress — same as primary)
Status: Pending    #7A7A7A  (awaiting response)

Progress (borrowed from KA's mastery system):
  Mastered     #1865F2  (dark blue — review completed, all checks passed)
  Proficient   #7C6CC4  (medium purple — review submitted, minor issues)
  Familiar     #C27217  (orange — in progress)
  Not Started  #E5E5E5  (empty gray — pending)
```

This is not a generic corporate blue. It is Khan Academy's specific warm-leaning blue that reads as "trustworthy educational tool" rather than "enterprise SaaS." The key is how little of it you use — it appears on primary buttons, links, and active states. Everything else is neutral.

### Typography

```
Headings     Inter (600/700 weight)  — clean, modern, matches KA's sans-serif feel
Body         Inter (400/500 weight)  — pairs naturally, excellent at small sizes
Monospace    JetBrains Mono          — for paper IDs, metadata, compliance check output
Labels       Inter (500 weight, uppercase, letter-spacing 0.05em) — like KA's "UNIT 1" labels
```

Khan Academy uses a clean sans-serif with very clear weight hierarchy. Headings are bold but not oversized. Labels (like "UNIT 1", "13 UNITS · 110 SKILLS") are small, uppercase, and muted — this pattern maps perfectly to BILSEN for things like "ROUND 2", "3 REVIEWERS ASSIGNED", "DEADLINE: MAR 15".

| Element | Size | Weight | Color | Notes |
|---------|------|--------|-------|-------|
| Page title | 24px | 700 | Neutral 900 | Like KA's "Integrated math 3" |
| Section heading | 18px | 600 | Neutral 900 | |
| Card title / paper title | 16px | 600 | Neutral 900 | |
| Body text | 14px | 400 | Neutral 700 | |
| Metadata label | 12px | 500 | Neutral 500 | Uppercase, letter-spaced. "ROUND 2 · 3 REVIEWS" |
| Caption | 12px | 400 | Neutral 500 | |
| Badge text | 12px | 500 | Status color | |

### Component Patterns

**Layout:** Two-panel. Left sidebar (240px, `Neutral 100` background) with navigation or contextual list (papers, units, etc.). Right content area (white) fills remaining width. Top bar is white with bottom border (`Neutral 300`), centered logo, search bar left, auth actions right — exactly like KA's nav.

**Sidebar:** Items are plain text, `Neutral 700`, 14px. Active item gets `Primary` text color and `Primary Muted` background (like KA's active course in the sidebar). Items separated by subtle `Neutral 300` bottom borders. Group labels are uppercase, 12px, `Neutral 500`.

**Breadcrumbs:** Small, 12px, `Primary` color for links, `Neutral 500` for separators. "Home > Papers > Ontology-Driven Legal Reasoning..." — exactly like KA's "Home · Math" breadcrumb pattern.

**Cards:** White background, 1px `Neutral 300` border, 8px border-radius, 16px padding. No box shadows. Cards should feel flat and paper-like — like KA's "Course Challenge" card in the screenshot.

**Buttons:**
- Primary: `Primary` background, white text, 6px border-radius, 500 weight. Identical to KA's "Sign up" and "Give now" buttons.
- Secondary: White background, 1px `Neutral 300` border, `Neutral 900` text. Like KA's donation amount selectors ($12, $20, $50).
- Ghost: No background or border, `Primary` text. For tertiary actions and links.
- Danger: `Danger` background, white text. Destructive actions only.

**Status Badges:** Pill-shaped, 12px font, 500 weight. Muted version of status color as background, full color as text. Example: "Overdue" badge = `#FDE8E7` background, `#C4342D` text. "Accepted" = `#E8F5EE` background, `#1B7D4F` text.

**Progress Indicators:** Borrow KA's mastery grid concept. For a paper's review status, show small colored squares representing each reviewer's progress — not started (empty), in progress (orange), completed (blue). Dense, scannable, informative.

**Tables:** No zebra striping. Single bottom border per row (`Neutral 300`). Header row: `Neutral 100` background, 12px uppercase `Neutral 500` text, 600 weight. Row height 48px for density. Sortable columns indicated by subtle arrow icons.

**Radio/Toggle Groups:** Like KA's "Monthly / Yearly" selector and "Learner / Teacher / Parent" pills — outlined buttons in a row, selected one gets `Primary` border and text or filled `Primary` background.

**Empty States:** Centered text, `Neutral 500`, short and direct. "No pending reviews." No decorative illustrations inside the app.

### Spacing System

```
4px   — tight internal padding (badge padding, inline gaps)
8px   — default internal padding (button padding, input padding)
12px  — small section gaps (like between KA's unit label and unit title)
16px  — card padding, standard element spacing
24px  — section spacing within a page
32px  — major section breaks
48px  — page-level vertical rhythm
```

### What to Avoid

- Purple, violet, indigo, or any cool-toned primary that isn't this specific warm blue
- Gradient backgrounds or gradient text
- Glassmorphism, neumorphism, or frosted-glass effects
- Green as a primary color (reserve green for success/completion status only)
- Rounded avatars with colored rings
- Confetti animations, celebration modals, or gamification sparkles
- Dark mode as a launch feature (add later if needed)
- Oversized hero sections or splash screens inside the app (fine on a public landing page)
- Decorative SVG illustrations (the "undraw" style) inside the app
- Emoji in the UI (status is communicated through color and text labels)
- Colored section backgrounds to "break up" the page — use whitespace instead
- Card shadows trying to create depth — flat with borders is the move

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENTS                            │
│                                                         │
│   ┌──────────────┐         ┌──────────────────────┐     │
│   │  Next.js Web │         │  Slack Bot (Bolt.js) │     │
│   │   App (SSR)  │         │  - Slash Commands    │     │
│   │              │         │  - Interactive Msgs   │     │
│   │  - Dashboard │         │  - Notifications     │     │
│   │  - Forms     │         │                      │     │
│   │  - Analytics │         │                      │     │
│   └──────┬───────┘         └──────────┬───────────┘     │
│          │                            │                 │
└──────────┼────────────────────────────┼─────────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────────────────────────────────────────┐
│                   CORE API LAYER                        │
│              (Next.js API Routes)                       │
│                                                         │
│   /api/papers      - CRUD, upload, compliance check     │
│   /api/reviews     - assignment, submission, status      │
│   /api/reviewers   - profiles, workload, availability   │
│   /api/ratings     - reviewer evaluation                │
│   /api/analytics   - dashboard data, reports            │
│   /api/notifications - email + Slack dispatch           │
│   /api/slack       - webhook handler for Slack events   │
│   /api/ai          - LLM-powered review generation      │
│   /api/compliance  - automated paper checks             │
│   /api/cron        - scheduled tasks (reminders, etc.)  │
│                                                         │
└──────────┬──────────────┬───────────┬───────────────────┘
           │              │           │
           ▼              ▼           ▼
┌──────────────┐  ┌──────────┐  ┌──────────────┐
│  PostgreSQL  │  │ Supabase │  │  External    │
│  (Prisma)    │  │ Storage  │  │  Services    │
│              │  │  (PDFs)  │  │              │
│  - Papers    │  │          │  │  - Resend    │
│  - Users     │  │          │  │  - Slack API │
│  - Reviews   │  │          │  │  - Claude AI │
│  - Ratings   │  │          │  │  - Overleaf  │
│  - Venues    │  │          │  │    (links)   │
└──────────────┘  └──────────┘  └──────────────┘
```

---

## Database Schema

### Entity Relationship Overview

```
User ──< Paper (author)
User ──< ReviewAssignment (reviewer)
Paper ──< ReviewAssignment
Paper ──< ComplianceCheck
ReviewAssignment ──< Review
Review ──< ReviewerRating
Paper ──< ReviewRound
ReviewRound ──< ReviewAssignment
User ──< Notification
Venue ──< Paper
```

### Prisma Models

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  slackId         String?   @unique        // linked Slack account
  role            Role      @default(MEMBER) // COORDINATOR, MEMBER
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  papersAuthored  Paper[]           @relation("PaperAuthors")
  assignments     ReviewAssignment[]
  ratingsGiven    ReviewerRating[]  @relation("RaterRelation")
  ratingsReceived ReviewerRating[]  @relation("ReviewerRelation")
  notifications   Notification[]
}

enum Role {
  COORDINATOR
  MEMBER
}

model Paper {
  id              String    @id @default(cuid())
  title           String
  abstractText    String?
  pdfUrl          String               // S3/Supabase storage URL
  overleafUrl     String?              // optional Overleaf project link
  venueId         String?
  venue           Venue?    @relation(fields: [venueId], references: [id])
  status          PaperStatus @default(SUBMITTED)
  paperType       PaperType?           // RESEARCH, SURVEY, TOOL, etc.
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  authors         User[]    @relation("PaperAuthors")
  reviewRounds    ReviewRound[]
  complianceChecks ComplianceCheck[]
}

enum PaperStatus {
  SUBMITTED
  UNDER_REVIEW
  REVISION_REQUESTED
  ACCEPTED
  REJECTED
}

enum PaperType {
  RESEARCH
  SURVEY
  TOOL
  EXPERIENCE_REPORT
  OTHER
}

model Venue {
  id              String    @id @default(cuid())
  name            String                 // e.g. "ICSE 2026"
  track           String?                // e.g. "Research Track"
  pageLimit       Int?
  abstractWordLimit Int?
  requiredSections String[]             // e.g. ["Abstract", "Introduction", ...]
  referenceFormat  String?              // e.g. "ACM", "IEEE"
  anonymityRequired Boolean @default(false)
  submissionDeadline DateTime?
  paperTypes      PaperType[]
  createdAt       DateTime  @default(now())

  papers          Paper[]
}

model ReviewRound {
  id              String    @id @default(cuid())
  paperId         String
  paper           Paper     @relation(fields: [paperId], references: [id])
  roundNumber     Int                  // 1, 2, 3...
  createdAt       DateTime  @default(now())

  assignments     ReviewAssignment[]

  @@unique([paperId, roundNumber])
}

model ReviewAssignment {
  id              String    @id @default(cuid())
  reviewRoundId   String
  reviewRound     ReviewRound @relation(fields: [reviewRoundId], references: [id])
  reviewerId      String
  reviewer        User      @relation(fields: [reviewerId], references: [id])
  deadline        DateTime
  status          AssignmentStatus @default(PENDING)
  declineReason   String?
  extensionRequestedTo DateTime?
  assignedAt      DateTime  @default(now())
  respondedAt     DateTime?
  completedAt     DateTime?

  review          Review?

  @@unique([reviewRoundId, reviewerId])
}

enum AssignmentStatus {
  PENDING       // awaiting reviewer response
  ACCEPTED      // reviewer accepted
  DECLINED      // reviewer declined with reason
  IN_PROGRESS   // reviewer is working on it
  COMPLETED     // review submitted
  OVERDUE       // deadline passed, no submission
  EXTENSION_REQUESTED
}

model Review {
  id              String    @id @default(cuid())
  assignmentId    String    @unique
  assignment      ReviewAssignment @relation(fields: [assignmentId], references: [id])
  comments        String               // free-form review comments
  structuredFeedback Json?             // optional JSON for section-by-section feedback
  overallScore    Int?                 // 1-5 overall rating of the paper
  recommendation  Recommendation?
  submittedAt     DateTime  @default(now())

  rating          ReviewerRating?
}

enum Recommendation {
  ACCEPT
  MINOR_REVISION
  MAJOR_REVISION
  REJECT
}

model ReviewerRating {
  id              String    @id @default(cuid())
  reviewId        String    @unique
  review          Review    @relation(fields: [reviewId], references: [id])
  raterId         String               // the author rating the reviewer
  rater           User      @relation("RaterRelation", fields: [raterId], references: [id])
  reviewerId      String               // the reviewer being rated
  reviewerUser    User      @relation("ReviewerRelation", fields: [reviewerId], references: [id])
  qualityScore    Int                  // 1-5
  quantityScore   Int                  // 1-5
  timelinessScore Int                  // 1-5
  comment         String?
  createdAt       DateTime  @default(now())
}

model ComplianceCheck {
  id              String    @id @default(cuid())
  paperId         String
  paper           Paper     @relation(fields: [paperId], references: [id])
  checkType       ComplianceCheckType
  passed          Boolean
  details         Json                 // detailed results
  checkedAt       DateTime  @default(now())
}

enum ComplianceCheckType {
  PAGE_LIMIT
  ABSTRACT_WORD_COUNT
  REQUIRED_SECTIONS
  REFERENCE_FORMAT
  ANONYMITY_CHECK
  METADATA_CHECK
  CHECKLIST
}

model Notification {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  type            NotificationType
  title           String
  message         String
  link            String?              // deep link to relevant page
  read            Boolean   @default(false)
  sentViaEmail    Boolean   @default(false)
  sentViaSlack    Boolean   @default(false)
  createdAt       DateTime  @default(now())
}

enum NotificationType {
  ASSIGNMENT_NEW
  ASSIGNMENT_ACCEPTED
  ASSIGNMENT_DECLINED
  DEADLINE_REMINDER
  DEADLINE_OVERDUE
  REVIEW_SUBMITTED
  RATING_RECEIVED
  COMPLIANCE_RESULT
  EXTENSION_REQUESTED
  EXTENSION_APPROVED
  EXTENSION_DENIED
  ROUND_COMPLETE
}
```

---

## API Routes

### Papers

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/papers` | List papers (filterable by status, author, venue) |
| `POST` | `/api/papers` | Submit a new paper (upload PDF, set metadata) |
| `GET` | `/api/papers/[id]` | Get paper details with review history |
| `PATCH` | `/api/papers/[id]` | Update paper metadata or status |
| `DELETE` | `/api/papers/[id]` | Remove a paper (coordinator only) |
| `POST` | `/api/papers/[id]/compliance` | Run compliance checks against selected venue |

### Review Rounds

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/papers/[id]/rounds` | Create a new review round |
| `GET` | `/api/papers/[id]/rounds` | List all review rounds for a paper |
| `GET` | `/api/papers/[id]/rounds/[roundId]` | Get round details with assignments |

### Review Assignments

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/rounds/[roundId]/assignments` | Assign reviewers to a round |
| `PATCH` | `/api/assignments/[id]/accept` | Reviewer accepts assignment |
| `PATCH` | `/api/assignments/[id]/decline` | Reviewer declines with reason |
| `PATCH` | `/api/assignments/[id]/extend` | Request deadline extension |
| `PATCH` | `/api/assignments/[id]/extend/approve` | Coordinator approves extension |
| `GET` | `/api/assignments/me` | Get current user's pending assignments |

### Reviews

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/assignments/[id]/review` | Submit a review for an assignment |
| `GET` | `/api/reviews/[id]` | Get review details |
| `PATCH` | `/api/reviews/[id]` | Update a submitted review |

### Ratings

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/reviews/[id]/rate` | Author rates a reviewer |
| `GET` | `/api/reviewers/[id]/ratings` | Get all ratings for a reviewer |

### Analytics

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/analytics/reviewers` | Reviewer leaderboard and performance stats |
| `GET` | `/api/analytics/reviewers/[id]` | Individual reviewer stats |
| `GET` | `/api/analytics/overview` | System-wide metrics (active papers, pending reviews, etc.) |
| `GET` | `/api/analytics/workload` | Current workload distribution across reviewers |

### AI & Compliance

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/ai/review` | Generate AI-assisted review for a paper |
| `POST` | `/api/ai/suggestions` | Get improvement suggestions for a paper |
| `POST` | `/api/compliance/check` | Run all compliance checks for a paper against a venue |
| `GET` | `/api/compliance/[paperId]` | Get compliance check history |

### Slack Webhooks

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/slack/events` | Slack event subscription handler |
| `POST` | `/api/slack/commands` | Slash command handler |
| `POST` | `/api/slack/interactions` | Interactive message handler (button clicks) |

### Notifications & Users

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/notifications` | Get current user's notifications |
| `PATCH` | `/api/notifications/[id]/read` | Mark notification as read |
| `GET` | `/api/users` | List all users (coordinator view) |
| `PATCH` | `/api/users/[id]` | Update user profile |
| `POST` | `/api/users/link-slack` | Link Slack account to web account |

---

## Slack Integration

### Linking Accounts

Before any Slack interaction works, users must link their Slack identity to their web app account. Flow:

1. User runs `/bilsen link` in Slack
2. Bot responds with a unique verification URL: `https://app.bilsen.com/link-slack?code=ABC123`
3. User clicks the link, logs into the web app, and confirms
4. Slack ID is stored in the `User.slackId` field
5. All future Slack interactions are authenticated via this mapping

### Slash Commands

| Command | Description |
|---------|-------------|
| `/bilsen link` | Link Slack account to web app account |
| `/bilsen status` | Show my pending review assignments and deadlines |
| `/bilsen papers` | List papers currently under review |
| `/bilsen accept <assignment-id>` | Accept a review assignment |
| `/bilsen decline <assignment-id> <reason>` | Decline with reason |
| `/bilsen extend <assignment-id> <YYYY-MM-DD>` | Request deadline extension |
| `/bilsen assign <paper-id> @user <deadline>` | Coordinator assigns a reviewer |
| `/bilsen stats` | Quick summary of my reviewer stats |
| `/bilsen help` | List available commands |

### Interactive Messages

When a reviewer is assigned, the Slack bot sends:

```
New Review Assignment

Paper: "Ontology-Driven Legal Reasoning Graph Extraction"
Authors: Ansuman Mullick, Dilek Küçük, Fazli Can
Deadline: March 15, 2026
Overleaf: Open Project >

[ Accept ]  [ Decline ]  [ View Details ]
```

Clicking "Accept" hits `/api/assignments/[id]/accept`, updates the DB, and the bot edits the message to show "Accepted"

Clicking "Decline" → opens a modal asking for a reason → hits `/api/assignments/[id]/decline`

Clicking "View Details" → deep link to the web app

### Notification Channel (`#bilsen-reviews`)

Automated posts for group visibility:

- **New submission:** "New paper submitted: *Paper Title* by @author"
- **Reviewers assigned:** "Reviewers assigned for *Paper Title* — due March 15"
- **Review completed:** "@reviewer completed their review for *Paper Title*"
- **Deadline warning:** "1 day remaining: @reviewer has a pending review for *Paper Title*"
- **Overdue alert:** "OVERDUE: @reviewer's review for *Paper Title* was due yesterday"
- **Round complete:** "All reviews complete for *Paper Title* (Round 2)"
- **Weekly digest (Monday):** Summary of active papers, pending reviews, and reviewer stats

### DM Notifications

Reviewers receive direct messages for:

- New assignments (with interactive buttons)
- Deadline reminders (3 days before, 1 day before)
- Extension request responses (approved/denied)
- Rating received (with score summary, no author name for anonymity)

---

## Feature Set (Prioritized)

### P0 — Core MVP

These features define the minimum viable product. Without these, the system has no value.

- [ ] **User authentication and role management** — Email-based login, coordinator vs. member roles
- [ ] **Paper submission portal** — Upload PDF, enter title/abstract, link Overleaf project, select venue/track
- [ ] **Venue/track configuration** — Coordinator can define venues with their specific requirements (page limits, sections, formatting rules)
- [ ] **Reviewer assignment** — Coordinator selects reviewers for a paper, sets deadline, system creates a review round
- [ ] **Assignment accept/decline flow** — Reviewers can accept or decline (with mandatory reason) via web app
- [ ] **Review submission** — Structured form: free-form comments, section-by-section feedback (optional), overall score, recommendation (accept/minor/major/reject)
- [ ] **Email notifications** — Automated emails on assignment, reminders (3 days, 1 day), deadline missed alerts
- [ ] **In-app notification center** — Bell icon, unread count, notification feed with deep links
- [ ] **Basic reviewer workload view** — Coordinator can see how many active assignments each reviewer has before assigning
- [ ] **Review round tracking** — Support multiple review rounds per paper, track which reviewers were assigned in each round to avoid reassignment

### P1 — Should-Have

These features significantly improve the experience and address key pain points from the current process.

- [ ] **Slack bot — notifications** — Push notifications to Slack DMs and `#bilsen-reviews` channel for all key events
- [ ] **Slack bot — interactive assignments** — Accept/decline buttons in Slack messages, slash commands for status checks
- [ ] **Slack account linking** — One-time flow to connect Slack identity with web account
- [ ] **Automated compliance checks** — On paper upload, run checks against the selected venue:
  - Page count validation
  - Abstract word count
  - Required sections detection (via NLP/keyword matching on extracted text)
  - PDF metadata check (author field, company field should be empty for anonymous submissions)
- [ ] **Reviewer rating system** — After review completion, authors rate reviewers on quality (1-5), quantity (1-5), and timeliness (1-5) with optional comment
- [ ] **Reviewer performance dashboard** — Ranked leaderboard, per-reviewer stats: avg scores, acceptance rate, on-time percentage, monthly/yearly/overall breakdowns
- [ ] **Deadline extension requests** — Reviewers can request extensions, coordinator approves/denies via web or Slack
- [ ] **Coordinator dashboard** — Overview: active papers, pending reviews, overdue assignments, workload heatmap, upcoming deadlines

### P2 — Nice-to-Have

These features add significant value but can be deferred post-launch.

- [ ] **AI-assisted review generation** — Author uploads paper → system sends extracted text to Claude API → generates structured review based on predefined template with improvement suggestions
- [ ] **AI compliance suggestions** — Beyond pass/fail checks, AI highlights specific issues: "Section 3.2 may reveal author identity through self-citation"
- [ ] **Anonymity deep check** — Scan PDF text for institution names, self-citations, identifiable URLs, GitHub links; scan metadata for author/organization fields
- [ ] **Annotated PDF generation** — AI review results rendered as PDF annotations that authors can download
- [ ] **Quality checklist engine** — Dynamic checklists based on paper type (research, survey, tool paper) that authors can check off as they address each item
- [ ] **Slack weekly digest** — Every Monday, bot posts a summary to `#bilsen-reviews`: papers in progress, pending reviews, reviewer of the week
- [ ] **Calendar integration** — When a reviewer accepts, auto-generate an .ics calendar event with the deadline
- [ ] **Overleaf link management** — Store and display Overleaf links per paper, quick-access buttons for reviewers

### P3 — Future / Stretch

Long-term enhancements for when the core system is stable.

- [ ] **Venue recommendation engine** — Based on paper type, content keywords, and past submission history, suggest suitable venues
- [ ] **Direct venue submission** — Once all checks pass, enable one-click submission to conference systems (very ambitious, depends on venue APIs)
- [ ] **Reviewer expertise matching** — Tag reviewers with expertise areas, suggest best-fit reviewers for each paper
- [ ] **Sentiment analysis on reviews** — Flag potentially unhelpful or harsh reviews for coordinator attention
- [ ] **Historical analytics** — Trend lines over semesters: review turnaround times, average quality scores, group productivity
- [ ] **Overleaf API integration** — If feasible, post AI-generated comments directly into Overleaf projects (currently limited by Overleaf's API)
- [ ] **Multi-group support** — Extend the platform to serve other research groups at Bilkent, not just BILSEN

---

## Page Structure (Web App)

### Public

- `/login` — Email-based authentication

### Member Views

- `/dashboard` — Personal overview: my papers, my pending reviews, recent notifications
- `/papers` — Browse all papers (filterable by status, venue, author)
- `/papers/[id]` — Paper detail: PDF viewer, Overleaf link, review rounds, compliance results
- `/papers/new` — Submit a new paper
- `/reviews/mine` — My review assignments (pending, in-progress, completed)
- `/reviews/[assignmentId]` — Review workspace: read paper, write review, submit
- `/profile` — My profile, linked accounts, notification preferences
- `/link-slack` — Slack account linking page

### Coordinator Views

- `/admin/dashboard` — System overview: active papers, pending reviews, overdue, workload chart
- `/admin/papers/[id]/assign` — Assign reviewers to a paper's current round
- `/admin/reviewers` — Reviewer management: workload, stats, performance leaderboard
- `/admin/reviewers/[id]` — Individual reviewer deep-dive
- `/admin/venues` — Manage venue configurations
- `/admin/venues/new` — Create/edit venue with requirements

---

## Notification Matrix

| Event | In-App | Email | Slack DM | Slack Channel |
|-------|--------|-------|----------|---------------|
| New assignment | Yes | Yes | Yes (interactive) | Yes |
| Assignment accepted | Yes | Yes (to coordinator) | Yes (to coordinator) | Yes |
| Assignment declined | Yes | Yes (to coordinator) | Yes (to coordinator) | Yes |
| Deadline reminder (3 days) | Yes | Yes | Yes | No |
| Deadline reminder (1 day) | Yes | Yes | Yes | No |
| Deadline missed | Yes | Yes | Yes | Yes (alert) |
| Review submitted | Yes | Yes (to authors) | Yes (to authors) | Yes |
| Rating received | Yes | No | Yes | No |
| Extension requested | Yes | Yes (to coordinator) | Yes (to coordinator) | No |
| Extension approved/denied | Yes | Yes | Yes | No |
| Compliance check complete | Yes | Yes (if failures) | Yes (summary) | No |
| All reviews in round complete | Yes | Yes (to authors) | Yes (to authors) | Yes |
| Weekly digest | No | No | No | Yes (Monday) |

---

## Compliance Check Pipeline

When an author uploads a paper and selects a venue, the system runs automated checks:

```
PDF Upload
    │
    ▼
┌─────────────────────┐
│  1. Extract Text     │  ← pdf-parse
│     (full text +     │
│      metadata)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  2. Page Count       │  ← Count pages from PDF
│     Check            │     vs venue.pageLimit
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  3. Abstract Word    │  ← Extract abstract section
│     Count            │     vs venue.abstractWordLimit
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  4. Required         │  ← Regex/NLP section header
│     Sections         │     detection vs venue.requiredSections
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  5. Metadata         │  ← pdf-lib reads PDF metadata
│     Check            │     (author, company fields
│                      │      should be empty if anonymous)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  6. Anonymity        │  ← Scan text for institution names,
│     Scan (P2)        │     self-citations, identifiable URLs
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  7. Store Results    │  ← Save ComplianceCheck records
│     & Notify         │     Notify author of any failures
└─────────────────────┘
```

---

## AI Review Pipeline

```
Author triggers AI review
    │
    ▼
┌─────────────────────────┐
│  1. Extract full text    │  ← pdf-parse
│     from PDF             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  2. Detect paper type    │  ← Classification prompt
│     & load checklist     │     (research / survey / tool)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  3. Generate structured  │  ← Claude API call with:
│     review               │     - Paper text
│                          │     - Review template
│                          │     - Venue-specific criteria
│                          │     - Checklist items
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  4. Validate output      │  ← Check for hallucinated
│                          │     references, unsupported
│                          │     claims flagged by AI
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  5. Return structured    │  ← Section-by-section feedback
│     feedback to author   │     Overall assessment
│                          │     Actionable suggestions
└─────────────────────────┘
```

---

## Development Roadmap

### Phase 1 — Foundation (Weeks 1–3)

- Project setup: Next.js, Prisma, PostgreSQL, auth
- Database schema and migrations
- User registration and login
- Basic paper submission (upload PDF, enter metadata)
- Venue CRUD (coordinator)

### Phase 2 — Core Review Workflow (Weeks 4–6)

- Reviewer assignment flow
- Accept/decline mechanism
- Review submission form
- Email notifications (assignment, reminders, completion)
- In-app notification center
- Review round management

### Phase 3 — Slack & Intelligence (Weeks 7–9)

- Slack app setup and account linking
- Slash commands and interactive messages
- Slack notification dispatch alongside email
- Automated compliance checks on paper upload
- Reviewer rating system

### Phase 4 — Dashboard & Analytics (Weeks 10–11)

- Coordinator dashboard with overview metrics
- Reviewer performance leaderboard
- Workload distribution charts
- Individual reviewer stat pages
- Deadline tracking and overdue management

### Phase 5 — AI Features & Polish (Weeks 12–14)

- AI-assisted review generation
- Anonymity deep checks
- Quality checklist engine
- Calendar integration
- Bug fixes, UX polish, testing
- Deployment and documentation

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/bilsen"

# Auth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="https://app.bilsen.com"

# Email
RESEND_API_KEY="re_..."

# File Storage
S3_BUCKET="bilsen-papers"
S3_REGION="eu-central-1"
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."

# Slack
SLACK_BOT_TOKEN="xoxb-..."
SLACK_SIGNING_SECRET="..."
SLACK_APP_TOKEN="xapp-..."         # for Socket Mode during dev
SLACK_CHANNEL_ID="C0..."           # #bilsen-reviews channel

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# App
NEXT_PUBLIC_APP_URL="https://app.bilsen.com"
```

---

## Project Structure

```
bilsen-review/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing / redirect to dashboard
│   │   ├── login/
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Member dashboard
│   │   ├── papers/
│   │   │   ├── page.tsx                # Paper list
│   │   │   ├── new/page.tsx            # Submit paper
│   │   │   └── [id]/page.tsx           # Paper detail
│   │   ├── reviews/
│   │   │   ├── mine/page.tsx           # My assignments
│   │   │   └── [assignmentId]/page.tsx # Review workspace
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── link-slack/
│   │   │   └── page.tsx
│   │   ├── admin/
│   │   │   ├── dashboard/page.tsx      # Coordinator overview
│   │   │   ├── papers/[id]/assign/     # Assign reviewers
│   │   │   ├── reviewers/
│   │   │   │   ├── page.tsx            # Leaderboard
│   │   │   │   └── [id]/page.tsx       # Reviewer stats
│   │   │   └── venues/
│   │   │       ├── page.tsx            # Venue list
│   │   │       └── new/page.tsx        # Create venue
│   │   └── api/
│   │       ├── papers/
│   │       ├── rounds/
│   │       ├── assignments/
│   │       ├── reviews/
│   │       ├── ratings/
│   │       ├── analytics/
│   │       ├── ai/
│   │       ├── compliance/
│   │       ├── notifications/
│   │       ├── users/
│   │       ├── slack/
│   │       │   ├── events/route.ts
│   │       │   ├── commands/route.ts
│   │       │   └── interactions/route.ts
│   │       └── cron/
│   │           └── reminders/route.ts
│   ├── components/
│   │   ├── ui/                         # shadcn components
│   │   ├── papers/
│   │   ├── reviews/
│   │   ├── dashboard/
│   │   └── layout/
│   ├── lib/
│   │   ├── prisma.ts                   # Prisma client singleton
│   │   ├── auth.ts                     # NextAuth config
│   │   ├── slack.ts                    # Slack client setup
│   │   ├── email.ts                    # Resend client + templates
│   │   ├── ai.ts                       # Claude API client
│   │   ├── compliance.ts              # Compliance check logic
│   │   ├── pdf.ts                      # PDF parsing utilities
│   │   ├── notifications.ts           # Unified notification dispatcher
│   │   └── storage.ts                 # S3/Supabase file operations
│   ├── hooks/
│   └── types/
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```
