#!/usr/bin/env node
/**
 * One-time migration: merge venues/venues_comprehensive.json into data/venues.json.
 *
 * - Each comprehensive venue x track expands into one VenueRecord row (matches
 *   the existing flat schema used everywhere in the app).
 * - Existing IDs are preserved when (a) the row is referenced by a paper, or
 *   (b) the (name, track) pair already exists in data/venues.json.
 * - Existing-only venues (CVPR, OSDI, CCS, etc.) pass through unchanged.
 *
 * Run with: node scripts/migrate-venues.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const COMPREHENSIVE_PATH = path.join(ROOT, "venues", "venues_comprehensive.json");
const VENUES_PATH = path.join(ROOT, "data", "venues.json");
const PAPERS_PATH = path.join(ROOT, "data", "papers.json");
const STAMP = "2026-05-02T00:00:00.000Z";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Map a comprehensive track name to a friendly track string. Tries to align
// with the existing data/venues.json track wording so the recommender keeps
// scoring consistently.
function friendlyTrackName(rawTrack) {
  const t = rawTrack.toLowerCase();
  if (t === "research" || t === "research papers" || t === "research track") return "Research Track";
  if (t === "industry" || t === "seip" || t === "industry track") return "Industry Track";
  if (t === "tools" || t === "tool demonstrations" || t === "demonstrations") return "Tool Demonstrations";
  if (t === "nier" || t === "new ideas") return "New Ideas Track";
  if (t === "regular paper" || t === "regular") return "Regular Paper";
  if (t === "main conference" || t === "main") return "Main Conference";
  if (t === "main technical track") return "Main Technical Track";
  if (t === "technical papers") return "Technical Papers";
  if (t === "main track") return "Main Track";
  if (t === "full papers") return "Full Papers";
  if (t === "papers") return "Papers";
  // Title case fallback.
  return rawTrack
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Map a comprehensive venue display name from acronym, with a few overrides
// to keep parity with the existing data/venues.json.
function venueDisplayName(acronym) {
  if (acronym === "TheWebConf") return "WWW 2026";
  return `${acronym} 2026`;
}

// Additional legacy display names (in data/venues.json) that should be
// treated as the same venue as a comprehensive entry. Used so we don't end
// up with both "FSE 2026" and "ESEC/FSE 2026" in the picker.
const VENUE_NAME_ALIASES = {
  FSE: ["ESEC/FSE 2026"],
};

// Infer the existing-schema paperTypes array for a given track + domain.
function inferPaperTypes(rawTrack) {
  const t = rawTrack.toLowerCase();
  if (t.includes("industry") || t.includes("experience") || t.includes("seip")) {
    return ["RESEARCH", "EXPERIENCE_REPORT"];
  }
  if (t.includes("tool") || t.includes("demo")) {
    return ["TOOL"];
  }
  if (t.includes("survey") || t.includes("systematic")) {
    return ["SURVEY"];
  }
  // Default: research.
  return ["RESEARCH"];
}

function coerceReferenceFormatStyle(style) {
  if (!style) return null;
  const lower = style.toLowerCase();
  if (lower.includes("acm")) return "ACM";
  if (lower.includes("ieee")) return "IEEE";
  return style;
}

function pickIsoDeadline(dates) {
  if (!dates) return null;
  const candidate = dates.fullPaperDeadline || dates.cycle2Deadline;
  if (!candidate) return null;
  // If it parses as ISO, return as-is. Otherwise return null.
  const t = Date.parse(candidate);
  if (Number.isNaN(t)) return null;
  return candidate;
}

function loadCollections() {
  const compFile = readJson(COMPREHENSIVE_PATH);
  const comprehensive = compFile.venues ?? compFile;
  const existing = readJson(VENUES_PATH);
  let papers = [];
  try {
    papers = readJson(PAPERS_PATH);
  } catch {
    papers = [];
  }
  return { comprehensive, existing, papers };
}

function build() {
  const { comprehensive, existing: rawExisting, papers } = loadCollections();

  // Make the script idempotent: rows that already carry `acronym` are output
  // from a previous run of this same migration. Treat only the un-enriched
  // legacy rows as the "existing baseline" so re-running doesn't compound.
  const existing = rawExisting.filter((v) => v.acronym === undefined);

  const inUseVenueIds = new Set(
    papers
      .flatMap((p) => [p.venueId, p.submittedVenueId])
      .filter(Boolean),
  );

  // (lowercase name, lowercase track) -> existing record
  const existingByKey = new Map();
  // (lowercase name) -> existing rows for that venue
  const existingByName = new Map();
  for (const v of existing) {
    const key = `${v.name.toLowerCase()}|${(v.track ?? "").toLowerCase()}`;
    existingByKey.set(key, v);
    const nameKey = v.name.toLowerCase();
    if (!existingByName.has(nameKey)) existingByName.set(nameKey, []);
    existingByName.get(nameKey).push(v);
  }

  // Track which existing rows we end up reusing or replacing — anything left
  // over (CVPR, OSDI, etc.) is passed through untouched at the end.
  const consumedExistingIds = new Set();
  const out = [];

  let added = 0;
  let preservedId = 0;

  for (const venue of comprehensive) {
    const { acronym, fullName, type, domain, publisher, coreRanking, edition, template } = venue;
    if (!Array.isArray(venue.tracks) || venue.tracks.length === 0) continue;

    const displayName = venueDisplayName(acronym);
    const blindness = venue.reviewPolicy?.blindness ?? null;
    const anonymityRequired = blindness === "double-blind";
    const referenceFormatDetails = venue.referenceFormat
      ? {
          style: venue.referenceFormat.style ?? null,
          type: venue.referenceFormat.type ?? null,
          notes: venue.referenceFormat.notes ?? null,
        }
      : null;
    const referenceFormat = coerceReferenceFormatStyle(referenceFormatDetails?.style);

    // Pre-compute which existing rows for this venue (by name) are in-use by
    // a paper — those IDs MUST roll forward to keep paper references valid.
    // We attach them to the first comprehensive track that doesn't already
    // have an exact (name, track) match.
    const aliasNames = [
      displayName.toLowerCase(),
      ...(VENUE_NAME_ALIASES[acronym] ?? []).map((s) => s.toLowerCase()),
    ];
    const sameNameExisting = aliasNames.flatMap(
      (n) => existingByName.get(n) ?? [],
    );
    const friendlyTrackSet = new Set(
      venue.tracks.map((t) => friendlyTrackName(t.name, acronym).toLowerCase()),
    );
    // Skip in-use rows whose track will be matched exactly by a comprehensive
    // track — those IDs are picked up via exactMatch, not adopted preemptively.
    const inUseExistingForName = sameNameExisting.filter(
      (v) =>
        inUseVenueIds.has(v.id) &&
        !friendlyTrackSet.has((v.track ?? "").toLowerCase()),
    );
    let inUseQueue = inUseExistingForName.slice();

    for (let trackIdx = 0; trackIdx < venue.tracks.length; trackIdx++) {
      const track = venue.tracks[trackIdx];
      const friendly = friendlyTrackName(track.name, acronym);
      const key = `${displayName.toLowerCase()}|${friendly.toLowerCase()}`;
      const candidate = existingByKey.get(key) ?? null;
      const exactMatch =
        candidate && !consumedExistingIds.has(candidate.id) ? candidate : null;

      let id;
      let createdAt;
      if (exactMatch) {
        consumedExistingIds.add(exactMatch.id);
        // Drop from inUseQueue if it was there.
        inUseQueue = inUseQueue.filter((v) => v.id !== exactMatch.id);
        id = exactMatch.id;
        createdAt = exactMatch.createdAt;
        if (inUseVenueIds.has(exactMatch.id)) preservedId += 1;
      } else if (inUseQueue.length > 0) {
        // Adopt an in-use existing row's ID for this track so paper references
        // stay valid. The track name silently shifts to the comprehensive
        // value — that's fine since the ID is what matters.
        const adopt = inUseQueue.shift();
        consumedExistingIds.add(adopt.id);
        id = adopt.id;
        createdAt = adopt.createdAt;
        preservedId += 1;
      } else {
        id = `venue-${slug(acronym)}-2026-${slug(friendly)}`;
        createdAt = STAMP;
        added += 1;
        // Consume any non-in-use existing row with the same name+track to
        // avoid pass-through duplicates of overlapping venues.
        const sameKey = sameNameExisting.find(
          (v) =>
            (v.track ?? "").toLowerCase() === friendly.toLowerCase() &&
            !consumedExistingIds.has(v.id),
        );
        if (sameKey) consumedExistingIds.add(sameKey.id);
      }

      // After the FIRST track iteration, consume any other same-name existing
      // rows that aren't in-use (e.g., legacy "Main Conference" placeholder
      // for NeurIPS once the in-use row has been adopted) so they don't pass
      // through as duplicates.
      if (trackIdx === 0) {
        for (const v of sameNameExisting) {
          if (!inUseVenueIds.has(v.id)) {
            consumedExistingIds.add(v.id);
          }
        }
      }

      const requiredSections = Array.isArray(venue.requiredSections)
        ? venue.requiredSections.slice()
        : [];

      const specialRequiredSections = Array.isArray(venue.specialRequiredSections)
        ? venue.specialRequiredSections.map((s) => ({
            name: s.name,
            placement: s.placement ?? null,
            countsTowardLimit: s.countsTowardLimit ?? null,
            deskRejectIfMissing: s.deskRejectIfMissing ?? null,
          }))
        : [];

      const conventionalSections = Array.isArray(venue.conventionalSections)
        ? venue.conventionalSections.slice()
        : [];

      const row = {
        id,
        name: displayName,
        track: friendly,
        pageLimit: track.pageLimit ?? null,
        abstractWordLimit: venue.abstract?.wordLimit ?? null,
        requiredSections,
        referenceFormat,
        anonymityRequired,
        submissionDeadline: pickIsoDeadline(venue.dates),
        paperTypes: inferPaperTypes(track.name, domain),
        createdAt,
        updatedAt: STAMP,

        // Rich, optional fields
        acronym: acronym ?? null,
        fullName: fullName ?? null,
        type: type ?? null,
        domain: domain ?? null,
        publisher: publisher ?? null,
        coreRanking: coreRanking ?? null,
        edition: edition ?? null,
        template: template ?? null,

        referencesCountTowardLimit: track.referencesCountTowardLimit ?? null,
        extraRefPages: track.extraRefPages ?? null,
        appendixCountsTowardLimit: track.appendixCountsTowardLimit ?? null,
        cameraReadyPageLimit: track.cameraReadyPageLimit ?? null,

        conventionalSections,
        specialRequiredSections,

        deskRejectCriteria: Array.isArray(venue.deskRejectCriteria)
          ? venue.deskRejectCriteria.slice()
          : [],

        abstractStructuredRequired: venue.abstract?.structuredRequired ?? null,
        abstractRegistrationRequired: venue.abstract?.abstractRegistrationRequired ?? null,
        referenceFormatDetails,

        reviewPolicy: venue.reviewPolicy ?? null,
        authorshipPolicy: venue.authorshipPolicy ?? null,
        dates: venue.dates ?? null,
        supplementaryPolicy: venue.supplementaryPolicy ?? null,
        specialRequirements: venue.specialRequirements ?? null,
      };

      out.push(row);
    }
  }

  // Pass through any existing rows that weren't covered by the comprehensive
  // file (CVPR, ECCV, ICCV, CCS, USENIX Security, OSDI, SOSP, CHI, SIGMOD, VLDB).
  let passedThrough = 0;
  for (const v of existing) {
    if (!consumedExistingIds.has(v.id)) {
      out.push(v);
      passedThrough += 1;
    }
  }

  // Sort: comprehensive-derived first (grouped by acronym, alpha), then
  // pass-through legacy rows. Within an acronym, keep order (tracks already
  // came in CFP order from the comprehensive file).
  // For stable diff, only sort the legacy block alphabetically by name.
  const richRows = out.filter((r) => r.acronym);
  const legacyRows = out
    .filter((r) => !r.acronym)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows: [...richRows, ...legacyRows],
    summary: { added, preservedId, passedThrough, total: out.length },
  };
}

function main() {
  const { rows, summary } = build();
  writeJson(VENUES_PATH, rows);
  console.log(`[migrate-venues] wrote ${rows.length} venues to ${path.relative(ROOT, VENUES_PATH)}`);
  console.log(
    `  - ${summary.added} new rows`,
    `\n  - ${summary.preservedId} existing IDs preserved (referenced by papers)`,
    `\n  - ${summary.passedThrough} legacy rows passed through unchanged`,
  );
}

main();
