"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function getStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    return null;
  }
  return null;
}

export function ThemeToggle({ className }: { className?: string }) {
  function toggleTheme() {
    const currentTheme: Theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const storedTheme = getStoredTheme();
    const nextTheme: Theme =
      (storedTheme ?? currentTheme) === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures; theme still toggles for the current session.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-md text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={toggleTheme}
      title="Switch between dark and light mode"
      aria-label="Switch between dark and light mode"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="block h-4 w-4 dark:hidden" />
      <span className="sr-only">Switch theme</span>
    </Button>
  );
}
