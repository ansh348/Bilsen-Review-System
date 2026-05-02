"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface AiDimensionResult {
  dimension: string;
  verdict: "pass" | "fail" | "warning" | "manual" | "skipped";
  summary: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
}

interface AiComplianceDetailsProps {
  details: {
    message?: string;
    checks?: AiDimensionResult[];
    deskRejectRisk?: string;
    failedDimensions?: string[];
    warningDimensions?: string[];
    modelUsed?: string;
    paperTruncated?: boolean;
    generatedAt?: string;
    error?: string;
  };
}

const VERDICT_ORDER: Record<AiDimensionResult["verdict"], number> = {
  fail: 0,
  warning: 1,
  manual: 2,
  pass: 3,
  skipped: 4,
};

function verdictBadgeVariant(v: AiDimensionResult["verdict"]) {
  switch (v) {
    case "fail":
      return "destructive" as const;
    case "warning":
      return "secondary" as const;
    case "pass":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

function deskRejectBadgeVariant(risk?: string) {
  switch (risk) {
    case "high":
      return "destructive" as const;
    case "medium":
      return "secondary" as const;
    case "low":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

export function AiComplianceDetails({ details }: AiComplianceDetailsProps) {
  const checks = (details.checks ?? []).slice().sort(
    (a, b) =>
      (VERDICT_ORDER[a.verdict] ?? 99) - (VERDICT_ORDER[b.verdict] ?? 99) ||
      a.dimension.localeCompare(b.dimension),
  );

  if (details.error && checks.length === 0) {
    return (
      <p className="text-sm text-destructive">
        {details.message ?? `AI review failed: ${details.error}`}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {details.deskRejectRisk && (
          <Badge variant={deskRejectBadgeVariant(details.deskRejectRisk)}>
            Desk-reject risk: {details.deskRejectRisk}
          </Badge>
        )}
        {details.modelUsed && <span>Model: {details.modelUsed}</span>}
        {details.paperTruncated && (
          <span className="text-amber-600">
            Paper text truncated (very long manuscript) — head + tail evaluated.
          </span>
        )}
        {details.generatedAt && (
          <span>Generated: {details.generatedAt.slice(0, 19).replace("T", " ")}</span>
        )}
      </div>

      <ul className="space-y-2">
        {checks.map((c) => (
          <DimensionCard key={c.dimension} check={c} />
        ))}
      </ul>
    </div>
  );
}

function DimensionCard({ check }: { check: AiDimensionResult }) {
  const [open, setOpen] = useState(check.verdict === "fail" || check.verdict === "warning");
  const hasDetail =
    (check.evidence && check.evidence.length > 0) ||
    (check.recommendation && check.recommendation !== "No action needed.");

  return (
    <li className="rounded-md border border-border/60 bg-input/15">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
        disabled={!hasDetail}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{check.dimension}</span>
            <Badge variant={verdictBadgeVariant(check.verdict)} className="text-[10px]">
              {check.verdict}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(check.confidence * 100)}% confidence
            </span>
          </div>
          <p className="mt-1 text-sm">{check.summary}</p>
        </div>
        {hasDetail && (
          <span className="shrink-0 text-xs text-muted-foreground">{open ? "−" : "+"}</span>
        )}
      </button>

      {open && hasDetail && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2 text-sm">
          {check.evidence.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Evidence
              </p>
              <ul className="space-y-1">
                {check.evidence.map((e, i) => (
                  <li
                    key={i}
                    className="rounded border border-border/40 bg-input/30 px-2 py-1 font-mono text-xs"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {check.recommendation && check.recommendation !== "No action needed." && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recommendation
              </p>
              <p className="text-sm">{check.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ============================================================
// Reference verification details
// ============================================================

interface AiReferenceItem {
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

interface AiReferenceDetailsProps {
  details: {
    message?: string;
    summary?: {
      total?: number;
      likelyReal?: number;
      uncertain?: number;
      suspicious?: number;
      malformed?: number;
      overallAssessment?: string;
    };
    references?: AiReferenceItem[];
    modelUsed?: string;
    generatedAt?: string;
    error?: string;
  };
}

const STATUS_ORDER: Record<AiReferenceItem["status"], number> = {
  suspicious: 0,
  malformed: 1,
  uncertain: 2,
  likely_real: 3,
};

function statusBadgeVariant(s: AiReferenceItem["status"]) {
  switch (s) {
    case "suspicious":
      return "destructive" as const;
    case "malformed":
      return "secondary" as const;
    case "uncertain":
      return "outline" as const;
    case "likely_real":
      return "default" as const;
  }
}

export function AiReferenceDetails({ details }: AiReferenceDetailsProps) {
  const refs = (details.references ?? []).slice().sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
  );
  const summary = details.summary ?? {};

  if (details.error && refs.length === 0) {
    return (
      <p className="text-sm text-destructive">
        {details.message ?? `Reference verification failed: ${details.error}`}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{summary.total ?? 0} total</Badge>
        {(summary.suspicious ?? 0) > 0 && (
          <Badge variant="destructive">{summary.suspicious} suspicious</Badge>
        )}
        {(summary.malformed ?? 0) > 0 && (
          <Badge variant="secondary">{summary.malformed} malformed</Badge>
        )}
        {(summary.uncertain ?? 0) > 0 && (
          <Badge variant="outline">{summary.uncertain} uncertain</Badge>
        )}
        {(summary.likelyReal ?? 0) > 0 && (
          <Badge variant="default">{summary.likelyReal} likely real</Badge>
        )}
        {details.modelUsed && (
          <span className="text-muted-foreground">Model: {details.modelUsed}</span>
        )}
      </div>

      {summary.overallAssessment && (
        <p className="text-sm">{summary.overallAssessment}</p>
      )}

      <ul className="space-y-2">
        {refs.map((r) => (
          <ReferenceCard key={r.index} ref_={r} />
        ))}
      </ul>
    </div>
  );
}

function ReferenceCard({ ref_ }: { ref_: AiReferenceItem }) {
  const expandByDefault = ref_.status === "suspicious" || ref_.status === "malformed";
  const [open, setOpen] = useState(expandByDefault);
  const parsed = ref_.parsed;
  const hasParsed = parsed.title || (parsed.authors && parsed.authors.length > 0) || parsed.year;

  return (
    <li className="rounded-md border border-border/60 bg-input/15">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">[{ref_.index}]</span>
            <Badge variant={statusBadgeVariant(ref_.status)} className="text-[10px]">
              {ref_.status.replace("_", " ")}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(ref_.confidence * 100)}% confidence
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-xs">{ref_.raw}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2 text-sm">
          {hasParsed && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Parsed
              </p>
              <ul className="space-y-0.5 text-xs">
                {parsed.title && (
                  <li>
                    <span className="text-muted-foreground">Title: </span>
                    {parsed.title}
                  </li>
                )}
                {parsed.authors && parsed.authors.length > 0 && (
                  <li>
                    <span className="text-muted-foreground">Authors: </span>
                    {parsed.authors.join(", ")}
                  </li>
                )}
                {parsed.year && (
                  <li>
                    <span className="text-muted-foreground">Year: </span>
                    {parsed.year}
                  </li>
                )}
                {parsed.venue && (
                  <li>
                    <span className="text-muted-foreground">Venue: </span>
                    {parsed.venue}
                  </li>
                )}
                {parsed.type && (
                  <li>
                    <span className="text-muted-foreground">Type: </span>
                    {parsed.type}
                  </li>
                )}
                {parsed.doi && (
                  <li>
                    <span className="text-muted-foreground">DOI: </span>
                    <span className="font-mono">{parsed.doi}</span>
                  </li>
                )}
                {parsed.arxivId && (
                  <li>
                    <span className="text-muted-foreground">arXiv: </span>
                    <span className="font-mono">{parsed.arxivId}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {ref_.concerns.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Concerns
              </p>
              <ul className="ml-4 list-disc space-y-0.5 text-xs">
                {ref_.concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
