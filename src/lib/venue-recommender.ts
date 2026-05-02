import type { PaperRecord, VenueRecord } from "@/lib/review-types";

export interface VenueRecommendation {
  venue: VenueRecord;
  score: number;
  reasons: string[];
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with",
  "we", "our", "this", "that", "is", "are", "be", "by", "as", "at", "from",
  "it", "its", "use", "using", "based", "via", "approach", "method", "system",
  "paper", "study", "research", "results", "show", "shows", "propose", "proposed",
  "novel", "new", "data", "model", "models",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token)),
  );
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const item of a) if (b.has(item)) count++;
  return count;
}

export function recommendVenues(
  paper: PaperRecord,
  venues: VenueRecord[],
  limit = 5,
): VenueRecommendation[] {
  const paperTokens = tokenize(`${paper.title} ${paper.abstractText ?? ""}`);
  const now = Date.now();

  const scored = venues
    .map((venue) => {
      const reasons: string[] = [];
      let score = 0;

      if (paper.paperType && venue.paperTypes.includes(paper.paperType)) {
        score += 3;
        reasons.push(`Accepts ${paper.paperType} papers`);
      }

      const venueTokens = tokenize(
        `${venue.name} ${venue.track ?? ""} ${venue.fullName ?? ""}`,
      );
      const overlap = intersectionSize(paperTokens, venueTokens);
      if (overlap > 0) {
        score += Math.min(overlap, 3) * 2;
        reasons.push(`${overlap} keyword(s) overlap with venue topic`);
      }

      // Domain match: split on dashes (e.g. "software-engineering" -> ["software", "engineering"]).
      const domain = venue.domain ?? null;
      if (domain) {
        const domainTokens = tokenize(domain.replace(/-/g, " "));
        const domainOverlap = intersectionSize(paperTokens, domainTokens);
        if (domainOverlap > 0) {
          score += 1;
          reasons.push(`Matches venue domain: ${domain}`);
        }
      }

      // Acronym mention in the paper text is a strong signal.
      const acronym = venue.acronym ?? null;
      if (acronym && acronym.length >= 3) {
        const lc = acronym.toLowerCase();
        const titleLc = paper.title.toLowerCase();
        const abstractLc = (paper.abstractText ?? "").toLowerCase();
        if (titleLc.includes(lc) || abstractLc.includes(lc)) {
          score += 2;
          reasons.push(`Paper mentions ${acronym}`);
        }
      }

      if (venue.submissionDeadline) {
        const deadline = new Date(venue.submissionDeadline).getTime();
        if (!Number.isNaN(deadline) && deadline > now) {
          score += 1;
          reasons.push(`Submission window open (deadline ${venue.submissionDeadline.slice(0, 10)})`);
        }
      }

      return { venue, score, reasons };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}
