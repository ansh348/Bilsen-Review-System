import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AnalyticsExportButtonsProps {
  type: "leaderboard" | "workload";
  period: string;
}

export function AnalyticsExportButtons({ type, period }: AnalyticsExportButtonsProps) {
  const base = `/api/admin/analytics/export?type=${type}&period=${encodeURIComponent(period)}`;
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`${base}&format=csv`}>Export CSV</Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`${base}&format=pdf`}>Export PDF</Link>
      </Button>
    </div>
  );
}
