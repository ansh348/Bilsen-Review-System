"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const periods = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "overall", label: "Overall" },
] as const;

interface PeriodSelectorProps {
  currentPeriod: string;
}

export function PeriodSelector({ currentPeriod }: PeriodSelectorProps) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={currentPeriod === period.value ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link href={`${pathname}?period=${period.value}`}>
            {period.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
