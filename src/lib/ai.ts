import Anthropic from "@anthropic-ai/sdk";

const MAX_TEXT_LENGTH = 15000;
const MAX_EXTRACTION_TEXT_LENGTH = 60000;
const MODEL = "claude-sonnet-4-5-20250929";

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH) + "\n[...truncated]";
}

// For metadata extraction we want a much wider view of the paper than for review:
// section headings live throughout, and references sit at the end. Send the head
// (covers abstract → most body sections) + the tail (covers references).
function truncateForExtraction(text: string): string {
  if (text.length <= MAX_EXTRACTION_TEXT_LENGTH) return text;
  const headBudget = Math.floor(MAX_EXTRACTION_TEXT_LENGTH * 0.75);
  const tailBudget = MAX_EXTRACTION_TEXT_LENGTH - headBudget - 32;
  return (
    text.slice(0, headBudget) +
    "\n\n[... middle of paper truncated ...]\n\n" +
    text.slice(text.length - tailBudget)
  );
}

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface GroundedClaim {
  point: string;
  quote: string;
  unsupported: boolean;
}

export interface GroundedReview {
  summary: string;
  strengths: GroundedClaim[];
  concerns: GroundedClaim[];
  recommendation: string;
  unsupportedCount: number;
}

function checkClaim(quote: string, sourceNorm: string): boolean {
  if (!quote) return true;
  const normalized = normalizeForMatch(quote);
  if (normalized.length < 8) return true;
  if (sourceNorm.includes(normalized)) return true;
  // fallback: at least 70% of words present in source
  const words = normalized.split(" ").filter((w) => w.length > 3);
  if (words.length === 0) return true;
  const hits = words.filter((w) => sourceNorm.includes(w)).length;
  return hits / words.length >= 0.7;
}

function coerceClaims(value: unknown): GroundedClaim[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { point: item, quote: "", unsupported: false };
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return {
          point: String(obj.point ?? obj.text ?? ""),
          quote: String(obj.quote ?? ""),
          unsupported: false,
        };
      }
      return null;
    })
    .filter((c): c is GroundedClaim => c !== null && c.point.length > 0);
}

export interface ExtractedPaperMetadata {
  title: string | null;
  abstract: string | null;
  authors: string[];
  affiliations: string[];
  sectionHeadings: string[];
  references: string[];
  suggestedPaperType: "RESEARCH" | "SURVEY" | "TOOL" | "EXPERIENCE_REPORT" | "OTHER" | null;
}

function emptyExtractedMetadata(): ExtractedPaperMetadata {
  return {
    title: null,
    abstract: null,
    authors: [],
    affiliations: [],
    sectionHeadings: [],
    references: [],
    suggestedPaperType: null,
  };
}

const PAPER_TYPES = ["RESEARCH", "SURVEY", "TOOL", "EXPERIENCE_REPORT", "OTHER"] as const;

function coerceStringArray(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((s) => s.length > 0)
    .slice(0, max);
}

export async function extractPaperMetadata(text: string): Promise<ExtractedPaperMetadata | null> {
  console.log("[extractPaperMetadata]", {
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
    textLen: text.length,
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  const client = getClient();
  const truncated = truncateForExtraction(text);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Extract structured metadata from this academic paper. Return ONLY valid JSON, no markdown fences or extra text, with exactly these fields:

- "title": the paper title, just the title text, no "Title:" prefix
- "abstract": the abstract, verbatim, no "Abstract:" prefix
- "authors": array of author full names (e.g. ["Jane Doe", "John Smith"])
- "affiliations": array of unique institutions/companies (e.g. ["MIT", "Microsoft Research"])
- "sectionHeadings": array of top-level section headings in order (e.g. ["Introduction", "Related Work", "Method", "Evaluation", "Conclusion"]). Top-level only — skip subsections.
- "references": array of the first ~10 reference list entries verbatim (one string per reference)
- "suggestedPaperType": one of "RESEARCH", "SURVEY", "TOOL", "EXPERIENCE_REPORT", "OTHER" — your best guess based on the abstract and structure

CRITICAL: All values must come from the paper text below. Do not invent. If a field cannot be found, use null for strings or an empty array for lists.

Paper text:
${truncated}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";

  let parsed: Record<string, unknown> = {};
  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return emptyExtractedMetadata();
  }

  const suggestedPaperTypeRaw =
    typeof parsed.suggestedPaperType === "string" ? parsed.suggestedPaperType.toUpperCase() : null;
  const suggestedPaperType = (PAPER_TYPES as readonly string[]).includes(suggestedPaperTypeRaw ?? "")
    ? (suggestedPaperTypeRaw as ExtractedPaperMetadata["suggestedPaperType"])
    : null;

  return {
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : null,
    abstract: typeof parsed.abstract === "string" && parsed.abstract.trim() ? parsed.abstract.trim() : null,
    authors: coerceStringArray(parsed.authors, 30),
    affiliations: coerceStringArray(parsed.affiliations, 30),
    sectionHeadings: coerceStringArray(parsed.sectionHeadings, 50),
    references: coerceStringArray(parsed.references, 30),
    suggestedPaperType,
  };
}

export async function generateReviewWithClaude(extractedText: string): Promise<GroundedReview> {
  const client = getClient();
  const truncated = truncateText(extractedText);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are an expert academic paper reviewer. Analyze the paper text and produce a structured review as JSON with exactly these fields:
- "summary": 2-3 sentence summary of the paper
- "strengths": array of 3-5 objects, each {"point": "...", "quote": "verbatim excerpt from the paper, max 200 chars, that supports this strength"}
- "concerns": array of 3-5 objects, each {"point": "...", "quote": "verbatim excerpt that the concern relates to, max 200 chars"}
- "recommendation": one of "ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"

CRITICAL: Every quote MUST be copied verbatim from the paper text below. Do not paraphrase. Do not invent quotes. If you cannot find a supporting quote, leave the quote field empty.

Respond with ONLY valid JSON, no markdown fences or extra text.

Paper text:
${truncated}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: Record<string, unknown> = {};
  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {
      summary: raw.slice(0, 500),
      strengths: [{ point: "AI review generated but response was not structured JSON.", quote: "", unsupported: false }],
      concerns: [{ point: "Please re-run or review manually.", quote: "", unsupported: false }],
      recommendation: "MINOR_REVISION",
      unsupportedCount: 0,
    };
  }

  const sourceNorm = normalizeForMatch(extractedText);
  const strengths = coerceClaims(parsed.strengths).map((c) => ({
    ...c,
    unsupported: !checkClaim(c.quote, sourceNorm),
  }));
  const concerns = coerceClaims(parsed.concerns).map((c) => ({
    ...c,
    unsupported: !checkClaim(c.quote, sourceNorm),
  }));
  const unsupportedCount =
    strengths.filter((c) => c.unsupported).length +
    concerns.filter((c) => c.unsupported).length;

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    strengths,
    concerns,
    recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "MINOR_REVISION",
    unsupportedCount,
  };
}

