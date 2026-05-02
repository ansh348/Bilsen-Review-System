import Anthropic from "@anthropic-ai/sdk";
import type { PaperRecord, VenueRecord } from "@/lib/review-types";

const MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 2000;
const ABSTRACT_CHAR_BUDGET = 3000;

export interface ReviewerCandidate {
  id: string;
  name: string;
  expertise: string[];
}

export interface ReviewerSuggestion {
  reviewerId: string;
  rank: number;
  rationale: string;
  matchedExpertise: string[];
}

export interface SuggestReviewersInput {
  paper: PaperRecord;
  venue: VenueRecord | null;
  candidates: ReviewerCandidate[];
  topN?: number;
}

export interface SuggestReviewersResult {
  suggestions: ReviewerSuggestion[];
  modelUsed: string;
  generatedAt: string;
  error?: string;
}

const SYSTEM_PROMPT = `You match academic papers to reviewers based on declared expertise.

Given a paper (title + abstract + venue domain) and a list of candidate reviewers (each with a list of self-declared expertise tags), rank the candidates by how well their expertise overlaps with the paper's topic and methods.

Calibration:
- Rank 1 is the best fit. Lower ranks should still be defensible matches; do NOT pad the list with weak matches.
- A reviewer with multiple directly-relevant tags outranks one with a single tangential tag.
- A reviewer with a tag matching the paper's core method or domain outranks one matching only adjacent areas.
- Prefer breadth-of-fit over a single strong keyword overlap when the paper spans multiple subfields.
- For each suggestion, the matchedExpertise list must contain only tags that came from the candidate's actual expertise tags.
- The rationale should be one sentence and reference the paper's content, not just the tags.

Return JSON only. Do not wrap in markdown.`;

function safeJsonParse<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
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

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function truncateAbstract(abstract: string | null): string {
  if (!abstract) return "(no abstract recorded)";
  if (abstract.length <= ABSTRACT_CHAR_BUDGET) return abstract;
  return abstract.slice(0, ABSTRACT_CHAR_BUDGET) + "\n[...truncated]";
}

export async function suggestReviewers(
  input: SuggestReviewersInput
): Promise<SuggestReviewersResult> {
  const generatedAt = new Date().toISOString();
  const topN = Math.min(Math.max(input.topN ?? 5, 1), 10);

  if (input.candidates.length === 0) {
    return {
      suggestions: [],
      modelUsed: MODEL,
      generatedAt,
      error: "no-candidates",
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      suggestions: [],
      modelUsed: MODEL,
      generatedAt,
      error: "no-api-key",
    };
  }

  const candidateIds = new Set(input.candidates.map((c) => c.id));
  const expertiseLookup = new Map(
    input.candidates.map((c) => [
      c.id,
      new Set(c.expertise.map((tag) => tag.toLowerCase())),
    ])
  );

  const candidatesJson = JSON.stringify(
    input.candidates.map((c) => ({
      id: c.id,
      name: c.name,
      expertise: c.expertise,
    })),
    null,
    2
  );

  const userPrompt = `PAPER:
- Title: ${input.paper.title}
- Paper type: ${input.paper.paperType ?? "unknown"}
- Venue: ${input.venue?.name ?? "unknown"}${input.venue?.domain ? ` (${input.venue.domain})` : ""}
- Abstract:
${truncateAbstract(input.paper.abstractText)}

CANDIDATE REVIEWERS (${input.candidates.length} total):
${candidatesJson}

Pick the top ${Math.min(topN, input.candidates.length)} reviewers whose expertise best matches this paper. Return JSON exactly matching this schema:

{
  "suggestions": [
    {
      "reviewerId": "<id from candidates>",
      "rank": 1,
      "rationale": "1 sentence linking the reviewer's expertise to the paper's topic.",
      "matchedExpertise": ["<tags that drove the match — must be from the candidate's tags>"]
    }
    // ... ranked from best fit (rank 1) downward, length <= ${Math.min(topN, input.candidates.length)}
  ]
}

Return JSON only.`;

  let raw = "";
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[suggestReviewers] API error:", message);
    return {
      suggestions: [],
      modelUsed: MODEL,
      generatedAt,
      error: message,
    };
  }

  const parsed = safeJsonParse<{
    suggestions?: Array<{
      reviewerId?: string;
      rank?: number;
      rationale?: string;
      matchedExpertise?: unknown;
    }>;
  }>(raw);

  if (!parsed || !Array.isArray(parsed.suggestions)) {
    return {
      suggestions: [],
      modelUsed: MODEL,
      generatedAt,
      error: "parse-error",
    };
  }

  const suggestions: ReviewerSuggestion[] = parsed.suggestions
    .map((s, idx) => {
      const reviewerId = String(s.reviewerId ?? "");
      if (!candidateIds.has(reviewerId)) return null;
      const reviewerExpertise = expertiseLookup.get(reviewerId) ?? new Set();
      const matched = Array.isArray(s.matchedExpertise)
        ? s.matchedExpertise
            .map((tag) => String(tag))
            .filter((tag) => reviewerExpertise.has(tag.toLowerCase()))
            .slice(0, 8)
        : [];
      return {
        reviewerId,
        rank: typeof s.rank === "number" && s.rank > 0 ? Math.floor(s.rank) : idx + 1,
        rationale: String(s.rationale ?? "").slice(0, 400),
        matchedExpertise: matched,
      };
    })
    .filter((s): s is ReviewerSuggestion => s !== null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, topN);

  return {
    suggestions,
    modelUsed: MODEL,
    generatedAt,
  };
}
