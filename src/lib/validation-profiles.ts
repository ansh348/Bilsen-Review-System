import type { PaperType } from "@/lib/review-types";

export interface ValidationProfile {
  paperType: PaperType;
  track?: string | null;
  extraRequiredSections: string[];
  checklistKeywords: Array<{ phrase: string; description: string }>;
}

const PROFILES: ValidationProfile[] = [
  {
    paperType: "RESEARCH",
    extraRequiredSections: ["Threats to Validity"],
    checklistKeywords: [
      { phrase: "evaluation", description: "Empirical evaluation discussed" },
      { phrase: "baseline", description: "Comparison to baseline(s)" },
    ],
  },
  {
    paperType: "SURVEY",
    extraRequiredSections: ["Inclusion Criteria", "Search Strategy"],
    checklistKeywords: [
      { phrase: "inclusion criteria", description: "Inclusion criteria defined" },
      { phrase: "exclusion criteria", description: "Exclusion criteria defined" },
      { phrase: "search strategy", description: "Search strategy described" },
    ],
  },
  {
    paperType: "TOOL",
    extraRequiredSections: ["Availability"],
    checklistKeywords: [
      { phrase: "license", description: "License information provided" },
      { phrase: "repository", description: "Source repository referenced" },
      { phrase: "installation", description: "Installation/usage described" },
    ],
  },
  {
    paperType: "EXPERIENCE_REPORT",
    extraRequiredSections: ["Lessons Learned"],
    checklistKeywords: [
      { phrase: "lessons learned", description: "Lessons learned section" },
      { phrase: "context", description: "Project/organization context" },
    ],
  },
  {
    paperType: "OTHER",
    extraRequiredSections: [],
    checklistKeywords: [],
  },
];

export function getValidationProfile(
  paperType: PaperType | null,
  track: string | null,
): ValidationProfile | null {
  if (!paperType) return null;

  const trackMatch = PROFILES.find(
    (profile) =>
      profile.paperType === paperType &&
      profile.track !== undefined &&
      profile.track !== null &&
      track !== null &&
      profile.track.toLowerCase() === track.toLowerCase(),
  );
  if (trackMatch) return trackMatch;

  const baseMatch = PROFILES.find(
    (profile) => profile.paperType === paperType && (profile.track === undefined || profile.track === null),
  );
  return baseMatch ?? null;
}

const ORG_GITHUB_ALLOWLIST = new Set([
  "anthropic",
  "openai",
  "microsoft",
  "google",
  "facebook",
  "meta",
  "apache",
  "kubernetes",
  "tensorflow",
  "pytorch",
  "huggingface",
  "vercel",
]);

interface SuspectLink {
  url: string;
  reason: string;
}

export function findIdentityRevealingLinks(text: string): SuspectLink[] {
  const found: SuspectLink[] = [];
  const seen = new Set<string>();

  function add(url: string, reason: string) {
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ url, reason });
  }

  const githubRegex = /https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)(?:\/([a-zA-Z0-9_.-]+))?/gi;
  for (const match of text.matchAll(githubRegex)) {
    const owner = match[1].toLowerCase();
    if (ORG_GITHUB_ALLOWLIST.has(owner)) continue;
    add(match[0], `GitHub user/repo path may reveal author (${owner})`);
  }

  const gitlabRegex = /https?:\/\/gitlab\.com\/([a-zA-Z0-9_.-]+)/gi;
  for (const match of text.matchAll(gitlabRegex)) {
    add(match[0], `GitLab path may reveal author (${match[1]})`);
  }

  const bitbucketRegex = /https?:\/\/bitbucket\.org\/([a-zA-Z0-9_.-]+)/gi;
  for (const match of text.matchAll(bitbucketRegex)) {
    add(match[0], `Bitbucket path may reveal author (${match[1]})`);
  }

  const tildeRegex = /https?:\/\/[^\s)]+\/~[a-zA-Z0-9_.-]+/gi;
  for (const match of text.matchAll(tildeRegex)) {
    add(match[0], "Personal homepage pattern (/~user)");
  }

  const labPageRegex = /https?:\/\/[a-zA-Z0-9.-]+\.(?:edu|ac\.[a-z]{2})\/[a-zA-Z0-9/_.-]+/gi;
  for (const match of text.matchAll(labPageRegex)) {
    add(match[0], "Academic institution URL");
  }

  return found;
}
