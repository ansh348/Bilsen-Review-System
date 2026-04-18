"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface MarkAsReadButtonProps {
  notificationId: string;
}

export function MarkAsReadButton({ notificationId }: MarkAsReadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleMarkRead() {
    setLoading(true);
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      router.refresh();
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs h-7 px-2"
      onClick={handleMarkRead}
      disabled={loading}
    >
      {loading ? "..." : "Mark read"}
    </Button>
  );
}
