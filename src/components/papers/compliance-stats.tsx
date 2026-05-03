interface StatTileProps {
  label: string;
  value: number | string;
  tone?: "default" | "emerald" | "amber" | "red" | "blue" | "muted";
}

const TONE_CLASSES: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "text-foreground",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  red: "text-destructive",
  blue: "text-blue-500",
  muted: "text-muted-foreground",
};

export function StatTile({ label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-center">
      <p className={`text-2xl font-bold tabular-nums ${TONE_CLASSES[tone]}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

interface BarSegment {
  value: number;
  className: string;
  label?: string;
}

export function StackedBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return <div className="h-2 w-full rounded-full bg-muted" />;
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {segments.map((seg, i) =>
        seg.value > 0 ? (
          <div
            key={i}
            className={seg.className}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={seg.label ? `${seg.label}: ${seg.value}` : undefined}
          />
        ) : null,
      )}
    </div>
  );
}
