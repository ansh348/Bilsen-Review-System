"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  SpecialRequiredSection,
  VenueAuthorshipPolicy,
  VenueDates,
  VenueReferenceFormatDetails,
  VenueReviewPolicy,
  VenueSpecialRequirements,
  VenueSupplementaryPolicy,
} from "@/lib/review-types";

export interface VenueRequirements {
  track?: string | null;
  pageLimit?: number | null;
  abstractWordLimit?: number | null;
  requiredSections?: string[];
  referenceFormat?: string | null;
  anonymityRequired?: boolean;
  submissionDeadline?: string | null;
  acronym?: string | null;
  fullName?: string | null;
  domain?: string | null;
  publisher?: string | null;
  coreRanking?: string | null;
  edition?: string | null;
  template?: string | null;
  referencesCountTowardLimit?: boolean | null;
  extraRefPages?: number | null;
  appendixCountsTowardLimit?: boolean | null;
  abstractStructuredRequired?: boolean | null;
  conventionalSections?: string[];
  specialRequiredSections?: SpecialRequiredSection[];
  deskRejectCriteria?: string[];
  reviewPolicy?: VenueReviewPolicy | null;
  authorshipPolicy?: VenueAuthorshipPolicy | null;
  dates?: VenueDates | null;
  supplementaryPolicy?: VenueSupplementaryPolicy | null;
  specialRequirements?: VenueSpecialRequirements | null;
  referenceFormatDetails?: VenueReferenceFormatDetails | null;
}

interface Props {
  venue: VenueRequirements & { name: string };
  defaultOpen?: boolean;
}

const AUTO_CHECKED_KEYWORDS = [
  "page limit",
  "page-limit",
  "page count",
  "non-compliant page",
  "non-anonymous",
  "anonymous",
  "blind",
];

function isAutoChecked(criterion: string): boolean {
  const lc = criterion.toLowerCase();
  return AUTO_CHECKED_KEYWORDS.some((k) => lc.includes(k));
}

function formatPageLimit(v: VenueRequirements): string | null {
  if (v.pageLimit == null) return null;
  if (v.referencesCountTowardLimit === false && v.extraRefPages != null) {
    return `${v.pageLimit} pages + ${v.extraRefPages} reference pages (references don't count)`;
  }
  if (v.referencesCountTowardLimit === false) {
    return `${v.pageLimit} pages (references don't count toward limit)`;
  }
  return `${v.pageLimit} pages`;
}

