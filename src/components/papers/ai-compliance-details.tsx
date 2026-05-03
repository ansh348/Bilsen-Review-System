"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StackedBar, StatTile } from "@/components/papers/compliance-stats";

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

const DIMENSION_LABELS: Record<string, string> = {
  PAGE_LIMIT: "Page limit",
  ABSTRACT: "Abstract",
  REQUIRED_SECTIONS: "Required sections",
  CONVENTIONAL_SECTIONS: "Conventional sections",
  SPECIAL_REQUIRED_SECTIONS: "Special required sections",
  REFERENCE_FORMAT: "Reference format",
  ANONYMITY: "Anonymity",
  TEMPLATE_FORMAT: "Template format",
  AI_DISCLOSURE: "AI disclosure",
  BROADER_IMPACT: "Broader impact",
  DATA_AVAILABILITY: "Data availability",
  LIMITATIONS: "Limitations",
  REPRODUCIBILITY: "Reproducibility",
  ETHICS_STATEMENT: "Ethics statement",
  PAPER_TYPE_FIT: "Paper type fit",
  DESK_REJECT_RISK: "Desk-reject risk",
};

function dimensionLabel(code: string) {
  return (
    DIMENSION_LABELS[code] ??
    code
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

function verdictAccentClass(v: AiDimensionResult["verdict"]) {
  switch (v) {
    case "fail":
      return "border-l-4 border-l-destructive";
    case "warning":
      return "border-l-4 border-l-amber-500";
    case "manual":
      return "border-l-4 border-l-blue-500";
    default:
      return "";
  }
}

function isConfigToken(s: string) {
  if (s.length > 80) return false;
  return /^[A-Za-z][A-Za-z0-9_]*\s*[:=]/.test(s.trim());
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

  const passCount = checks.filter((c) => c.verdict === "pass").length;
  const warnCount = checks.filter((c) => c.verdict === "warning").length;
  const failCount = checks.filter((c) => c.verdict === "fail").length;
  const manualCount = checks.filter((c) => c.verdict === "manual").length;
  const skippedCount = checks.filter((c) => c.verdict === "skipped").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {details.deskRejectRisk && (
          <Badge variant={deskRejectBadgeVariant(details.deskRejectRisk)}>
            Desk-reject risk: {details.deskRejectRisk}
          </Badge>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {details.modelUsed && <span>Model: {details.modelUsed}</span>}
          {details.generatedAt && (
            <span>Generated: {details.generatedAt.slice(0, 19).replace("T", " ")}</span>
          )}
        </div>
      </div>
      {details.paperTruncated && (
        <p className="text-xs text-amber-600">
          Paper text truncated (very long manuscript) — head + tail evaluated.
        </p>
      )}

      {checks.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatTile label="Dimensions" value={checks.length} tone="muted" />
            <StatTile label="Passed" value={passCount} tone="emerald" />
            <StatTile label="Warnings" value={warnCount} tone="amber" />
            <StatTile label="Failed" value={failCount} tone="red" />
            <StatTile label="Manual" value={manualCount + skippedCount} tone="blue" />
          </div>
          <StackedBar
            segments={[
              { value: passCount, className: "bg-emerald-500", label: "Pass" },
              { value: warnCount, className: "bg-amber-500", label: "Warning" },
              { value: failCount, className: "bg-destructive", label: "Fail" },
              {
                value: manualCount + skippedCount,
                className: "bg-blue-500",
                label: "Manual / skipped",
              },
            ]}
          />
        </div>
      )}

      <ul className="space-y-2">
        {checks.map((c) => (
          <DimensionCard key={c.dimension} check={c} />
        ))}
      </ul>
    </div>
  );
}

function DimensionCard({ check }: { check: AiDimensionResult }) {
  const [open, setOpen] = useState(false);
  const hasDetail =
    (check.evidence && check.evidence.length > 0) ||
    (check.recommendation && check.recommendation !== "No action needed.");
  const accent = verdictAccentClass(check.verdict);

  return (
    <li className={`rounded-md border border-border/60 bg-input/15 ${accent}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        disabled={!hasDetail}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{dimensionLabel(check.dimension)}</span>
            <Badge variant={verdictBadgeVariant(check.verdict)}>{check.verdict}</Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(check.confidence * 100)}% confidence
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{check.summary}</p>
        </div>
        {hasDetail && (
          <span className="shrink-0 text-base text-muted-foreground">{open ? "−" : "+"}</span>
        )}
      </button>

      {open && hasDetail && (
        <div className="space-y-4 border-t border-border/60 px-4 py-3 text-sm">
          {check.evidence.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Evidence
              </p>
              <ul className="space-y-2">
                {check.evidence.map((e, i) => {
                  const looksLikeToken = isConfigToken(e);
                  return (
                    <li
                      key={i}
                      className="border-l-2 border-border/50 pl-3 text-sm leading-relaxed"
                    >
                      {looksLikeToken ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {e}
                        </code>
                      ) : (
                        e
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {check.recommendation && check.recommendation !== "No action needed." && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recommendation
              </p>
              <p className="text-sm leading-relaxed">{check.recommendation}</p>
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

function statusAccentClass(s: AiReferenceItem["status"]) {
  switch (s) {
    case "suspicious":
      return "border-l-4 border-l-destructive";
    case "malformed":
      return "border-l-4 border-l-amber-500";
    case "uncertain":
      return "border-l-4 border-l-blue-500";
    default:
      return "";
  }
}

function statusLabel(s: AiReferenceItem["status"]) {
  switch (s) {
    case "suspicious":
      return "suspicious";
    case "malformed":
      return "malformed";
    case "uncertain":
      return "uncertain";
    case "likely_real":
      return "likely real";
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

  const total = summary.total ?? refs.length;
  const likelyReal = summary.likelyReal ?? 0;
  const uncertain = summary.uncertain ?? 0;
  const suspicious = summary.suspicious ?? 0;
  const malformed = summary.malformed ?? 0;

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatTile label="Total refs" value={total} tone="muted" />
            <StatTile label="Likely real" value={likelyReal} tone="emerald" />
            <StatTile label="Uncertain" value={uncertain} tone="muted" />
            <StatTile label="Suspicious" value={suspicious} tone="red" />
            <StatTile label="Malformed" value={malformed} tone="amber" />
          </div>
          <StackedBar
            segments={[
              { value: likelyReal, className: "bg-emerald-500", label: "Likely real" },
              { value: uncertain, className: "bg-muted-foreground/40", label: "Uncertain" },
              { value: suspicious, className: "bg-destructive", label: "Suspicious" },
              { value: malformed, className: "bg-amber-500", label: "Malformed" },
            ]}
          />
        </div>
      )}

      {details.modelUsed && (
        <p className="text-xs text-muted-foreground">Model: {details.modelUsed}</p>
      )}

      {summary.overallAssessment && summary.overallAssessment !== details.message && (
        <p className="text-sm leading-relaxed">{summary.overallAssessment}</p>
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
  const [open, setOpen] = useState(false);
  const parsed = ref_.parsed;
  const hasParsed = parsed.title || (parsed.authors && parsed.authors.length > 0) || parsed.year;
  const accent = statusAccentClass(ref_.status);

  return (
    <li className={`rounded-md border border-border/60 bg-input/15 ${accent}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Reference [{ref_.index}]</span>
            <Badge variant={statusBadgeVariant(ref_.status)}>{statusLabel(ref_.status)}</Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(ref_.confidence * 100)}% confidence
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-muted-foreground">{ref_.raw}</p>
        </div>
        <span className="shrink-0 text-base text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/60 px-4 py-3 text-sm">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Raw citation
            </p>
            <p className="text-sm leading-relaxed">{ref_.raw}</p>
          </div>
          {hasParsed && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Parsed
              </p>
              <ul className="space-y-1 text-sm leading-relaxed">
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
                    <span className="font-mono text-xs">{parsed.doi}</span>
                  </li>
                )}
                {parsed.arxivId && (
                  <li>
                    <span className="text-muted-foreground">arXiv: </span>
                    <span className="font-mono text-xs">{parsed.arxivId}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {ref_.concerns.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Concerns
              </p>
              <ul className="space-y-2">
                {ref_.concerns.map((c, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-border/50 pl-3 text-sm leading-relaxed"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
