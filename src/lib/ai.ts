import Anthropic from "@anthropic-ai/sdk";

const MAX_TEXT_LENGTH = 15000;

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH) + "\n[...truncated]";
}

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function generateReviewWithClaude(extractedText: string) {
  const client = getClient();
  const truncated = truncateText(extractedText);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an expert academic paper reviewer. Analyze the following paper text and produce a structured review as JSON with exactly these fields:
- "summary": a 2-3 sentence summary of the paper
- "strengths": an array of 3-5 strength strings
- "concerns": an array of 3-5 concern strings
- "recommendation": one of "ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", or "REJECT"

Respond with ONLY valid JSON, no markdown fences or extra text.

Paper text:
${truncated}`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    return JSON.parse(cleaned) as {
      summary: string;
      strengths: string[];
      concerns: string[];
      recommendation: string;
    };
  } catch {
    return {
      summary: raw.slice(0, 500),
      strengths: ["AI review generated but response was not structured JSON."],
      concerns: ["Please re-run or review manually."],
      recommendation: "MINOR_REVISION",
    };
  }
}

export async function generateSuggestionsWithClaude(extractedText: string) {
  const client = getClient();
  const truncated = truncateText(extractedText);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
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

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as string[];
    return ["AI suggestions generated but response format was unexpected."];
  } catch {
    return ["AI suggestions generated but could not be parsed. Please retry."];
  }
}