export function VenueRequirementsPanel({ venue, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const pageLimitText = formatPageLimit(venue);
  const blindness = venue.reviewPolicy?.blindness ?? null;
  const arxiv = venue.reviewPolicy?.arxivDuringReview ?? null;
  const aiDisclosure = venue.authorshipPolicy?.aiUseDisclosureRequired ?? null;
  const sr = venue.specialRequirements ?? null;
  const dates = venue.dates ?? null;

  const hasRichData =
    pageLimitText !== null ||
    venue.abstractWordLimit != null ||
    (venue.requiredSections?.length ?? 0) > 0 ||
    (venue.specialRequiredSections?.length ?? 0) > 0 ||
    (venue.conventionalSections?.length ?? 0) > 0 ||
    (venue.deskRejectCriteria?.length ?? 0) > 0 ||
    venue.template != null ||
    venue.referenceFormat != null ||
    blindness != null ||
    dates != null ||
    sr != null;

  if (!hasRichData) {
    return (
      <div className="rounded-lg border border-border/60 bg-input/20 p-3 text-xs text-muted-foreground">
        No detailed submission requirements on file for {venue.name}. Check the
        official call for papers before submitting.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-input/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">
            Submission requirements
            {venue.coreRanking ? (
              <Badge variant="outline" className="ml-2 align-middle text-xs">
                CORE {venue.coreRanking}
              </Badge>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {venue.fullName ?? venue.name}
            {venue.domain ? ` · ${venue.domain.replace(/-/g, " ")}` : ""}
            {venue.publisher ? ` · ${venue.publisher}` : ""}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/60 px-4 py-3 text-sm">
          {/* Limits */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Limits
            </h4>
            <ul className="space-y-1 text-sm">
              {pageLimitText && (
                <li>
                  <span className="text-muted-foreground">Page limit: </span>
                  {pageLimitText}
                  {venue.appendixCountsTowardLimit === true ? " (appendices count toward limit)" : ""}
                </li>
              )}
              {venue.abstractWordLimit != null && (
                <li>
                  <span className="text-muted-foreground">Abstract: </span>
                  {venue.abstractWordLimit} words max
                  {venue.abstractStructuredRequired ? " · structured abstract required" : ""}
                </li>
              )}
              {venue.referenceFormat && (
                <li>
                  <span className="text-muted-foreground">Reference format: </span>
                  {venue.referenceFormat}
                  {venue.referenceFormatDetails?.type
                    ? ` (${venue.referenceFormatDetails.type})`
                    : ""}
                </li>
              )}
              {venue.template && (
                <li>
                  <span className="text-muted-foreground">Template: </span>
                  <span className="font-mono text-xs">{venue.template}</span>
                </li>
              )}
            </ul>
          </section>

          {/* Sections */}
          {((venue.requiredSections?.length ?? 0) > 0 ||
            (venue.specialRequiredSections?.length ?? 0) > 0 ||
            (venue.conventionalSections?.length ?? 0) > 0) && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Required sections
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(venue.requiredSections ?? []).map((s) => (
                  <Badge key={`req-${s}`} variant="default" className="text-xs">
                    {s}
                  </Badge>
                ))}
                {(venue.specialRequiredSections ?? []).map((s) => (
                  <Badge
                    key={`sp-${s.name}`}
                    variant={s.deskRejectIfMissing !== false ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {s.name}
                    {s.deskRejectIfMissing !== false ? " · desk-reject if missing" : ""}
                    {s.placement ? ` · ${s.placement}` : ""}
                  </Badge>
                ))}
                {(venue.conventionalSections ?? []).map((s) => (
                  <Badge key={`conv-${s}`} variant="outline" className="text-xs text-muted-foreground">
                    {s} (suggested)
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Desk-reject criteria */}
          {(venue.deskRejectCriteria?.length ?? 0) > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Desk-reject criteria
              </h4>
              <ul className="space-y-1.5">
                {venue.deskRejectCriteria!.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm">
                    <Badge
                      variant={isAutoChecked(c) ? "default" : "outline"}
                      className="shrink-0 text-[10px]"
                    >
                      {isAutoChecked(c) ? "auto-checked" : "manual"}
                    </Badge>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Anonymity / review policy */}
          {(blindness || arxiv) && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Review policy
              </h4>
              <ul className="space-y-1 text-sm">
                {blindness && (
                  <li>
                    <span className="text-muted-foreground">Blindness: </span>
                    {blindness}
                  </li>
                )}
                {arxiv && (
                  <li>
                    <span className="text-muted-foreground">arXiv during review: </span>
                    {arxiv}
                  </li>
                )}
              </ul>
            </section>
          )}

          {/* Special requirements */}
          {sr &&
            (sr.reproducibilityChecklist ||
              sr.artifactEvaluation ||
              sr.mandatoryGenAIDisclosure ||
              sr.mandatoryBroaderImpact ||
              sr.mandatoryDataAvailability ||
              sr.mandatoryStructuredAbstract ||
              sr.mandatoryLimitationsSection ||
              aiDisclosure) && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Special requirements
              </h4>
              <ul className="space-y-1 text-sm">
                {sr.reproducibilityChecklist && <li>• Reproducibility checklist required</li>}
                {sr.artifactEvaluation && <li>• Artifact evaluation track available</li>}
                {(sr.mandatoryGenAIDisclosure || aiDisclosure) && (
                  <li>• AI / GenAI use disclosure required</li>
                )}
                {sr.mandatoryBroaderImpact && <li>• Broader impact statement required</li>}
                {sr.mandatoryDataAvailability && <li>• Data availability statement required</li>}
                {sr.mandatoryStructuredAbstract && <li>• Structured abstract required</li>}
                {sr.mandatoryLimitationsSection && <li>• Limitations section required</li>}
              </ul>
            </section>
          )}

          {/* Deadlines */}
          {dates &&
            (dates.fullPaperDeadline ||
              dates.cycle2Deadline ||
              dates.notificationDate ||
              dates.conferenceDates ||
              dates.cameraReadyDeadline ||
              dates.notes) && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Key dates
              </h4>
              <ul className="space-y-1 text-sm">
                {dates.fullPaperDeadline && (
                  <li>
                    <span className="text-muted-foreground">Full paper deadline: </span>
                    {dates.fullPaperDeadline}
                  </li>
                )}
                {dates.cycle2Deadline && (
                  <li>
                    <span className="text-muted-foreground">Cycle 2 deadline: </span>
                    {dates.cycle2Deadline}
                  </li>
                )}
                {dates.notificationDate && (
                  <li>
                    <span className="text-muted-foreground">Notification: </span>
                    {dates.notificationDate}
                  </li>
                )}
                {dates.cameraReadyDeadline && (
                  <li>
                    <span className="text-muted-foreground">Camera ready: </span>
                    {dates.cameraReadyDeadline}
                  </li>
                )}
                {dates.conferenceDates && (
                  <li>
                    <span className="text-muted-foreground">Conference: </span>
                    {dates.conferenceDates}
                  </li>
                )}
                {dates.notes && (
                  <li className="text-xs text-muted-foreground">{dates.notes}</li>
                )}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
