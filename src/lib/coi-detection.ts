import type { PaperRecord, UserRecord } from "@/lib/review-types";

export type ConflictReason =
  | "SELF_AUTHOR"
  | "LISTED_IN_PDF"
  | "SHARED_AFFILIATION";

export interface ConflictResult {
  reason: ConflictReason;
  detail: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(reviewerName: string, extractedName: string): boolean {
  const r = normalize(reviewerName);
  const e = normalize(extractedName);
  if (!r || !e) return false;
  if (r === e) return true;
  const rTokens = r.split(" ").filter((t) => t.length >= 2);
  const eTokens = e.split(" ").filter((t) => t.length >= 2);
  if (rTokens.length === 0 || eTokens.length === 0) return false;
  const rSet = new Set(rTokens);
  const eSet = new Set(eTokens);
  let overlap = 0;
  for (const token of rSet) {
    if (eSet.has(token)) overlap += 1;
  }
  // Require at least two matching tokens (so initials or single common
  // surnames don't trigger), or full containment of the shorter name.
  if (overlap >= 2) return true;
  return r.includes(e) || e.includes(r);
}

function affiliationMatches(reviewerAffil: string, extractedAffil: string): boolean {
  const r = normalize(reviewerAffil);
  const e = normalize(extractedAffil);
  if (!r || !e) return false;
  if (r.length < 4 || e.length < 4) return false;
  return r.includes(e) || e.includes(r);
}

export function detectConflicts(
  paper: PaperRecord,
  reviewer: UserRecord
): ConflictResult[] {
  const conflicts: ConflictResult[] = [];

  if (paper.authorIds.includes(reviewer.id)) {
    conflicts.push({
      reason: "SELF_AUTHOR",
      detail: "Reviewer is a registered author of this paper.",
    });
  }

  const extractedAuthors = paper.extractedAuthors ?? [];
  for (const extracted of extractedAuthors) {
    if (typeof extracted !== "string") continue;
    if (nameMatches(reviewer.name, extracted)) {
      conflicts.push({
        reason: "LISTED_IN_PDF",
        detail: `Reviewer name matches an author listed in the PDF: "${extracted}".`,
      });
      break;
    }
  }

  const reviewerAffil = reviewer.affiliation?.trim();
  if (reviewerAffil) {
    const extractedAffils = paper.extractedAffiliations ?? [];
    for (const extracted of extractedAffils) {
      if (typeof extracted !== "string") continue;
      if (affiliationMatches(reviewerAffil, extracted)) {
        conflicts.push({
          reason: "SHARED_AFFILIATION",
          detail: `Reviewer affiliation overlaps with paper affiliation: "${extracted}".`,
        });
        break;
      }
    }
  }

  return conflicts;
}

export function summarizeConflicts(conflicts: ConflictResult[]): string {
  if (conflicts.length === 0) return "";
  return conflicts.map((c) => c.detail).join(" ");
}
