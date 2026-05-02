import Anthropic from "@anthropic-ai/sdk";
import type { VenueRecord, PaperRecord } from "@/lib/review-types";

const MODEL = "claude-sonnet-4-6";
const MAX_PAPER_CHARS = 80000;
// Thinking + final JSON share max_tokens. Stay under 21K to avoid the
// streaming-required threshold while leaving generous headroom for both.
const MAX_OUTPUT_TOKENS = 20000;
const THINKING_BUDGET_COMPLIANCE = 10000;
const THINKING_BUDGET_REFERENCES = 8000;

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Send the head of the paper (covers abstract → most body sections) plus the
// tail (covers references), keeping middle truncation explicit so the model
// knows what's missing.
function truncatePaperText(text: string): string {
  if (text.length <= MAX_PAPER_CHARS) return text;
  const headBudget = Math.floor(MAX_PAPER_CHARS * 0.7);
  const tailBudget = MAX_PAPER_CHARS - headBudget - 64;
  return (
    text.slice(0, headBudget) +
    "\n\n[... middle of paper truncated for length ...]\n\n" +
    text.slice(text.length - tailBudget)
  );
}

// With extended thinking and tools enabled, response.content interleaves
// thinking, server_tool_use, web_search_tool_result, and text blocks. The
// JSON output we want is split across the text blocks (typically the final
// one). Concatenate them in order so safeJsonParse can find the {...} span.
function extractFinalText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function safeJsonParse<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  // Strip code fences and any leading/trailing prose Claude might add.
  let cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
  // If the response contains other prose, find the first { ... } JSON span.
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// =====================================================================
// AI Paper Compliance Check
// =====================================================================

export interface AiComplianceDimensionResult {
  dimension: string;
  verdict: "pass" | "fail" | "warning" | "manual" | "skipped";
  summary: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
}

export interface AiComplianceResult {
  checks: AiComplianceDimensionResult[];
  deskRejectRisk: "low" | "medium" | "high" | "unknown";
  overallSummary: string;
  passed: boolean;
  failedDimensions: string[];
  warningDimensions: string[];
  modelUsed: string;
  paperTruncated: boolean;
  generatedAt: string;
  rawResponse?: string;
  error?: string;
}

const COMPLIANCE_DIMENSIONS = [
  "PAGE_LIMIT",
  "ABSTRACT",
  "REQUIRED_SECTIONS",
  "CONVENTIONAL_SECTIONS",
  "SPECIAL_REQUIRED_SECTIONS",
  "REFERENCE_FORMAT",
  "ANONYMITY",
  "TEMPLATE_FORMAT",
  "AI_DISCLOSURE",
  "BROADER_IMPACT",
  "DATA_AVAILABILITY",
  "LIMITATIONS",
  "REPRODUCIBILITY",
  "ETHICS_STATEMENT",
  "PAPER_TYPE_FIT",
  "DESK_REJECT_RISK",
] as const;

