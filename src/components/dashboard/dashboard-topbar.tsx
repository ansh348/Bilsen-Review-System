"use client";

import { useMemo } from "react";
import { Bell, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MockModeToggle } from "@/components/dashboard/mock-mode-toggle";
import { useTopbarSlot } from "@/components/dashboard/topbar-slot-context";

interface DashboardTopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
  }>;
  unreadCount: number;
}

function getInitials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DashboardTopbar({
  user,
  notifications,
  unreadCount,
}: DashboardTopbarProps) {
  const recentNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications]
  );
  const { left } = useTopbarSlot();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-card/85 px-4 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SidebarTrigger />
        {left ?? (
          <div className="hidden sm:block">
            <p className="text-sm font-semibold tracking-tight">Reviewer Workspace</p>
            <p className="text-xs text-muted-foreground">
              AI-assisted review flow
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <MockModeToggle />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-md text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-[0_0_0_2px_var(--card)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <span className="text-xs text-muted-foreground">
                {unreadCount} unread
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {recentNotifications.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No notifications.
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => {
                    if (!notification.read) {
                      fetch(`/api/notifications/${notification.id}/read`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                      });
                    }
                  }}
                  asChild
                >
                  <Link
                    href={notification.link || "/dashboard"}
                    className="flex items-start gap-2 py-2"
                  >
                    {!notification.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs ${!notification.read ? "font-semibold" : "font-medium"}`}>
                        {notification.title}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {notification.message}
                      </span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-accent/80 text-accent-foreground text-xs">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
