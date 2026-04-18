import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const recentPapers = [
  {
    id: 1,
    title: "Improving Developer Productivity with AI-Assisted Tools",
    venue: "ICSE 2026",
    status: "Under Review",
  },
  {
    id: 2,
    title: "A Survey of Modern Web Framework Performance",
    venue: "TSE",
    status: "Accepted",
  },
  {
    id: 3,
    title: "Automated Bug Detection Using Static Analysis",
    venue: "FSE 2026",
    status: "Draft",
  },
];

function getStatusVariant(status: string) {
  switch (status) {
    case "Accepted":
      return "default" as const;
    case "Under Review":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function RecentPapers() {
  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="text-base">Recent Papers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {recentPapers.map((paper) => (
          <div
            key={paper.id}
            className="flex items-center justify-between rounded-lg border border-border/80 bg-background/35 p-3 transition-colors hover:bg-accent/45"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {paper.title}
              </p>
              <p className="text-xs text-muted-foreground">{paper.venue}</p>
            </div>
            <Badge variant={getStatusVariant(paper.status)} className="ml-3 shrink-0">
              {paper.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
