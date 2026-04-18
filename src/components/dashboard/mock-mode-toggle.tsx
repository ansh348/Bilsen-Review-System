"use client";

import { useState, useEffect } from "react";
import { FlaskConical, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MockModeToggle() {
  const [mockMode, setMockMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mock-mode")
      .then((res) => res.json())
      .then((data) => {
        setMockMode(data.mockMode);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/mock-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mockMode: !mockMode }),
      });
      const data = await res.json();
      setMockMode(data.mockMode);
      window.location.reload();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className={
        mockMode
          ? "border-amber-500 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          : ""
      }
    >
      {mockMode ? (
        <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
      ) : (
        <Database className="mr-1.5 h-3.5 w-3.5" />
      )}
      {loading ? "..." : mockMode ? "Mock: ON" : "Mock: OFF"}
    </Button>
  );
}