const COMPLIANCE_SYSTEM_PROMPT = `You are a meticulous academic submission compliance reviewer. You verify whether a manuscript follows a target venue's submission policies, drawing on the actual paper text and the venue's official requirements.

Process for each compliance dimension:
1. Read the venue rule for that dimension.
2. Inspect the paper text for evidence (sections, content, format clues).
3. Determine a verdict: pass / fail / warning / manual / skipped.
4. Quote specific evidence verbatim from the paper (or note its absence).
5. Suggest a concrete fix when verdict is fail/warning.
6. Report confidence 0.0-1.0.

Calibration guidelines:
- "pass" — the paper clearly satisfies the rule (you can quote evidence).
- "fail" — the paper clearly violates the rule (you can quote what's wrong, or confirm a required item is absent).
- "warning" — soft issue: convention not enforced, or minor issue that may not desk-reject but should be addressed.
- "manual" — cannot be automatically determined (e.g., template/font compliance from text alone). Tell the author what to verify.
- "skipped" — the rule does not apply to this paper or venue.
- Confidence: how sure you are of the verdict given the evidence available.

When evaluating:
- Required sections: look for actual section headings in the paper text (case-insensitive, allow common synonyms — "Approach" ≈ "Method", "Findings" ≈ "Results"). Do NOT flag a missing section if a synonym is present.
- Page limit: respect referencesCountTowardLimit and extraRefPages from the venue JSON. If references don't count, subtract estimated reference pages from page count before comparing.
- Anonymity: scan for first-person institution mentions ("our university X"), GitHub usernames pointing at named people, email addresses, identifying URLs.
- Reference format: numbered ([1], [2,3]) vs author-year ((Smith et al., 2024)) vs either. If the venue allows either, pass on either match.
- Special requirements: explicit AI/GenAI disclosure section, broader-impact section, data-availability statement, structured-abstract, limitations section, reproducibility checklist.
- Desk reject criteria: aggregate across the dimensions you've evaluated. The deskRejectRisk field is your overall judgment of whether the paper would survive a desk review.

Be skeptical: do not invent evidence. When you cannot find a section/feature in the paper text, report it as missing.

A web_search tool is available. The venue rules in the user prompt are authoritative for almost every dimension — only search the web when the venue JSON is ambiguous or you need to verify a recent template/format detail from the official CFP. Do not search for or about specific bibliography entries in this call (a separate agent handles references). Cap yourself at a few searches.

Return JSON only, exactly matching the schema described in the user prompt. Do not wrap in markdown.`;

export interface AiComplianceInput {
  paper: PaperRecord;
  venue: VenueRecord;
  paperText: string;
  pageCount: number | null;
  extractedSections: string[] | null;
  extractedReferences: string[] | null;
}

