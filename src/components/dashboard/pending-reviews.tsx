import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const pendingReviews = [
  {
    id: 1,
    title: "A Novel Approach to Software Testing in CI/CD Pipelines",
    deadline: "2026-02-20",
    status: "Pending",
  },
  {
    id: 2,
    title: "Machine Learning for Automated Code Review",
    deadline: "2026-02-25",
    status: "In Progress",
  },
  {
    id: 3,
    title: "Security Analysis of Microservice Architectures",
    deadline: "2026-03-01",
    status: "Pending",
  },
];

function getStatusVariant(status: string) {
  switch (status) {
    case "In Progress":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function PendingReviews() {
  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="text-base">Pending Reviews</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {pendingReviews.map((review) => (
          <div
            key={review.id}
            className="flex items-center justify-between rounded-lg border border-border/80 bg-background/35 p-3 transition-colors hover:bg-accent/45"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {review.title}
              </p>
              <p className="text-xs text-muted-foreground">
                Due: {review.deadline}
              </p>
            </div>
            <Badge variant={getStatusVariant(review.status)} className="ml-3 shrink-0">
              {review.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
