#!/usr/bin/env node
/**
 * Build the BILSEN Review System user manual.
 *
 * Generates two artefacts from a single source-of-truth content array:
 *   - USER_MANUAL.pdf  -- PDF for the D5 final-report bundle
 *   - USER_MANUAL.md   -- Markdown companion that renders on GitHub
 *
 * Run with: node scripts/build-user-manual.mjs
 *
 * Style mirrors src/lib/pdf-report.ts so the manual matches the look of the
 * AI-report PDFs the system already produces. ASCII-only -- non-ASCII is
 * sanitized to '?' by pdf-lib's StandardFonts (no glyphs beyond WinAnsi).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PDF_OUT = path.join(ROOT, "USER_MANUAL.pdf");
const MD_OUT = path.join(ROOT, "USER_MANUAL.md");

const TITLE = "BILSEN Review System -- User Manual";
const SUBTITLE = "CS-319 Project: Automation of the BILSEN Internal Review Process";
const VERSION = "1.0";
const DATE = new Date().toISOString().slice(0, 10);

// ============================================================
// Content -- single source of truth for both PDF and Markdown
// ============================================================
const content = [
  // -------------------- 1. Introduction --------------------
  { type: "h1", text: "1. Introduction" },

  { type: "h2", text: "1.1 What is BILSEN Review System?" },
  { type: "p", text: "BILSEN Review System is a web application that automates the BILSEN research group's internal academic-paper review process. BILSEN conducts structured peer reviews of papers before they are submitted to external conferences and journals; this system replaces the previous manual workflow (email coordination, ad-hoc Overleaf comments, scattered spreadsheet tracking) with a centralized, traceable, AI-assisted platform." },

  { type: "h2", text: "1.2 Why it exists" },
  { type: "p", text: "The legacy process was manual and email-driven. Reviewer assignment, deadline reminders, compliance checks against venue requirements, and reviewer-performance tracking were all coordinated by hand by the lab coordinator. As BILSEN grew, the process did not scale: missed deadlines went unnoticed, reviewer workload was unbalanced, and there was no historical record of reviewer performance. This system was built to solve those problems while preserving academic rigor and human control over every important decision." },

  { type: "h2", text: "1.3 What you can do with it" },
  { type: "ul", items: [
    "Submit papers (PDF upload, URL, or Overleaf link), with automatic compliance checks against venue requirements (page limit, abstract, sections, references, anonymity, AI disclosure, and more).",
    "Assign reviewers with built-in conflict-of-interest detection (self-author, name-in-PDF, shared affiliation) and workload balancing.",
    "Annotate PDFs in the browser using highlights, freehand doodles, and severity-tagged comments; export annotated PDFs.",
    "Use AI-drafted review suggestions while writing reviews -- summary, strengths, concerns, with verbatim-quote grounding and unsupported-claim flags.",
    "Generate AI synthesis reports that combine multiple reviews into a single recommendation document.",
    "Receive in-app and email notifications, with automated deadline reminders at 3-day, 1-day, and overdue marks.",
    "Track reviewer performance via a leaderboard with monthly, yearly, and overall periods, exportable to CSV or PDF.",
    "Get AI-ranked venue recommendations and submit a paper to its target venue once compliance passes.",
    "Manage paper versions across revision rounds; prior PDFs are archived automatically.",
  ] },

  { type: "h2", text: "1.4 Roles" },
  { type: "p", text: "There are two roles in the system:" },
  { type: "ul", items: [
    "Coordinator -- the lab coordinator(s). Manages venues, runs compliance checks, assigns reviewers, approves extensions, requests revisions, generates AI reports, and views analytics. Has access to all paths under /admin.",
    "Member -- everyone else. Submits papers as an author and reviews papers when assigned; the same person plays both roles depending on the paper. Members never see /admin.",
  ] },

  { type: "h2", text: "1.5 Tech stack (one-line overview)" },
  { type: "p", text: "Next.js 16 (App Router) with TypeScript and React 19; Tailwind CSS 4 with shadcn/ui components; NextAuth credentials authentication with bcrypt-hashed passwords; JSON-file storage in data/; Anthropic SDK for AI features; Resend for transactional email; pdf-parse for PDF text extraction; pdf-lib for PDF generation and annotation overlay; perfect-freehand for smooth pen strokes; react-pdf for in-browser rendering." },

  // -------------------- 2. Quick Start --------------------
  { type: "h1", text: "2. Quick Start" },
  { type: "p", text: "If you just want to get the system running and explore it, follow these steps. Detailed build instructions are in BUILD.md at the project root." },

  { type: "ol", items: [
    "Install Node.js 20 or later and npm 10 or later.",
    "From the project root, run: npm install",
    "Create a file named .env at the project root with at least:  AUTH_SECRET=<32+ random chars>  and  AUTH_URL=http://localhost:3000",
    "Seed test users: node scripts/seed-fake-users.mjs  -- this rewrites every account's password to 'password123' and writes scripts/SEED_CREDENTIALS.md with the full list.",
    "Start the dev server: npm run dev  -- and open http://localhost:3000 in a modern browser.",
    "Sign in with anshumanmullick7@gmail.com / password123 to log in as a Coordinator, or any other email from SEED_CREDENTIALS.md as a Member.",
  ] },

  { type: "p", text: "AI features (compliance check, review suggestions, synthesis report) require ANTHROPIC_API_KEY in .env. Email notifications require RESEND_API_KEY. Without these keys the system still runs and the corresponding features are inert." },

  // -------------------- 3. Sign-up, log-in, profile --------------------
  { type: "h1", text: "3. Sign-up, Log-in, and Profile" },

  { type: "h2", text: "3.1 Creating an account" },
  { type: "p", text: "Open /signup and enter your name, email, and password. The system creates a Member account by default. If your email is listed in the COORDINATOR_EMAILS environment variable (comma-separated), you are promoted to Coordinator on first sign-up. Passwords are hashed with bcrypt before storage." },

  { type: "h2", text: "3.2 Logging in" },
  { type: "p", text: "Open /login, enter your email and password. NextAuth issues a session cookie; you are redirected to /dashboard. Coordinators see additional /admin entries in the sidebar (Admin Dashboard, Reviewers, Venues)." },

  { type: "h2", text: "3.3 Profile" },
  { type: "p", text: "Open /profile to update your display name, affiliation, and expertise. Affiliation is used by the conflict-of-interest detector to flag reviewers who share an institution with a paper's authors -- keep it accurate. Expertise is plain text used by coordinators when picking reviewers." },

  { type: "h2", text: "3.4 Linking Slack (optional)" },
  { type: "p", text: "Open /link-slack to attach your Slack member ID to your account. Slack endpoints are scaffolded but not wired to a Slack bot in this version; the linking is preserved so a Slack integration can be added later without losing user mappings." },

  // -------------------- 4. Member as Author --------------------
  { type: "h1", text: "4. Author Workflow" },
  { type: "p", text: "This chapter walks through everything an author does, from submitting a paper to receiving and responding to reviews." },

  { type: "h2", text: "4.1 Submitting a paper" },
  { type: "p", text: "Open the dashboard and click 'Submit New Paper', or go directly to /papers/new. Fill in:" },
  { type: "ul", items: [
    "Title and abstract.",
    "Paper type: RESEARCH, SURVEY, TOOL, or EXPERIENCE_REPORT. The choice activates a paper-type-specific compliance checklist.",
    "PDF source: upload a file, paste a public URL, or paste an Overleaf project link. At least one is required.",
    "Target venue (optional at this stage but required for compliance to run).",
  ] },
  { type: "p", text: "On submit, the system extracts text and basic metadata from the PDF, stores the file under uploads/, and -- if a venue was selected -- runs an initial compliance check in the background." },

  { type: "h2", text: "4.2 Reading the compliance results" },
  { type: "p", text: "Open the paper detail page (/papers/[id]). The Compliance card shows one badge per check dimension:" },
  { type: "ul", items: [
    "PASS -- requirement satisfied.",
    "FAIL -- requirement clearly violated; usually blocks venue submission.",
    "WARNING -- ambiguous; review manually.",
    "MANUAL -- system cannot verify automatically; you should check yourself.",
    "SKIPPED -- not applicable for this paper type or venue.",
  ] },
  { type: "p", text: "Click a dimension to expand evidence (extracted excerpts, page numbers). The AI Compliance card displays a desk-reject risk rating (low / medium / high) and grounded recommendations. If a check fails, edit the paper to fix the issue and re-run compliance." },

  { type: "h2", text: "4.3 Editing and reuploading" },
  { type: "p", text: "Click 'Edit Paper' on the detail page (/papers/[id]/edit) to change the title, abstract, paper type, or PDF. When you replace the PDF, the previous file is archived as a paper version (visible in the Version History card) and compliance re-runs against the new content." },

  { type: "h2", text: "4.4 Choosing and submitting to a venue" },
  { type: "p", text: "The Venue Submission card on the paper detail page shows the top five AI-ranked venues, each with a numerical score and the reasons it ranked there (paper-type match, keyword overlap, domain match, acronym mention, open submission window). Pick a venue and click 'Submit to Venue' -- this transitions the paper to SUBMITTED_TO_VENUE. The button is disabled until every compliance check passes (FAIL is blocking; WARNING and MANUAL are not)." },

  { type: "h2", text: "4.5 Receiving reviews and rating reviewers" },
  { type: "p", text: "When a reviewer submits a review, you receive an in-app notification and email (if Resend is configured). The review appears on the paper detail page with the reviewer's comments, recommendation (ACCEPT / MINOR_REVISION / MAJOR_REVISION / REJECT), and 0-5 score. Each review has a 'Rate this review' form: rate the quality, quantity, and timeliness of the review on a scale. Your ratings feed into the reviewer leaderboard and help the coordinator track reviewer health over time." },

  { type: "h2", text: "4.6 Responding to a revision request" },
  { type: "p", text: "If the coordinator requests a revision, your paper detail page displays a yellow banner with the coordinator's note. Click 'Edit Paper', reupload the revised PDF, and save. The old PDF moves into Version History tagged 'REVISION'. The coordinator then opens a new review round; you do not need to do anything else to start it." },

  // -------------------- 5. Member as Reviewer --------------------
  { type: "h1", text: "5. Reviewer Workflow" },
  { type: "p", text: "This chapter covers what to do when you have been assigned to review a paper." },

  { type: "h2", text: "5.1 Finding your assignments" },
  { type: "p", text: "On /dashboard, the Pending Reviews card shows your active assignments at a glance. For the full list, open /reviews/mine. Each assignment shows the paper title, deadline, current round number, and your status (PENDING / ACCEPTED / DECLINED / EXTENSION_REQUESTED / SUBMITTED / OVERDUE)." },

  { type: "h2", text: "5.2 Accepting, declining, or requesting an extension" },
  { type: "p", text: "Open an assignment at /reviews/[assignmentId]. The Actions card has three buttons:" },
  { type: "ul", items: [
    "Accept -- the assignment moves to ACCEPTED. The coordinator is notified.",
    "Decline -- you are prompted for an optional reason. The assignment moves to DECLINED and the coordinator can reassign.",
    "Request Extension -- the assignment moves to EXTENSION_REQUESTED. The coordinator can approve (default +7 days) or deny.",
  ] },

  { type: "h2", text: "5.3 Opening the annotated PDF viewer" },
  { type: "p", text: "From the review workspace, click 'Open Annotated Viewer'. This opens /papers/[id]/view?assignmentId=[your-assignment-id], where you can highlight text, draw freehand doodles, and place comment pins. See chapter 7 for full reference of the viewer." },

  { type: "h2", text: "5.4 Using AI Review Suggestions" },
  { type: "p", text: "When ANTHROPIC_API_KEY is configured, the review workspace shows an AI Suggestions panel on the right. Claude reads the paper and produces a draft summary, key strengths, and concerns. Each claim includes a verbatim quote from the paper; if a claim could not be grounded, it is flagged 'unsupported'. Use the panel as a starting point or sanity check -- it is not auto-filled into your review form, and you remain responsible for what you submit." },

  { type: "h2", text: "5.5 Submitting the review" },
  { type: "p", text: "On the same /reviews/[assignmentId] page, fill in the Review Submission form:" },
  { type: "ul", items: [
    "Overall comments -- free text; should justify your recommendation.",
    "Recommendation -- ACCEPT, MINOR_REVISION, MAJOR_REVISION, or REJECT.",
    "Overall score -- 0 to 5.",
  ] },
  { type: "p", text: "Click 'Submit Review'. Once submitted you cannot edit it; the assignment moves to SUBMITTED, the author and coordinator are notified, and the review appears on the paper detail page." },

  { type: "h2", text: "5.6 Promoting annotations to authors" },
  { type: "p", text: "Annotations you create in the viewer are PRIVATE by default. Before submitting your review, you may promote individual annotations to SHARED so the author can see them on their own copy of the paper. Use the per-annotation toggle in the annotations sidebar." },

  { type: "h2", text: "5.7 Exporting an annotated PDF" },
  { type: "p", text: "Click 'Export Annotated PDF' in the viewer toolbar to download a copy of the paper with all your annotations baked in: highlights become coloured rectangles, doodles become pen strokes, and comments become PDF sticky notes with their severity colour. Useful for archival or for sharing the marked-up paper outside the system." },

  // -------------------- 6. Coordinator --------------------
  { type: "h1", text: "6. Coordinator Workflow" },
  { type: "p", text: "Coordinators have access to /admin and a superset of Member capabilities. This chapter covers the coordinator-only screens." },

  { type: "h2", text: "6.1 Admin dashboard" },
  { type: "p", text: "Open /admin/dashboard. The page shows top-level stats (total papers, active papers, pending reviews, overdue, completed, upcoming deadlines), papers awaiting reviewer assignment, reviewer attention alerts (overload or inactivity), the workload distribution, and any pending extension requests." },

  { type: "h2", text: "6.2 Managing venues" },
  { type: "p", text: "Open /admin/venues to view existing venues. Click 'New Venue' or open /admin/venues/new to create one with name, type tags, page limits, required sections, deadlines, and domain keywords (used for venue recommendations). You can edit a venue at any time -- existing papers keep referring to the same venue record." },

  { type: "h2", text: "6.3 Running compliance checks" },
  { type: "p", text: "Compliance runs automatically when a paper is created or updated and a venue is set. To re-run manually, open the paper detail page and click 'Run Compliance Checks' in the Compliance card. The AI Compliance card additionally calls Claude to assess venue-specific concerns (anonymity, AI disclosure, data availability, broader impact, reproducibility, and so on) and returns a desk-reject risk rating with grounded evidence." },

  { type: "h2", text: "6.4 Assigning reviewers" },
  { type: "p", text: "Open /admin/papers/[id]/assign. The interface lists every Member with:" },
  { type: "ul", items: [
    "Active workload -- how many open assignments they have.",
    "COI badges if any -- SELF_AUTHOR (they are listed as an author of this paper), LISTED_IN_PDF (a name in the extracted PDF text matches theirs), or SHARED_AFFILIATION (their stored affiliation overlaps with the paper's extracted affiliations). Reviewers with conflicts can still be assigned, but you see the flag.",
    "Prior-round history -- whether they reviewed this paper in an earlier round.",
  ] },
  { type: "p", text: "Pick reviewers, set per-assignment deadlines, and click 'Save Round'. Each assigned reviewer is notified and the paper moves to UNDER_REVIEW. To start a new round (after a revision, for example), use the 'Start New Round' button at the top of the page." },

  { type: "h2", text: "6.5 Handling extension requests" },
  { type: "p", text: "When a reviewer requests an extension, it shows up in the Extension Requests card on /admin/dashboard. Click 'Approve' (extends the deadline, default +7 days) or 'Deny'. The reviewer is notified either way." },

  { type: "h2", text: "6.6 Requesting a revision" },
  { type: "p", text: "On the paper detail page, the Status Actions card includes 'Request Revision'. Click it, type a guidance note for the author, and confirm. The paper status moves to REVISION_REQUESTED, the author sees a banner with your note, and the workflow waits until they reupload." },

  { type: "h2", text: "6.7 Starting a new review round" },
  { type: "p", text: "After the author reuploads, return to /admin/papers/[id]/assign?roundId=<new-round-id> (the link is on the paper detail page). The same assignment interface appears with prior-reviewer history visible, so you can either keep the same reviewers or pick fresh ones. Saving creates the new round and notifies the chosen reviewers." },

  { type: "h2", text: "6.8 Generating an AI synthesis report" },
  { type: "p", text: "Once at least one review has been submitted, the paper detail page shows an AI Synthesis card with a 'Generate Report' button. The report combines all reviews into a consensus summary, agreed strengths, agreed concerns, divergences, and an overall recommendation. You can re-generate at any time and download the result as a PDF." },

  { type: "h2", text: "6.9 Reviewer analytics" },
  { type: "p", text: "Open /admin/reviewers for the leaderboard:" },
  { type: "ul", items: [
    "Each row shows assignments completed, currently active, overdue, acceptance rate, on-time rate, and average quality / quantity / timeliness / overall scores.",
    "Use the period selector to view the last month, last year, or all time.",
    "Click a reviewer to drill down to /admin/reviewers/[id] for per-paper history.",
    "Use the export buttons to download CSV or PDF of the leaderboard or workload report.",
  ] },

  { type: "h2", text: "6.10 Triggering reminder emails manually" },
  { type: "p", text: "The Run Reminders button on /admin/dashboard fires the same job that the cron schedule runs (POST /api/cron/reminders). It sends 3-day, 1-day, and overdue notifications and marks any past-due assignments OVERDUE. The job is idempotent -- it skips reviewers who were already notified at that threshold." },

  // -------------------- 7. PDF annotation viewer --------------------
  { type: "h1", text: "7. PDF Annotation Viewer Reference" },
  { type: "p", text: "The viewer is used by reviewers to mark up assigned papers and by authors to read shared annotations on their own papers. Open it from the paper detail page ('Open Viewer') or from a review workspace ('Open Annotated Viewer')." },

  { type: "h2", text: "7.1 Toolbar" },
  { type: "p", text: "From left to right: zoom in / out, page navigation (prev / next), jump-to-page input, undo and redo, tool selector (cursor / highlight / doodle / comment), colour pickers, export button, and annotations-sidebar toggle." },

  { type: "h2", text: "7.2 Tools" },
  { type: "ul", items: [
    "Cursor -- selection and navigation. Default tool.",
    "Highlight -- drag-select text to highlight in the chosen colour (5 colours available). The text is captured along with the highlight rectangle so it appears in the annotations sidebar and in exports.",
    "Doodle -- freehand pen. Draw on the page in the chosen colour and stroke width; strokes are smoothed by perfect-freehand.",
    "Comment -- click anywhere on a page to drop an anchor pin, then type a comment and choose its severity. Severity levels are CRITICAL, MAJOR, MINOR, SUGGESTION, and QUESTION; each gets a distinct colour.",
  ] },

  { type: "h2", text: "7.3 Visibility" },
  { type: "p", text: "Annotations are PRIVATE by default and visible only to their creator. A reviewer can promote individual annotations to SHARED before or at the time of review submission; SHARED annotations are visible to the paper's author and the coordinator. Authors only see SHARED reviewer annotations plus their own. Coordinators see everything except other reviewers' private annotations on the same paper." },

  { type: "h2", text: "7.4 Annotations sidebar" },
  { type: "p", text: "Toggle the sidebar from the toolbar. It lists every annotation grouped by type (highlight / doodle / comment) and filterable by page and author. Click an annotation to jump to its location in the PDF; click again on the row to edit text, change colour, or update severity." },

  { type: "h2", text: "7.5 Exporting" },
  { type: "p", text: "Click the export button to download a PDF with annotations baked in. Highlights are rendered as coloured rectangles over their target text; doodles are flattened to vector strokes; comments are added as PDF sticky-note annotations with the severity colour and the author's name. The exported PDF is portable and opens correctly in any PDF viewer." },

  // -------------------- 8. AI features reference --------------------
  { type: "h1", text: "8. AI Features Reference" },
  { type: "p", text: "All AI features call the Anthropic API (Claude) and require ANTHROPIC_API_KEY in the environment. Without that key, AI panels and buttons either hide or display a helpful message; the rest of the system continues to work." },

  { type: "h2", text: "8.1 Compliance check" },
  { type: "p", text: "Verifies a paper against its target venue and paper type. Dimensions covered include page limit, abstract length, required sections, reference format, anonymity (organisation names, PDF metadata, tool/dataset links), template, AI-disclosure statement, broader-impact section, data-availability statement, limitations, and reproducibility. Each dimension returns a verdict (pass / fail / warning / manual / skipped), evidence excerpts from the paper, and a recommendation. The result also includes a desk-reject-risk rating (low / medium / high). Claims that cannot be grounded in the paper text are flagged as unsupported." },

  { type: "h2", text: "8.2 Reviewer suggestions" },
  { type: "p", text: "Generates a draft review for the assigned reviewer. Returns: a paper summary, key strengths, key concerns, and an overall framing. Each strength and concern includes a verbatim quote from the paper as evidence; if a verbatim match cannot be found, the item is flagged unsupported. The reviewer reads the panel for inspiration -- nothing is auto-filled into the review form." },

  { type: "h2", text: "8.3 Synthesis report" },
  { type: "p", text: "Combines every submitted review for a paper into a consensus summary, agreed strengths, agreed concerns, reviewer divergences, and an overall recommendation. The coordinator generates this from the paper detail page; the report is stored alongside the paper and can be downloaded as a PDF that uses the same look as this manual." },

  { type: "h2", text: "8.4 Annotated PDF generation" },
  { type: "p", text: "Generates a PDF copy of the paper with reviewer comments rendered as PDF sticky-note annotations, anchored on the page they originally targeted. Useful when sharing review outcomes outside the system or archiving a frozen copy of the marked-up paper." },

  // -------------------- 9. Notifications & reminders --------------------
  { type: "h1", text: "9. Notifications and Reminders" },

  { type: "h2", text: "9.1 In-app feed" },
  { type: "p", text: "Every notification appears on /dashboard in the recent-notifications card. Click an item to mark it read; it stays in the feed but turns inactive. New notifications since your last visit are visually highlighted." },

  { type: "h2", text: "9.2 Email" },
  { type: "p", text: "If RESEND_API_KEY is set, the system sends transactional emails for the same events: assignment created, deadline reminder (3 day / 1 day / overdue), review submitted, rating received, extension requested or approved or denied, paper accepted, paper rejected, revision requested. If the key is missing, email is skipped silently -- the in-app feed still works." },

  { type: "h2", text: "9.3 Reminder cron" },
  { type: "p", text: "POST /api/cron/reminders is the scheduled job. Authenticate with header 'Authorization: Bearer <CRON_SECRET>'. The job is idempotent -- it tracks recent notifications per assignment so a reviewer is not pinged twice in the same window. Schedule it with Vercel Cron, GitHub Actions, or any external scheduler that can hit an HTTPS endpoint with a header." },

  { type: "h2", text: "9.4 Notification types (reference)" },
  { type: "ul", items: [
    "ASSIGNMENT_NEW -- you were assigned to review a paper.",
    "DEADLINE_REMINDER -- your review deadline is approaching (3 days or 1 day).",
    "DEADLINE_OVERDUE -- your review deadline has passed.",
    "REVIEW_SUBMITTED -- your paper has a new review.",
    "RATING_RECEIVED -- the author rated your review.",
    "EXTENSION_REQUESTED -- a reviewer requested an extension.",
    "EXTENSION_APPROVED / EXTENSION_DENIED -- the coordinator decided on your extension.",
    "PAPER_ACCEPTED / PAPER_REJECTED -- final decision on a paper.",
    "REVISION_REQUESTED -- the coordinator requested a revision of your paper.",
  ] },

  // -------------------- 10. Troubleshooting --------------------
  { type: "h1", text: "10. Troubleshooting and FAQ" },

  { type: "h2", text: "10.1 'My compliance check never finishes / shows nothing'" },
  { type: "p", text: "The paper needs a target venue assigned for compliance to run. Open /papers/[id]/edit, set the venue, and save. Compliance re-runs automatically." },

  { type: "h2", text: "10.2 'The Submit-to-Venue button is disabled'" },
  { type: "p", text: "At least one compliance check is failing. Open the Compliance card on the paper detail page and address each FAIL. Once everything is PASS, WARNING, MANUAL, or SKIPPED (only FAIL is blocking), the button enables." },

  { type: "h2", text: "10.3 'AI panels are empty / blank'" },
  { type: "p", text: "ANTHROPIC_API_KEY is missing or invalid. Set it in .env and restart the dev server. The same key is used for compliance, review suggestions, synthesis, and annotated PDF generation." },

  { type: "h2", text: "10.4 'No emails received'" },
  { type: "p", text: "RESEND_API_KEY is missing or your sender domain is not verified with Resend. The system always falls back to the in-app feed, so you can still see notifications on /dashboard." },

  { type: "h2", text: "10.5 'PDF text extraction returns empty / nonsense'" },
  { type: "p", text: "The PDF is image-only (typically a scan). pdf-parse needs embedded text. Re-export the PDF from your authoring tool with text layer enabled, or run OCR before uploading." },

  { type: "h2", text: "10.6 'A reviewer I expected is missing from the assign list'" },
  { type: "p", text: "Either they are listed as an author of this paper (the system blocks self-assignment), or they have a hard COI flag that the assign UI suppresses. Check the COI badges -- if the reviewer is needed despite the flag, you can still pick them; nothing is hard-blocked." },

  { type: "h2", text: "10.7 'Cron reminder endpoint returns 401 Unauthorized'" },
  { type: "p", text: "The Bearer token does not match CRON_SECRET. Make sure your scheduler is sending: Authorization: Bearer <value of CRON_SECRET in your .env>." },

  { type: "h2", text: "10.8 'I changed roles via COORDINATOR_EMAILS but my account still shows Member'" },
  { type: "p", text: "Role promotion happens at first sign-up only. If your account already exists, edit data/users.json directly and set role to COORDINATOR for the affected email, then sign out and back in." },

  // -------------------- 11. Appendix --------------------
  { type: "h1", text: "11. Appendix" },

  { type: "h2", text: "A. Default seed credentials" },
  { type: "p", text: "Running 'node scripts/seed-fake-users.mjs' regenerates 'scripts/SEED_CREDENTIALS.md' with the full list of seeded accounts grouped by role. The shared password for every seeded account is 'password123'. Coordinator accounts: anshumanmullick7@gmail.com, eray.tuzun@bilkent.edu.tr." },

  { type: "h2", text: "B. Environment variables" },
  { type: "kv", rows: [
    ["AUTH_SECRET", "Required. NextAuth session-signing key. At least 32 random characters. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""],
    ["AUTH_URL", "Required. Canonical auth URL. Use http://localhost:3000 locally, your deployed URL in production."],
    ["AUTH_TRUST_HOST", "Optional. Set to true behind a reverse proxy (e.g. Vercel) so NextAuth trusts X-Forwarded-Host."],
    ["COORDINATOR_EMAILS", "Optional. Comma-separated email addresses promoted to Coordinator role on first sign-up."],
    ["ANTHROPIC_API_KEY", "Optional. Enables AI features: compliance, review suggestions, synthesis report, annotated PDF generation."],
    ["RESEND_API_KEY", "Optional. Enables transactional email notifications via Resend. Without it, in-app notifications still work."],
    ["EMAIL_FROM", "Optional. From address for outbound email. Default: BILSEN <noreply@bilsen.app>."],
    ["CRON_SECRET", "Optional. Bearer token for POST /api/cron/reminders. Required if you want automated deadline reminders."],
    ["NODE_ENV", "Standard Node convention -- development or production."],
  ] },

  { type: "h2", text: "C. Glossary" },
  { type: "kv", rows: [
    ["Round", "A numbered review cycle on a paper. Round 1 is the first review of a paper; round 2 is the review after a revision; etc."],
    ["Assignment", "A specific reviewer-on-paper-in-round task with its own deadline and status (PENDING, ACCEPTED, DECLINED, EXTENSION_REQUESTED, SUBMITTED, OVERDUE)."],
    ["COI", "Conflict of interest. Categories: SELF_AUTHOR (reviewer is an author), LISTED_IN_PDF (reviewer name appears in the extracted PDF), SHARED_AFFILIATION (reviewer affiliation overlaps paper affiliations)."],
    ["Venue", "A target conference, journal, or workshop with its own page limit, required sections, deadlines, and domain tags. Drives compliance checks and recommendations."],
    ["Compliance dimension", "A single venue requirement (page limit, anonymity, etc.) that the system checks. Each returns one of: pass, fail, warning, manual, skipped."],
    ["Severity", "On comments only: CRITICAL, MAJOR, MINOR, SUGGESTION, QUESTION. Drives the comment pin colour."],
    ["Paper version", "An archived earlier copy of a paper's PDF, kept after a revision or manual reupload, with reason tag REVISION or MANUAL_REUPLOAD."],
    ["Visibility", "Per-annotation flag: PRIVATE (only the creator sees it) or SHARED (the paper author and coordinator see it)."],
    ["Recommendation", "A reviewer's bottom-line verdict: ACCEPT, MINOR_REVISION, MAJOR_REVISION, or REJECT."],
  ] },

  { type: "h2", text: "D. Route map" },
  { type: "p", text: "Paths visible to all signed-in users:" },
  { type: "ul", items: [
    "/dashboard -- home (stats, pending reviews, recent papers, notifications).",
    "/profile -- account profile.",
    "/link-slack -- attach Slack member ID.",
    "/papers -- your papers.",
    "/papers/new -- submit a new paper.",
    "/papers/[id] -- paper detail (compliance, versions, venue submission, AI report card).",
    "/papers/[id]/edit -- edit metadata or replace PDF.",
    "/papers/[id]/view -- annotated PDF viewer.",
    "/reviews/mine -- your assignments.",
    "/reviews/[assignmentId] -- review workspace.",
  ] },
  { type: "p", text: "Coordinator-only paths:" },
  { type: "ul", items: [
    "/admin/dashboard -- admin overview.",
    "/admin/papers/[id]/assign -- reviewer assignment.",
    "/admin/reviewers -- leaderboard with period selector and exports.",
    "/admin/reviewers/[id] -- per-reviewer drill-down.",
    "/admin/venues -- venues list.",
    "/admin/venues/new -- create a venue.",
  ] },

  { type: "h2", text: "E. Further reading" },
  { type: "ul", items: [
    "BUILD.md -- step-by-step build instructions for a fresh clone.",
    "scripts/SEED_CREDENTIALS.md -- full list of seeded accounts and their roles.",
    "slides319.pptx -- project pitch and as-is / to-be process diagrams.",
    "src/lib/ai-compliance.ts -- exact list of compliance dimensions and prompts.",
    "src/lib/coi-detection.ts -- COI matching logic.",
    "src/lib/venue-recommender.ts -- recommendation scoring formula.",
  ] },
];

// ============================================================
// PDF renderer (mirrors src/lib/pdf-report.ts style)
// ============================================================
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 60;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const LINE_H = 14;
const SIZES = { h1: 16, h2: 13, h3: 11, body: 10, code: 9 };

function sanitize(s) {
  // pdf-lib StandardFonts only render WinAnsi; non-ASCII becomes '?' upstream
  return String(s).replace(/[^\x20-\x7E\n]/g, "?");
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class PdfBuilder {
  constructor(doc, fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.page = null;
    this.cursorY = 0;
    this.maxWidth = PAGE_W - 2 * MARGIN_X;
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.cursorY = PAGE_H - MARGIN_TOP;
  }
  ensure(needed) {
    if (this.cursorY - needed < MARGIN_BOTTOM) this.newPage();
  }
  draw(text, x, y, opts = {}) {
    const font = opts.font || this.fonts.regular;
    const size = opts.size || SIZES.body;
    const color = opts.color || rgb(0.1, 0.1, 0.1);
    this.page.drawText(sanitize(text), { x, y, size, font, color });
  }
  drawH1(text) {
    this.newPage();
    this.draw(text, MARGIN_X, this.cursorY - SIZES.h1, {
      font: this.fonts.bold,
      size: SIZES.h1,
      color: rgb(0, 0, 0),
    });
    this.cursorY -= SIZES.h1 + 8;
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.cursorY + 4 },
      end: { x: PAGE_W - MARGIN_X, y: this.cursorY + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    this.cursorY -= 8;
  }
  drawH2(text) {
    this.cursorY -= 6;
    this.ensure(SIZES.h2 + 8);
    this.draw(text, MARGIN_X, this.cursorY - SIZES.h2, {
      font: this.fonts.bold,
      size: SIZES.h2,
      color: rgb(0, 0, 0),
    });
    this.cursorY -= SIZES.h2 + 4;
  }
  drawH3(text) {
    this.cursorY -= 4;
    this.ensure(SIZES.h3 + 6);
    this.draw(text, MARGIN_X, this.cursorY - SIZES.h3, {
      font: this.fonts.bold,
      size: SIZES.h3,
    });
    this.cursorY -= SIZES.h3 + 3;
  }
  drawParagraph(text) {
    const lines = wrapText(text, this.fonts.regular, SIZES.body, this.maxWidth);
    for (const line of lines) {
      this.ensure(LINE_H);
      this.draw(line, MARGIN_X, this.cursorY - SIZES.body);
      this.cursorY -= LINE_H;
    }
    this.cursorY -= 3;
  }
  drawBullet(text) {
    const indent = 14;
    const lines = wrapText(text, this.fonts.regular, SIZES.body, this.maxWidth - indent);
    for (let i = 0; i < lines.length; i++) {
      this.ensure(LINE_H);
      if (i === 0) {
        this.draw("-", MARGIN_X, this.cursorY - SIZES.body, { color: rgb(0.4, 0.4, 0.4) });
      }
      this.draw(lines[i], MARGIN_X + indent, this.cursorY - SIZES.body);
      this.cursorY -= LINE_H;
    }
  }
  drawNumbered(text, n) {
    const indent = 22;
    const prefix = `${n}.`;
    const lines = wrapText(text, this.fonts.regular, SIZES.body, this.maxWidth - indent);
    for (let i = 0; i < lines.length; i++) {
      this.ensure(LINE_H);
      if (i === 0) {
        this.draw(prefix, MARGIN_X, this.cursorY - SIZES.body, { color: rgb(0.4, 0.4, 0.4) });
      }
      this.draw(lines[i], MARGIN_X + indent, this.cursorY - SIZES.body);
      this.cursorY -= LINE_H;
    }
  }
  drawCode(text) {
    const lines = String(text).split("\n");
    for (const line of lines) {
      this.ensure(LINE_H);
      this.draw(line, MARGIN_X + 8, this.cursorY - SIZES.code, {
        font: this.fonts.mono,
        size: SIZES.code,
        color: rgb(0.15, 0.2, 0.4),
      });
      this.cursorY -= LINE_H - 1;
    }
    this.cursorY -= 3;
  }
  drawKV(rows) {
    const keyWidth = 150;
    for (const [key, val] of rows) {
      const valLines = wrapText(val, this.fonts.regular, SIZES.body, this.maxWidth - keyWidth - 8);
      const blockHeight = valLines.length * LINE_H + 2;
      this.ensure(blockHeight);
      this.draw(key, MARGIN_X, this.cursorY - SIZES.body, {
        font: this.fonts.bold,
        size: SIZES.body,
      });
      for (let i = 0; i < valLines.length; i++) {
        this.draw(valLines[i], MARGIN_X + keyWidth, this.cursorY - SIZES.body - i * LINE_H);
      }
      this.cursorY -= blockHeight;
    }
    this.cursorY -= 2;
  }
}

async function buildPdf() {
  const doc = await PDFDocument.create();
  doc.setTitle(TITLE);
  doc.setAuthor("BILSEN");
  doc.setSubject("CS-319 D5 user manual");
  doc.setCreator("scripts/build-user-manual.mjs");

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  const b = new PdfBuilder(doc, fonts);

  // Cover page (uses the page already created by PdfBuilder constructor)
  b.cursorY = PAGE_H - 220;
  b.draw(TITLE, MARGIN_X, b.cursorY, { font: fonts.bold, size: 24, color: rgb(0, 0, 0) });
  b.cursorY -= 32;
  for (const line of wrapText(SUBTITLE, fonts.regular, 13, PAGE_W - 2 * MARGIN_X)) {
    b.draw(line, MARGIN_X, b.cursorY, { size: 13, color: rgb(0.3, 0.3, 0.3) });
    b.cursorY -= 18;
  }
  b.cursorY -= 60;
  b.draw(`Version ${VERSION}`, MARGIN_X, b.cursorY, { font: fonts.bold });
  b.cursorY -= 18;
  b.draw(`Generated ${DATE}`, MARGIN_X, b.cursorY);
  b.cursorY -= 18;
  b.draw("Audience: BILSEN Coordinators and Members (authors and reviewers)", MARGIN_X, b.cursorY);
  b.cursorY -= 18;
  b.draw("Companion: USER_MANUAL.md (auto-generated alongside this PDF)", MARGIN_X, b.cursorY);

  // Body
  for (const block of content) {
    switch (block.type) {
      case "h1": b.drawH1(block.text); break;
      case "h2": b.drawH2(block.text); break;
      case "h3": b.drawH3(block.text); break;
      case "p":  b.drawParagraph(block.text); break;
      case "ul":
        for (const item of block.items) b.drawBullet(item);
        b.cursorY -= 2;
        break;
      case "ol":
        for (let i = 0; i < block.items.length; i++) b.drawNumbered(block.items[i], i + 1);
        b.cursorY -= 2;
        break;
      case "code": b.drawCode(block.text); break;
      case "kv":   b.drawKV(block.rows); break;
      default: throw new Error(`Unknown block type: ${block.type}`);
    }
  }

  // Footer page numbers (skip cover at index 0)
  const pages = doc.getPages();
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    const page = pages[i];
    if (i === 0) continue;
    page.drawText(sanitize(TITLE), {
      x: MARGIN_X,
      y: 30,
      size: 8,
      font: fonts.regular,
      color: rgb(0.55, 0.55, 0.55),
    });
    page.drawText(`Page ${i + 1} of ${total}`, {
      x: PAGE_W - MARGIN_X - 70,
      y: 30,
      size: 8,
      font: fonts.regular,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  return doc.save();
}

// ============================================================
// Markdown renderer
// ============================================================
function buildMarkdown() {
  const out = [];
  out.push(`# ${TITLE}`);
  out.push("");
  out.push(`**${SUBTITLE}**`);
  out.push("");
  out.push(`Version ${VERSION} -- generated ${DATE}.`);
  out.push("");
  out.push("Audience: BILSEN Coordinators and Members (authors and reviewers).");
  out.push("");
  out.push("> This file is auto-generated by `scripts/build-user-manual.mjs` together with `USER_MANUAL.pdf`. Edit the script's `content` array (not this file) to make changes.");
  out.push("");
  out.push("---");
  out.push("");

  for (const block of content) {
    switch (block.type) {
      case "h1": out.push(`## ${block.text}`); out.push(""); break;
      case "h2": out.push(`### ${block.text}`); out.push(""); break;
      case "h3": out.push(`#### ${block.text}`); out.push(""); break;
      case "p":  out.push(block.text); out.push(""); break;
      case "ul":
        for (const item of block.items) out.push(`- ${item}`);
        out.push("");
        break;
      case "ol":
        for (let i = 0; i < block.items.length; i++) out.push(`${i + 1}. ${block.items[i]}`);
        out.push("");
        break;
      case "code":
        out.push("```");
        out.push(block.text);
        out.push("```");
        out.push("");
        break;
      case "kv":
        for (const [k, v] of block.rows) out.push(`- **${k}** -- ${v}`);
        out.push("");
        break;
      default: throw new Error(`Unknown block type: ${block.type}`);
    }
  }

  return out.join("\n");
}

// ============================================================
// Main
// ============================================================
const md = buildMarkdown();
fs.writeFileSync(MD_OUT, md, "utf8");
console.log(`Wrote ${path.relative(ROOT, MD_OUT)}  (${md.length} chars)`);

const pdfBytes = await buildPdf();
fs.writeFileSync(PDF_OUT, pdfBytes);
console.log(`Wrote ${path.relative(ROOT, PDF_OUT)}  (${pdfBytes.length} bytes)`);
