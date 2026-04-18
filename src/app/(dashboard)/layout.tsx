import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import {
  getUnreadNotificationCount,
  listNotificationsForUser,
} from "@/lib/review-service";
import { getUserById } from "@/lib/users";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser = getUserById(session.user.id);
  if (!currentUser) {
    redirect("/login");
  }

  const notifications = listNotificationsForUser(currentUser.id);
  const unreadCount = getUnreadNotificationCount(currentUser.id);

  return (
    <SidebarProvider>
      <AppSidebar user={currentUser} unreadCount={unreadCount} />
      <div className="flex flex-1 flex-col">
        <DashboardTopbar
          user={currentUser}
          notifications={notifications}
          unreadCount={unreadCount}
        />
        <main className="flex-1 bg-transparent px-4 py-6 md:px-7">
          <div className="mx-auto h-full w-full animate-in fade-in-0 duration-500">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
