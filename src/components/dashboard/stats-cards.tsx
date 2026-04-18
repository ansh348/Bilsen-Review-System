import { FileText, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    label: "Papers Submitted",
    value: 12,
    icon: FileText,
    color: "bg-primary/20 text-primary",
  },
  {
    label: "Pending Reviews",
    value: 5,
    icon: Clock,
    color: "bg-chart-3/20 text-chart-3",
  },
  {
    label: "Completed Reviews",
    value: 28,
    icon: CheckCircle,
    color: "bg-chart-2/20 text-chart-2",
  },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`rounded-lg border border-border/80 p-2.5 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">
                {stat.value}
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
