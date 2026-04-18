"use client";

import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  User,
  Link2,
  ShieldCheck,
  Users,
  Building2,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const memberItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Papers", href: "/papers", icon: FileText },
  { title: "My Reviews", href: "/reviews/mine", icon: ClipboardCheck },
  { title: "Profile", href: "/profile", icon: User },
  { title: "Link Slack", href: "/link-slack", icon: Link2 },
];

const coordinatorItems = [
  { title: "Admin Overview", href: "/admin/dashboard", icon: ShieldCheck },
  { title: "Reviewers", href: "/admin/reviewers", icon: Users },
  { title: "Venues", href: "/admin/venues", icon: Building2 },
];

interface AppSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  unreadCount?: number;
}

export function AppSidebar({ user, unreadCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const isCoordinator = user.role === "COORDINATOR";

  const isPathActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/80 px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
              BILSEN
            </span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/65">
              Review Hub
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/60">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {memberItems.map((item) => {
                const isActive = isPathActive(item.href);
                const showBadge = item.href === "/dashboard" && unreadCount > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className="h-9">
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {showBadge && (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isCoordinator && (
          <SidebarGroup>
            <SidebarGroupLabel className="mt-3 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/60">
              Coordinator
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {coordinatorItems.map((item) => {
                  const isActive = isPathActive(item.href);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} className="h-9">
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/80 px-4 py-4">
        <div className="rounded-lg border border-sidebar-border/80 bg-sidebar-accent/55 px-3 py-2">
          <span className="line-clamp-1 text-sm font-medium text-sidebar-foreground">
            {user.name}
          </span>
          <span className="line-clamp-1 text-xs text-sidebar-foreground/70">
            {user.email}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
