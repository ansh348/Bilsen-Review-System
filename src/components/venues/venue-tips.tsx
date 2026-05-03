import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VenueRecord } from "@/lib/review-types";

export type VenueTipSeverity = "critical" | "warn" | "info";

export interface VenueTip {
  severity: VenueTipSeverity;
  label: string;
  text: string;
}

const SEVERITY_ORDER: Record<VenueTipSeverity, number> = {
  critical: 0,
  warn: 1,
  info: 2,
};

export function buildVenueTips(venue: VenueRecord): VenueTip[] {
  const tips: VenueTip[] = [];
  const review = venue.reviewPolicy ?? null;
  const authorship = venue.authorshipPolicy ?? null;
  const sr = venue.specialRequirements ?? null;

  const isDoubleBlind =
    review?.blindness === "double-blind" || venue.anonymityRequired === true;

  if (isDoubleBlind) {
    tips.push({
      severity: "critical",
      label: "Anonymity",
      text: "Double-blind review — strip PDF metadata, anonymize tool/repo links, and refer to your prior work in the third person.",
    });
  } else if (review?.clearPdfMetadata === true) {
    tips.push({
      severity: "warn",
      label: "PDF metadata",
      text: "Clear all PDF metadata before submitting.",
    });
  }

  if (review?.arxivDuringReview) {
    tips.push({
      severity: "warn",
      label: "arXiv",
      text: `arXiv during review: ${review.arxivDuringReview}`,
    });
  }

  if (review?.acknowledgmentsAllowed === false) {
    tips.push({
      severity: "warn",
      label: "Acknowledgments",
      text: "Acknowledgments must be removed from the submission version.",
    });
  }

  if (
    authorship?.aiUseDisclosureRequired === true ||
    sr?.mandatoryGenAIDisclosure === true
  ) {
    tips.push({
      severity: "warn",
      label: "AI disclosure",
      text: "GenAI/LLM use must be disclosed at submission.",
    });
  }

  if (authorship?.overlapPolicy) {
    tips.push({
      severity: "warn",
      label: "Concurrent submission",
      text: authorship.overlapPolicy,
    });
  }

  if (authorship?.rebuttalPhase === true) {
    tips.push({
      severity: "info",
      label: "Rebuttal",
      text: "A rebuttal phase is available — reserve time to respond to reviewer questions.",
    });
  }

  if (authorship?.decisionTypes?.includes("Major Revision")) {
    tips.push({
      severity: "info",
      label: "Decisions",
      text: "Outcomes include Major Revision — your paper may receive a revision invitation rather than a binary accept/reject.",
    });
  }

  if (
    venue.referencesCountTowardLimit === false &&
    venue.extraRefPages != null &&
    venue.pageLimit != null
  ) {
    tips.push({
      severity: "info",
      label: "Page limit",
      text: `${venue.pageLimit}-page body + up to ${venue.extraRefPages} extra reference pages — references don't count against the body.`,
    });
  }

  if (
    venue.cameraReadyPageLimit != null &&
    venue.pageLimit != null &&
    venue.cameraReadyPageLimit !== venue.pageLimit
  ) {
    tips.push({
      severity: "info",
      label: "Camera ready",
      text: `Camera-ready expands to ${venue.cameraReadyPageLimit} pages (vs. ${venue.pageLimit} at submission).`,
    });
  }

  for (const sec of venue.specialRequiredSections ?? []) {
    if (sec.deskRejectIfMissing) {
      const placement = sec.placement ? ` (${sec.placement})` : "";
      tips.push({
        severity: "critical",
        label: sec.name,
        text: `Mandatory ${sec.name}${placement} — missing this is a desk-reject.`,
      });
    }
  }

  if (sr?.artifactEvaluation === true) {
    tips.push({
      severity: "info",
      label: "Artifacts",
      text: "Artifact evaluation track is available — consider preparing a reproducibility package.",
    });
  }

  if (sr?.reproducibilityChecklist === true) {
    tips.push({
      severity: "warn",
      label: "Reproducibility",
      text: "A reproducibility checklist is required at submission.",
    });
  }

  if (
    sr?.mandatoryStructuredAbstract === true ||
    venue.abstractStructuredRequired === true
  ) {
    tips.push({
      severity: "warn",
      label: "Structured abstract",
      text: "A structured abstract is required.",
    });
  }

  if (sr?.mandatoryDataAvailability === true) {
    tips.push({
      severity: "warn",
      label: "Data availability",
      text: "A Data Availability statement is required.",
    });
  }

  if (sr?.mandatoryLimitationsSection === true) {
    tips.push({
      severity: "warn",
      label: "Limitations",
      text: "A Limitations section is required.",
    });
  }

  if (sr?.mandatoryBroaderImpact === true) {
    tips.push({
      severity: "warn",
      label: "Broader impact",
      text: "A Broader Impact statement is required.",
    });
  }

  const seen = new Set<string>();
  const deduped = tips.filter((tip) => {
    if (seen.has(tip.text)) return false;
    seen.add(tip.text);
    return true;
  });

  deduped.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  if (deduped.length === 0) {
    return [
      {
        severity: "info",
        label: "General",
        text: "Always confirm the latest requirements on the official call for papers before submitting.",
      },
    ];
  }

  return deduped;
}

function severityBadgeProps(severity: VenueTipSeverity): {
  variant: "destructive" | "outline";
  className?: string;
  label: string;
} {
  switch (severity) {
    case "critical":
      return { variant: "destructive", label: "Critical" };
    case "warn":
      return {
        variant: "outline",
        className: "border-amber-500/40 bg-amber-500/10 text-amber-500",
        label: "Heads up",
      };
    case "info":
      return { variant: "outline", label: "Info" };
  }
}

export function VenueTips({ venue }: { venue: VenueRecord }) {
  const tips = buildVenueTips(venue);

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="text-base">Things to keep in mind</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {tips.map((tip) => {
            const badge = severityBadgeProps(tip.severity);
            return (
              <li
                key={`${tip.label}-${tip.text}`}
                className="flex items-start gap-3 text-sm"
              >
                <Badge
                  variant={badge.variant}
                  className={`shrink-0 text-[10px] ${badge.className ?? ""}`.trim()}
                >
                  {badge.label}
                </Badge>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{tip.label}</p>
                  <p className="text-muted-foreground">{tip.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