export async function generateSuggestionsWithClaude(extractedText: string) {
  const client = getClient();
  const truncated = truncateText(extractedText);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are an expert academic writing advisor. Read the following paper text and suggest improvements.

Respond with ONLY a valid JSON array of 3-6 suggestion strings. No markdown fences or extra text.

Paper text:
${truncated}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as string[];
    return ["AI suggestions generated but response format was unexpected."];
  } catch {
    return ["AI suggestions generated but could not be parsed. Please retry."];
  }
}

export interface FinalReportInput {
  paperTitle: string;
  abstractText: string | null;
  reviews: Array<{
    reviewerName: string;
    comments: string;
    recommendation: string | null;
    overallScore: number | null;
  }>;
}

export interface FinalReportOutput {
  consensusSummary: string;
  agreedStrengths: string[];
  agreedConcerns: string[];
  divergences: string[];
  overallRecommendation: string;
}

export async function generateFinalReportWithClaude(input: FinalReportInput): Promise<FinalReportOutput> {
  const client = getClient();
  const reviewsBlock = input.reviews
    .map((r, i) =>
      `--- Reviewer ${i + 1} (${r.reviewerName}) ---
Recommendation: ${r.recommendation ?? "N/A"}
Overall score: ${r.overallScore ?? "N/A"}
Comments:
${r.comments}`,
    )
    .join("\n\n");

  const prompt = `You are an editorial coordinator synthesizing reviewer feedback for a paper. Produce a JSON object with these fields:
- "consensusSummary": 3-5 sentence neutral synthesis of the reviewers' overall view of the paper
- "agreedStrengths": array of 3-6 strings — strengths multiple reviewers raised
- "agreedConcerns": array of 3-6 strings — concerns multiple reviewers raised
- "divergences": array of 0-5 strings — points where reviewers disagreed
- "overallRecommendation": one of "ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT" — the most justified group recommendation

Base every claim ONLY on the reviewer comments below. Do NOT invent issues that no reviewer mentioned. Respond with ONLY valid JSON.

Paper: ${input.paperTitle}
${input.abstractText ? `Abstract: ${truncateText(input.abstractText)}\n` : ""}

${reviewsBlock}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      consensusSummary: typeof parsed.consensusSummary === "string" ? parsed.consensusSummary : "",
      agreedStrengths: Array.isArray(parsed.agreedStrengths) ? parsed.agreedStrengths.map(String) : [],
      agreedConcerns: Array.isArray(parsed.agreedConcerns) ? parsed.agreedConcerns.map(String) : [],
      divergences: Array.isArray(parsed.divergences) ? parsed.divergences.map(String) : [],
      overallRecommendation:
        typeof parsed.overallRecommendation === "string" ? parsed.overallRecommendation : "MINOR_REVISION",
    };
  } catch {
    return {
      consensusSummary: raw.slice(0, 500),
      agreedStrengths: [],
      agreedConcerns: [],
      divergences: [],
      overallRecommendation: "MINOR_REVISION",
    };
  }
}