export async function runAiPaperCompliance(
  input: AiComplianceInput,
): Promise<AiComplianceResult> {
  const generatedAt = new Date().toISOString();

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      checks: [],
      deskRejectRisk: "unknown",
      overallSummary: "AI compliance check skipped: ANTHROPIC_API_KEY not configured.",
      passed: false,
      failedDimensions: [],
      warningDimensions: [],
      modelUsed: MODEL,
      paperTruncated: false,
      generatedAt,
      error: "no-api-key",
    };
  }

  const paperText = input.paperText ?? "";
  const truncated = paperText.length > MAX_PAPER_CHARS;
  const paperBlock = truncatePaperText(paperText);

  const venueRulesJson = JSON.stringify(
    {
      name: input.venue.name,
      track: input.venue.track,
      acronym: input.venue.acronym ?? null,
      pageLimit: input.venue.pageLimit,
      referencesCountTowardLimit: input.venue.referencesCountTowardLimit ?? null,
      extraRefPages: input.venue.extraRefPages ?? null,
      appendixCountsTowardLimit: input.venue.appendixCountsTowardLimit ?? null,
      abstractWordLimit: input.venue.abstractWordLimit,
      abstractStructuredRequired: input.venue.abstractStructuredRequired ?? null,
      requiredSections: input.venue.requiredSections,
      conventionalSections: input.venue.conventionalSections ?? [],
      specialRequiredSections: input.venue.specialRequiredSections ?? [],
      referenceFormat: input.venue.referenceFormat,
      referenceFormatDetails: input.venue.referenceFormatDetails ?? null,
      anonymityRequired: input.venue.anonymityRequired,
      template: input.venue.template ?? null,
      deskRejectCriteria: input.venue.deskRejectCriteria ?? [],
      paperTypes: input.venue.paperTypes,
      reviewPolicy: input.venue.reviewPolicy ?? null,
      authorshipPolicy: input.venue.authorshipPolicy ?? null,
      specialRequirements: input.venue.specialRequirements ?? null,
    },
    null,
    2,
  );

  const userPrompt = `PAPER METADATA:
- Title: ${input.paper.title}
- Page count (extracted from PDF): ${input.pageCount ?? "unknown"}
- Number of references extracted: ${input.extractedReferences?.length ?? "unknown"}
- Section headings extracted: ${input.extractedSections?.join(", ") || "none extracted"}
- Author-declared paper type: ${input.paper.paperType ?? "unknown"}
- Abstract: ${input.paper.abstractText ?? "(no abstract recorded)"}

VENUE REQUIREMENTS (the rules to check against):
${venueRulesJson}

PAPER FULL TEXT${truncated ? " (truncated — head + tail; middle elided)" : ""}:
${paperBlock}

Now analyze each compliance dimension below and return a JSON object exactly matching this schema:

{
  "checks": [
    {
      "dimension": "<one of ${COMPLIANCE_DIMENSIONS.join(", ")}>",
      "verdict": "pass" | "fail" | "warning" | "manual" | "skipped",
      "summary": "1-sentence finding",
      "evidence": ["specific quote or observation 1", "..."],
      "recommendation": "concrete fix or 'No action needed.'",
      "confidence": 0.0-1.0
    }
    // ... one entry per applicable dimension
  ],
  "deskRejectRisk": "low" | "medium" | "high",
  "overallSummary": "2-3 sentence overall assessment of submission readiness for ${input.venue.name}."
}

Cover every dimension that applies. Use "skipped" with a reason for dimensions that don't apply (e.g., AI_DISCLOSURE on a venue that doesn't require disclosure). Quote evidence verbatim from the paper text where possible — for missing items, the evidence may be a description of what was searched for and not found.

Return JSON only.`;

  let raw = "";
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      thinking: {
        type: "enabled",
        budget_tokens: THINKING_BUDGET_COMPLIANCE,
      },
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
      system: [
        {
          type: "text",
          text: COMPLIANCE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = extractFinalText(response.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[runAiPaperCompliance] API error:", message);
    return {
      checks: [],
      deskRejectRisk: "unknown",
      overallSummary: `AI compliance check failed: ${message}`,
      passed: false,
      failedDimensions: [],
      warningDimensions: [],
      modelUsed: MODEL,
      paperTruncated: truncated,
      generatedAt,
      error: message,
    };
  }

  const parsed = safeJsonParse<{
    checks?: Array<{
      dimension?: string;
      verdict?: string;
      summary?: string;
      evidence?: unknown;
      recommendation?: string;
      confidence?: number;
    }>;
    deskRejectRisk?: string;
    overallSummary?: string;
  }>(raw);

  if (!parsed || !Array.isArray(parsed.checks)) {
    return {
      checks: [],
      deskRejectRisk: "unknown",
      overallSummary: "AI returned an unparseable response. Re-run to retry.",
      passed: false,
      failedDimensions: [],
      warningDimensions: [],
      modelUsed: MODEL,
      paperTruncated: truncated,
      generatedAt,
      rawResponse: raw.slice(0, 4000),
      error: "parse-error",
    };
  }

  const checks: AiComplianceDimensionResult[] = parsed.checks.map((c) => {
    const verdictRaw = String(c.verdict ?? "manual").toLowerCase();
    const validVerdicts = ["pass", "fail", "warning", "manual", "skipped"] as const;
    const verdict = (validVerdicts as readonly string[]).includes(verdictRaw)
      ? (verdictRaw as AiComplianceDimensionResult["verdict"])
      : "manual";
    const evidence = Array.isArray(c.evidence)
      ? c.evidence.map((e) => String(e)).filter((e) => e.length > 0)
      : [];
    const confidenceRaw = typeof c.confidence === "number" ? c.confidence : 0.5;
    return {
      dimension: String(c.dimension ?? "UNKNOWN").toUpperCase(),
      verdict,
      summary: String(c.summary ?? "").slice(0, 1000),
      evidence: evidence.slice(0, 8).map((e) => e.slice(0, 800)),
      recommendation: String(c.recommendation ?? "").slice(0, 1000),
      confidence: Math.max(0, Math.min(1, confidenceRaw)),
    };
  });

  const deskRejectRiskRaw = String(parsed.deskRejectRisk ?? "unknown").toLowerCase();
  const validRisks = ["low", "medium", "high"] as const;
  const deskRejectRisk = (validRisks as readonly string[]).includes(deskRejectRiskRaw)
    ? (deskRejectRiskRaw as AiComplianceResult["deskRejectRisk"])
    : "unknown";

  const failedDimensions = checks.filter((c) => c.verdict === "fail").map((c) => c.dimension);
  const warningDimensions = checks.filter((c) => c.verdict === "warning").map((c) => c.dimension);
  const passed = failedDimensions.length === 0 && deskRejectRisk !== "high";

  return {
    checks,
    deskRejectRisk,
    overallSummary: String(parsed.overallSummary ?? "").slice(0, 1500),
    passed,
    failedDimensions,
    warningDimensions,
    modelUsed: MODEL,
    paperTruncated: truncated,
    generatedAt,
  };
}

// =====================================================================
// AI Reference Verification
// =====================================================================

export interface AiReferenceItem {
  index: number;
  raw: string;
  parsed: {
    title: string | null;
    authors: string[];
    year: number | null;
    venue: string | null;
    type: string | null;
    doi: string | null;
    arxivId: string | null;
  };
  status: "likely_real" | "uncertain" | "suspicious" | "malformed";
  concerns: string[];
  confidence: number;
}

export interface AiReferenceResult {
  references: AiReferenceItem[];
  summary: {
    total: number;
    likelyReal: number;
    uncertain: number;
    suspicious: number;
    malformed: number;
    overallAssessment: string;
  };
  modelUsed: string;
  generatedAt: string;
  rawResponse?: string;
  error?: string;
}

const REFERENCE_SYSTEM_PROMPT = `You are a reference verification assistant with access to a web_search tool. For each citation string from a paper's bibliography, your job is to (a) parse it into structured fields, (b) verify it actually exists by searching the web, and (c) flag fabrication or malformation.

Verification protocol per reference:
1. Parse title, authors, year, venue, DOI, and arxivId from the raw string.
2. Search the web — one focused query per reference is usually enough. Prefer the exact title in quotes plus the first author surname and year. If a DOI or arXiv ID is present, search for that directly.
3. Compare what you find to the parsed fields:
   - Matching paper found with consistent author/year/venue → status "likely_real", confidence ≥0.85.
   - Matching title but different year/venue/authors → status "suspicious"; list the mismatch in concerns.
   - No relevant search hits after a reasonable query → status "suspicious" with concern "no search hits for title". Do NOT fall back to "likely_real" based on training-data familiarity.
   - Citation too garbled to search (missing title or year, encoding artifacts) → status "malformed".
   - Multiple plausible candidates / partial matches → status "uncertain".

Use the search tool — do not skip searches even if a citation looks normal. A clean-looking but fabricated citation is exactly the failure mode this check exists to catch.

Common signs of fabrication to confirm via search: implausible author/year/venue combinations (e.g., "NeurIPS 1995" on a topic that emerged after 2015), made-up venue names, plausible-but-not-real titles, "et al." with no anchor first author, DOI patterns whose year prefix mismatches the cited year, placeholder-like titles ("A Novel Approach to X").

Common signs of malformed references: missing year/authors/title, truncated entries, two references concatenated, encoding artifacts ("Smith , J . & Doe , J .").

Return JSON only, no markdown. Schema is in the user prompt.`;

export interface AiReferenceInput {
  paperTitle: string;
  paperAbstract: string | null;
  paperDomain: string | null;
  references: string[];
  // Optional: full paper text from which Claude can re-extract references the
  // initial extraction missed.
  paperText?: string;
}

const REFERENCE_BATCH_SIZE = 30;
const MAX_REFERENCES = 200;

async function verifyReferenceBatch(
  batch: string[],
  batchIndex: number,
  totalBatches: number,
  input: AiReferenceInput,
): Promise<{ items: AiReferenceItem[]; error: string | null }> {
  const startIndex = batchIndex * REFERENCE_BATCH_SIZE + 1;
  const numbered = batch
    .map((r, i) => `[${startIndex + i}] ${r}`)
    .join("\n");

  const userPrompt = `PAPER CONTEXT:
- Title: ${input.paperTitle}
- Abstract: ${input.paperAbstract ?? "(none)"}
- Domain: ${input.paperDomain ?? "(unspecified)"}

REFERENCES (batch ${batchIndex + 1} of ${totalBatches}, indices ${startIndex}-${startIndex + batch.length - 1}):
${numbered}

For each reference, return:
{
  "index": <integer matching the [N] above>,
  "raw": "<the original reference text>",
  "parsed": {
    "title": "...",
    "authors": ["..."],
    "year": <integer or null>,
    "venue": "...",
    "type": "conference" | "journal" | "preprint" | "book" | "techreport" | "misc",
    "doi": "..." or null,
    "arxivId": "..." or null
  },
  "status": "likely_real" | "uncertain" | "suspicious" | "malformed",
  "concerns": ["specific concern 1", "..."],
  "confidence": 0.0-1.0
}

Final response shape:
{
  "references": [...]
}

Return JSON only.`;

  let raw = "";
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      thinking: {
        type: "enabled",
        budget_tokens: THINKING_BUDGET_REFERENCES,
      },
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 40,
        },
      ],
      system: [
        {
          type: "text",
          text: REFERENCE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = extractFinalText(response.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runReferenceVerification] batch ${batchIndex + 1} API error:`, message);
    return { items: [], error: message };
  }

  const parsed = safeJsonParse<{ references?: unknown[] }>(raw);
  if (!parsed || !Array.isArray(parsed.references)) {
    return { items: [], error: "parse-error" };
  }

  const items: AiReferenceItem[] = [];
  for (const item of parsed.references) {
    const it = (item ?? {}) as Record<string, unknown>;
    const parsedFields = (it.parsed ?? {}) as Record<string, unknown>;
    const statusRaw = String(it.status ?? "uncertain").toLowerCase();
    const validStatuses = ["likely_real", "uncertain", "suspicious", "malformed"] as const;
    const status = (validStatuses as readonly string[]).includes(statusRaw)
      ? (statusRaw as AiReferenceItem["status"])
      : "uncertain";
    const concerns = Array.isArray(it.concerns)
      ? it.concerns.map((c) => String(c)).filter(Boolean).slice(0, 5)
      : [];
    const confidenceRaw = typeof it.confidence === "number" ? it.confidence : 0.5;

    items.push({
      index: typeof it.index === "number" ? it.index : items.length + 1,
      raw: String(it.raw ?? ""),
      parsed: {
        title: typeof parsedFields.title === "string" ? parsedFields.title : null,
        authors: Array.isArray(parsedFields.authors)
          ? parsedFields.authors.map((a) => String(a)).filter(Boolean).slice(0, 20)
          : [],
        year: typeof parsedFields.year === "number" ? parsedFields.year : null,
        venue: typeof parsedFields.venue === "string" ? parsedFields.venue : null,
        type: typeof parsedFields.type === "string" ? parsedFields.type : null,
        doi: typeof parsedFields.doi === "string" ? parsedFields.doi : null,
        arxivId: typeof parsedFields.arxivId === "string" ? parsedFields.arxivId : null,
      },
      status,
      concerns,
      confidence: Math.max(0, Math.min(1, confidenceRaw)),
    });
  }
  return { items, error: null };
}

export async function runReferenceVerification(
  input: AiReferenceInput,
): Promise<AiReferenceResult> {
  const generatedAt = new Date().toISOString();

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      references: [],
      summary: {
        total: 0,
        likelyReal: 0,
        uncertain: 0,
        suspicious: 0,
        malformed: 0,
        overallAssessment: "AI reference verification skipped: ANTHROPIC_API_KEY not configured.",
      },
      modelUsed: MODEL,
      generatedAt,
      error: "no-api-key",
    };
  }

  // The first-pass paper extraction caps references at ~10 entries. If we have
  // fewer than 8 in `references` but a non-empty paperText, ask Claude to
  // re-extract the full bibliography. Otherwise, dedupe the supplied list.
  let allReferences = (input.references ?? []).map((r) => r.trim()).filter(Boolean);
  if (allReferences.length < 8 && input.paperText && input.paperText.length > 1000) {
    const extracted = await extractAllReferences(input.paperText);
    if (extracted.length > allReferences.length) {
      allReferences = extracted;
    }
  }
  // Dedupe by normalized text.
  const seen = new Set<string>();
  allReferences = allReferences.filter((r) => {
    const key = r.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (allReferences.length > MAX_REFERENCES) {
    allReferences = allReferences.slice(0, MAX_REFERENCES);
  }

  if (allReferences.length === 0) {
    return {
      references: [],
      summary: {
        total: 0,
        likelyReal: 0,
        uncertain: 0,
        suspicious: 0,
        malformed: 0,
        overallAssessment: "No references could be extracted from the paper for verification.",
      },
      modelUsed: MODEL,
      generatedAt,
      error: "no-references",
    };
  }

  // Process references in batches so we stay under per-call token budgets.
  const batches: string[][] = [];
  for (let i = 0; i < allReferences.length; i += REFERENCE_BATCH_SIZE) {
    batches.push(allReferences.slice(i, i + REFERENCE_BATCH_SIZE));
  }

  // Run batches in parallel — each call hits web_search up to ~30 times, so
  // sequential execution would blow the route's 600s budget on long
  // bibliographies. Anthropic Tier 2+ handles ~7 concurrent requests fine.
  const batchOutcomes = await Promise.all(
    batches.map((batch, b) =>
      verifyReferenceBatch(batch, b, batches.length, input),
    ),
  );

  const allItems: AiReferenceItem[] = batchOutcomes.flatMap((o) => o.items);
  const firstError = batchOutcomes.map((o) => o.error).find(Boolean) ?? null;

  const summary = {
    total: allItems.length,
    likelyReal: allItems.filter((r) => r.status === "likely_real").length,
    uncertain: allItems.filter((r) => r.status === "uncertain").length,
    suspicious: allItems.filter((r) => r.status === "suspicious").length,
    malformed: allItems.filter((r) => r.status === "malformed").length,
    overallAssessment: buildReferenceAssessment(allItems),
  };

  return {
    references: allItems,
    summary,
    modelUsed: MODEL,
    generatedAt,
    error: firstError ?? undefined,
  };
}

function buildReferenceAssessment(items: AiReferenceItem[]): string {
  if (items.length === 0) return "No references analyzed.";
  const sus = items.filter((r) => r.status === "suspicious");
  const malformed = items.filter((r) => r.status === "malformed");
  const uncertain = items.filter((r) => r.status === "uncertain");
  const parts: string[] = [];
  if (sus.length > 0) {
    parts.push(
      `${sus.length} reference${sus.length === 1 ? "" : "s"} flagged as suspicious — investigate before submission.`,
    );
  }
  if (malformed.length > 0) {
    parts.push(`${malformed.length} malformed entr${malformed.length === 1 ? "y" : "ies"} need cleanup.`);
  }
  if (uncertain.length > 0) {
    parts.push(`${uncertain.length} reference${uncertain.length === 1 ? "" : "s"} unverifiable from training data alone.`);
  }
  if (parts.length === 0) {
    return `${items.length} reference${items.length === 1 ? "" : "s"} parsed successfully; no fabrication signals detected.`;
  }
  return parts.join(" ");
}

// Re-extract the bibliography from the full paper text when the initial
// extraction returned too few entries (the upload-time AI metadata caps at ~10).
async function extractAllReferences(paperText: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  // Find the references section heuristically and send only its tail to keep
  // the prompt cheap.
  const lower = paperText.toLowerCase();
  const refIdx = Math.max(
    lower.lastIndexOf("\nreferences"),
    lower.lastIndexOf("\nbibliography"),
  );
  const tail = refIdx > 0 ? paperText.slice(refIdx) : paperText.slice(-30000);
  const truncated = tail.slice(0, 40000);

  const prompt = `Extract every reference list entry from the bibliography text below. Return a JSON object {"references": ["entry 1 verbatim", "entry 2 verbatim", ...]} preserving the original order. Treat each numbered or hanging-indent block as a separate entry. Do not invent or merge entries. Return JSON only.

BIBLIOGRAPHY TEXT:
${truncated}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = extractFinalText(response.content);
    const parsed = safeJsonParse<{ references?: unknown[] }>(raw);
    if (parsed && Array.isArray(parsed.references)) {
      return parsed.references
        .map((r) => (typeof r === "string" ? r.trim() : ""))
        .filter((r) => r.length > 10);
    }
  } catch (err) {
    console.warn("[extractAllReferences] failed:", err instanceof Error ? err.message : String(err));
  }
  return [];
}
